import { supabaseAdmin } from '@/lib/supabaseClient';
import { evaluateAccess, type AssinaturaStatus } from '@/lib/assinatura';

export type TenantBillingSummary = {
  status: AssinaturaStatus | 'none';
  trial_ends_at: string | null;
  current_period_end: string | null;
  first_payment_at: string | null;
  last_billing_type: string | null;
  asaas_customer_id: string | null;
  asaas_subscription_id: string | null;
  can_use_app: boolean;
};

type AssinaturaDbRow = {
  owner_email: string;
  status: AssinaturaStatus;
  trial_ends_at: string | null;
  current_period_end: string | null;
  first_payment_at?: string | null;
  last_billing_type?: string | null;
  boleto_grace_until?: string | null;
  asaas_customer_id?: string | null;
  asaas_subscription_id?: string | null;
};

function rowToSummary(row: AssinaturaDbRow | null): TenantBillingSummary {
  if (!row) {
    return {
      status: 'none',
      trial_ends_at: null,
      current_period_end: null,
      first_payment_at: null,
      last_billing_type: null,
      asaas_customer_id: null,
      asaas_subscription_id: null,
      can_use_app: false,
    };
  }
  const evaluated = evaluateAccess({
    status: row.status,
    trial_ends_at: row.trial_ends_at,
    current_period_end: row.current_period_end,
    boleto_grace_until: row.boleto_grace_until ?? null,
  });
  return {
    status: evaluated.status,
    trial_ends_at: row.trial_ends_at,
    current_period_end: row.current_period_end,
    first_payment_at: row.first_payment_at ?? null,
    last_billing_type: row.last_billing_type ?? null,
    asaas_customer_id: row.asaas_customer_id ?? null,
    asaas_subscription_id: row.asaas_subscription_id ?? null,
    can_use_app: evaluated.canUseApp,
  };
}

export async function getBillingSummaryForEmail(
  ownerEmail: string,
): Promise<TenantBillingSummary> {
  const email = ownerEmail.toLowerCase().trim();
  const { data, error } = await supabaseAdmin
    .from('assinaturas')
    .select(
      'owner_email, status, trial_ends_at, current_period_end, first_payment_at, last_billing_type, boleto_grace_until, asaas_customer_id, asaas_subscription_id',
    )
    .eq('owner_email', email)
    .maybeSingle();
  if (error) {
    if (error.code === 'PGRST205') return rowToSummary(null);
    throw error;
  }
  return rowToSummary((data as AssinaturaDbRow) ?? null);
}

export async function getBillingMapForEmails(
  emails: string[],
): Promise<Map<string, TenantBillingSummary>> {
  const map = new Map<string, TenantBillingSummary>();
  if (!emails.length) return map;

  const { data, error } = await supabaseAdmin
    .from('assinaturas')
    .select(
      'owner_email, status, trial_ends_at, current_period_end, first_payment_at, last_billing_type, boleto_grace_until, asaas_customer_id, asaas_subscription_id',
    )
    .in('owner_email', emails);
  if (error) {
    if (error.code === 'PGRST205') {
      for (const e of emails) map.set(e, rowToSummary(null));
      return map;
    }
    throw error;
  }

  const byEmail = new Map(
    (data ?? []).map((r) => [
      (r as AssinaturaDbRow).owner_email.toLowerCase().trim(),
      r as AssinaturaDbRow,
    ]),
  );
  for (const email of emails) {
    map.set(email, rowToSummary(byEmail.get(email) ?? null));
  }
  return map;
}

export function daysUntilIso(iso: string | null): number | null {
  if (!iso) return null;
  const end = new Date(iso).getTime();
  const now = Date.now();
  return Math.ceil((end - now) / 86400000);
}

export async function extendTenantTrial(params: {
  ownerEmail: string;
  extraDays: number;
}): Promise<{ trial_ends_at: string }> {
  const email = params.ownerEmail.toLowerCase().trim();
  const extraDays = Math.min(30, Math.max(1, Math.floor(params.extraDays)));

  const { data: row, error } = await supabaseAdmin
    .from('assinaturas')
    .select('status, trial_ends_at')
    .eq('owner_email', email)
    .maybeSingle();
  if (error) throw error;
  if (!row) throw new Error('Assinatura não encontrada');

  const base = row.trial_ends_at ? new Date(row.trial_ends_at) : new Date();
  const next = new Date(base);
  next.setUTCDate(next.getUTCDate() + extraDays);
  const trialEndsAt = next.toISOString();

  const { error: updErr } = await supabaseAdmin
    .from('assinaturas')
    .update({
      status: 'trial',
      trial_ends_at: trialEndsAt,
    })
    .eq('owner_email', email);
  if (updErr) throw updErr;

  return { trial_ends_at: trialEndsAt };
}
