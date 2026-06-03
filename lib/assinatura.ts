import { supabaseAdmin } from '@/lib/supabaseClient';
import {
  TRIAL_DAYS,
  TRIAL_PAYMENT_DAY,
  PAID_PERIOD_DAYS,
  getBillingUserMessages,
  computeBoletoGraceUntil,
  type AsaasBillingType,
  type BillingUserMessage,
} from '@/lib/asaasBillingPolicy';

export type AssinaturaStatus = 'trial' | 'active' | 'expired';

export type SubscriptionAccess = {
  status: AssinaturaStatus;
  canUseApp: boolean;
  plano: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  daysLeftTrial: number | null;
  trialPaymentDay: number;
  asaas_customer_id: string | null;
  asaas_subscription_id: string | null;
  first_payment_at: string | null;
  last_billing_type: string | null;
  boleto_grace_until: string | null;
  messages: BillingUserMessage;
};

type AssinaturaRow = {
  status: AssinaturaStatus;
  plano: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  first_payment_at?: string | null;
  last_payment_at?: string | null;
  last_billing_type?: string | null;
  boleto_grace_until?: string | null;
  asaas_customer_id?: string | null;
  asaas_subscription_id?: string | null;
};

function addDaysIso(base: Date, days: number): string {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

function addMonthsFromDateString(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + months, d));
  return dt.toISOString();
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const end = new Date(iso).getTime();
  const now = Date.now();
  return Math.max(0, Math.ceil((end - now) / (24 * 60 * 60 * 1000)));
}

export function evaluateAccess(row: {
  status: AssinaturaStatus;
  trial_ends_at: string | null;
  current_period_end: string | null;
  boleto_grace_until?: string | null;
}): { status: AssinaturaStatus; canUseApp: boolean } {
  const now = Date.now();

  if (row.status === 'trial') {
    const end = row.trial_ends_at ? new Date(row.trial_ends_at).getTime() : 0;
    if (end > now) return { status: 'trial', canUseApp: true };
    return { status: 'expired', canUseApp: false };
  }

  if (row.status === 'active') {
    const periodEnd = row.current_period_end
      ? new Date(row.current_period_end).getTime()
      : 0;
    if (periodEnd > now) return { status: 'active', canUseApp: true };

    const graceEnd = row.boleto_grace_until
      ? new Date(row.boleto_grace_until).getTime()
      : 0;
    if (graceEnd > now) return { status: 'active', canUseApp: true };

    return { status: 'expired', canUseApp: false };
  }

  return { status: 'expired', canUseApp: false };
}

export async function getAssinaturaRow(
  ownerEmail: string,
): Promise<AssinaturaRow | null> {
  const email = ownerEmail.toLowerCase().trim();
  const { data, error } = await supabaseAdmin
    .from('assinaturas')
    .select('*')
    .eq('owner_email', email)
    .maybeSingle();
  if (error) throw error;
  return data as AssinaturaRow | null;
}

