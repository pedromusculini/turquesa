import { supabaseAdmin } from '@/lib/supabaseClient';
import { TRIAL_DAYS } from '@/lib/asaasBillingPolicy';
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
    .select('status, trial_ends_at, current_period_end, plano')
    .eq('owner_email', email)
    .maybeSingle();
  if (error) throw error;
  if (!row) throw new Error('Assinatura não encontrada para este e-mail');

  const now = new Date();
  const candidates = [now.getTime()];
  if (row.trial_ends_at) {
    const t = new Date(row.trial_ends_at).getTime();
    if (Number.isFinite(t)) candidates.push(t);
  }
  if (row.current_period_end) {
    const p = new Date(row.current_period_end).getTime();
    if (Number.isFinite(p)) candidates.push(p);
  }
  // Sempre a partir de agora ou do fim já vigente — nunca somar em cima de data vencida.
  const base = new Date(Math.max(...candidates));
  const next = new Date(base);
  next.setUTCDate(next.getUTCDate() + extraDays);
  const trialEndsAt = next.toISOString();

  // Alinha trial_started_at para (fim − 30d) — senão reconcileTrialAssinatura
  // recalcula start+30 e apaga a cortesia do painel.
  const alignedStart = new Date(next);
  alignedStart.setUTCDate(alignedStart.getUTCDate() - TRIAL_DAYS);

  const { error: updErr } = await supabaseAdmin
    .from('assinaturas')
    .update({
      status: 'trial',
      trial_ends_at: trialEndsAt,
      updated_at: now.toISOString(),
    })
    .eq('owner_email', email);
  if (updErr) throw updErr;

  const { error: accessErr } = await supabaseAdmin
    .from('google_account_access')
    .update({
      trial_started_at: alignedStart.toISOString(),
      trial_consumed: true,
      updated_at: now.toISOString(),
    })
    .eq('email', email);
  if (accessErr && accessErr.code !== 'PGRST116') {
    // Coluna/linha ausente não deve impedir a cortesia na assinatura.
    console.warn('[extendTenantTrial] google_account_access:', accessErr.message);
  }

  const { error: profileErr } = await supabaseAdmin
    .from('onboarding_profiles')
    .update({ trial_started: true })
    .eq('email', email);
  if (profileErr && profileErr.code !== 'PGRST116') {
    console.warn('[extendTenantTrial] onboarding_profiles:', profileErr.message);
  }

  return { trial_ends_at: trialEndsAt };
}
