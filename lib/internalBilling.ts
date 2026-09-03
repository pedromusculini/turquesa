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

/** Máximo de dias de cortesia por clique no painel admin. */
export const ADMIN_COURTESY_DAYS_MAX = 180;

export async function extendTenantTrial(params: {
  ownerEmail: string;
  extraDays: number;
}): Promise<{ trial_ends_at: string; current_period_end: string }> {
  const email = params.ownerEmail.toLowerCase().trim();
  const extraDays = Math.min(
    ADMIN_COURTESY_DAYS_MAX,
    Math.max(1, Math.floor(params.extraDays)),
  );

  const { data: row, error } = await supabaseAdmin
    .from('assinaturas')
    .select('status, trial_ends_at, current_period_end, first_payment_at, plano')
    .eq('owner_email', email)
    .maybeSingle();
  if (error) throw error;
  if (!row) throw new Error('Assinatura não encontrada para este e-mail');

  const now = new Date();
  const candidates = [now.getTime()];
  // Só datas ainda vigentes — período pago vencido (ex.: 05/08) não puxa a base para o passado.
  for (const iso of [row.trial_ends_at, row.current_period_end]) {
    if (!iso) continue;
    const t = new Date(iso).getTime();
    if (Number.isFinite(t) && t > now.getTime()) candidates.push(t);
  }
  const base = new Date(Math.max(...candidates));
  const next = new Date(base);
  next.setUTCDate(next.getUTCDate() + extraDays);
  const accessEndsAt = next.toISOString();

  // Alinha trial_started_at para (fim − TRIAL_DAYS) — senão reconcile encolhe a cortesia.
  const alignedStart = new Date(next);
  alignedStart.setUTCDate(alignedStart.getUTCDate() - TRIAL_DAYS);

  // Conta que já pagou: libera como período ativo + trial alinhado (painel deixa de mostrar 05/08).
  // Sem pagamento: só trial.
  const hadPayment = Boolean(row.first_payment_at);
  const patch: Record<string, unknown> = {
    status: hadPayment ? 'active' : 'trial',
    trial_ends_at: accessEndsAt,
    current_period_end: accessEndsAt,
    boleto_grace_until: null,
    updated_at: now.toISOString(),
  };

  const { error: updErr } = await supabaseAdmin
    .from('assinaturas')
    .update(patch)
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
    console.warn('[extendTenantTrial] google_account_access:', accessErr.message);
  }

  const { error: profileErr } = await supabaseAdmin
    .from('onboarding_profiles')
    .update({ trial_started: true })
    .eq('email', email);
  if (profileErr && profileErr.code !== 'PGRST116') {
    console.warn('[extendTenantTrial] onboarding_profiles:', profileErr.message);
  }

  return { trial_ends_at: accessEndsAt, current_period_end: accessEndsAt };
}