export async function ensureAssinaturaRecord(ownerEmail: string): Promise<SubscriptionAccess> {
  const email = ownerEmail.toLowerCase().trim();

  const existing = await getAssinaturaRow(email);
  if (existing) {
    return rowToAccess(existing);
  }

  const { data: profile } = await supabaseAdmin
    .from('onboarding_profiles')
    .select('plan, trial_started')
    .eq('email', email)
    .maybeSingle();

  const { data: access } = await supabaseAdmin
    .from('google_account_access')
    .select('trial_started_at')
    .eq('email', email)
    .maybeSingle();

  const trialStart = access?.trial_started_at
    ? new Date(access.trial_started_at)
    : new Date();
  const trialEnds = addDaysIso(trialStart, TRIAL_DAYS);
  const plano = profile?.plan || 'medico-pix';
  const status: AssinaturaStatus =
    profile?.trial_started === true ? 'trial' : 'expired';

  // assinaturas.owner_email referencia onboarding_profiles — sem perfil, não inserir
  if (!profile) {
    const evaluated = evaluateAccess({
      status: 'trial',
      trial_ends_at: trialEnds,
      current_period_end: null,
    });
    const messages = getBillingUserMessages({
      status: evaluated.status,
      trial_ends_at: trialEnds,
      current_period_end: null,
      boleto_grace_until: null,
      last_billing_type: null,
      first_payment_at: null,
    });
    return {
      status: evaluated.status,
      canUseApp: evaluated.canUseApp,
      plano,
      trial_ends_at: trialEnds,
      current_period_end: null,
      daysLeftTrial: daysUntil(trialEnds),
      trialPaymentDay: TRIAL_PAYMENT_DAY,
      asaas_customer_id: null,
      asaas_subscription_id: null,
      first_payment_at: null,
      last_billing_type: null,
      boleto_grace_until: null,
      messages,
    };
  }

  const { data: inserted, error } = await supabaseAdmin
    .from('assinaturas')
    .insert({
      owner_email: email,
      status,
      plano,
      trial_ends_at: status === 'trial' ? trialEnds : null,
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error) throw error;
  return rowToAccess(inserted as AssinaturaRow);
}

function rowToAccess(row: AssinaturaRow): SubscriptionAccess {
  const evaluated = evaluateAccess({
    status: row.status as AssinaturaStatus,
    trial_ends_at: row.trial_ends_at,
    current_period_end: row.current_period_end,
    boleto_grace_until: row.boleto_grace_until,
  });

  const messages = getBillingUserMessages({
    status: evaluated.status,
    trial_ends_at: row.trial_ends_at,
    current_period_end: row.current_period_end,
    boleto_grace_until: row.boleto_grace_until ?? null,
    last_billing_type: row.last_billing_type ?? null,
    first_payment_at: row.first_payment_at ?? null,
  });

  return {
    status: evaluated.status,
    canUseApp: evaluated.canUseApp,
    plano: row.plano,
    trial_ends_at: row.trial_ends_at,
    current_period_end: row.current_period_end,
    daysLeftTrial:
      evaluated.status === 'trial' ? daysUntil(row.trial_ends_at) : null,
    trialPaymentDay: TRIAL_PAYMENT_DAY,
    asaas_customer_id: row.asaas_customer_id ?? null,
    asaas_subscription_id: row.asaas_subscription_id ?? null,
    first_payment_at: row.first_payment_at ?? null,
    last_billing_type: row.last_billing_type ?? null,
    boleto_grace_until: row.boleto_grace_until ?? null,
    messages,
  };
}

export async function getSubscriptionAccess(
  ownerEmail: string,
): Promise<SubscriptionAccess> {
  const email = ownerEmail.toLowerCase().trim();

  const data = await getAssinaturaRow(email);
  if (!data) return ensureAssinaturaRecord(email);

  const access = rowToAccess(data);
  if (!access.canUseApp && data.status !== 'expired') {
    await supabaseAdmin
      .from('assinaturas')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('owner_email', email);
    return { ...access, status: 'expired', canUseApp: false };
  }
  return access;
}

export async function activateFromPayment(params: {
  ownerEmail: string;
  paymentId: string;
  dueDate?: string | null;
  customerId?: string | null;
  subscriptionId?: string | null;
  billingType?: AsaasBillingType | null;
  isFirstPayment?: boolean;
}): Promise<void> {
  const email = params.ownerEmail.toLowerCase().trim();
  await ensureAssinaturaRecord(email);

  const billingType = params.billingType ?? null;
  const isFirst = params.isFirstPayment ?? false;
  const graceUntil = computeBoletoGraceUntil({
    dueDate: params.dueDate ?? null,
    billingType,
    isFirstPayment: isFirst,
  });

  const now = new Date().toISOString();
  const existing = await getAssinaturaRow(email);
  const extendFrom = new Date();
  if (existing?.current_period_end) {
    const cur = new Date(existing.current_period_end).getTime();
    if (cur > extendFrom.getTime()) extendFrom.setTime(cur);
  }
  const periodEnd = addDaysIso(extendFrom, PAID_PERIOD_DAYS);
  const patch: Record<string, unknown> = {
    status: 'active',
    last_payment_at: now,
    current_period_end: periodEnd,
    last_asaas_payment_id: params.paymentId,
    asaas_customer_id: params.customerId ?? undefined,
    asaas_subscription_id: params.subscriptionId ?? undefined,
    last_billing_type: billingType ?? undefined,
    boleto_grace_until: graceUntil,
    updated_at: now,
  };
  if (isFirst && !existing?.first_payment_at) {
    patch.first_payment_at = now;
  }

  const { error } = await supabaseAdmin
    .from('assinaturas')
    .update(patch)
    .eq('owner_email', email);

  if (error) throw error;
}

export async function expireAssinatura(ownerEmail: string): Promise<void> {
  const email = ownerEmail.toLowerCase().trim();
  await ensureAssinaturaRecord(email);

  const { error } = await supabaseAdmin
    .from('assinaturas')
    .update({
      status: 'expired',
      boleto_grace_until: null,
      updated_at: new Date().toISOString(),
    })
    .eq('owner_email', email);

  if (error) throw error;
}
