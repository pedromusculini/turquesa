import { supabaseAdmin } from '@/lib/supabaseClient';
import { getInternalProductId } from '@/lib/internalProduct';

export type WebhookEventRow = {
  id: string;
  asaas_event_id: string | null;
  event_type: string;
  owner_email: string | null;
  asaas_payment_id: string | null;
  created_at: string;
};

export type BugReportRow = {
  id: string;
  reporter_email: string;
  description: string;
  page_url: string | null;
  created_at: string;
};

export type GlobalAuditRow = {
  id: string;
  admin_email: string;
  action: string;
  target_owner_email: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type TeamOpsSummary = {
  profissionais_total: number;
  google_calendar_conectados: number;
};

export async function listRecentWebhookEvents(limit = 50): Promise<WebhookEventRow[]> {
  const { data, error } = await supabaseAdmin
    .from('assinaturas_webhook_events')
    .select('id, asaas_event_id, event_type, owner_email, asaas_payment_id, created_at')
    .order('created_at', { ascending: false })
    .limit(Math.min(100, Math.max(1, limit)));
  if (error) {
    if (error.code === 'PGRST205') return [];
    throw error;
  }
  return (data ?? []) as WebhookEventRow[];
}

export async function listBugReports(params: {
  limit?: number;
  offset?: number;
}): Promise<{ reports: BugReportRow[]; total: number }> {
  const limit = Math.min(50, Math.max(1, params.limit ?? 25));
  const offset = Math.max(0, params.offset ?? 0);
  const productId = getInternalProductId();

  const { count, error: countErr } = await supabaseAdmin
    .from('bug_reports')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', productId);
  if (countErr) {
    if (countErr.code === 'PGRST205') return { reports: [], total: 0 };
    throw countErr;
  }

  const { data, error } = await supabaseAdmin
    .from('bug_reports')
    .select('id, reporter_email, description, page_url, created_at')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) {
    if (error.code === 'PGRST205') return { reports: [], total: 0 };
    throw error;
  }

  return {
    reports: (data ?? []) as BugReportRow[],
    total: count ?? 0,
  };
}

export async function listGlobalInternalAudit(params: {
  limit?: number;
  offset?: number;
  action?: string;
}): Promise<{ rows: GlobalAuditRow[]; total: number }> {
  const limit = Math.min(100, Math.max(1, params.limit ?? 50));
  const offset = Math.max(0, params.offset ?? 0);
  const productId = getInternalProductId();

  let countQuery = supabaseAdmin
    .from('internal_audit_log')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', productId);
  let dataQuery = supabaseAdmin
    .from('internal_audit_log')
    .select(
      'id, admin_email, action, target_owner_email, metadata, created_at',
    )
    .eq('product_id', productId)
    .order('created_at', { ascending: false });

  if (params.action?.trim()) {
    const action = params.action.trim();
    countQuery = countQuery.eq('action', action);
    dataQuery = dataQuery.eq('action', action);
  }

  const [{ count, error: countErr }, { data, error }] = await Promise.all([
    countQuery,
    dataQuery.range(offset, offset + limit - 1),
  ]);

  if (countErr) {
    if (countErr.code === 'PGRST205') return { rows: [], total: 0 };
    throw countErr;
  }
  if (error) {
    if (error.code === 'PGRST205') return { rows: [], total: 0 };
    throw error;
  }

  return {
    rows: (data ?? []) as GlobalAuditRow[],
    total: count ?? 0,
  };
}

export async function getTeamOpsSummary(ownerEmail: string): Promise<TeamOpsSummary> {
  const email = ownerEmail.toLowerCase().trim();

  const [{ count: profCount, error: profErr }, { data: calRows, error: calErr }] =
    await Promise.all([
      supabaseAdmin
        .from('clinica_medicos')
        .select('id', { count: 'exact', head: true })
        .eq('owner_email', email),
      supabaseAdmin
        .from('profissional_google_calendar')
        .select('connected_at')
        .eq('owner_email', email),
    ]);

  if (profErr && profErr.code !== 'PGRST205') throw profErr;
  if (calErr && calErr.code !== 'PGRST205') throw calErr;

  const connected = (calRows ?? []).filter((r) => r.connected_at).length;
  return {
    profissionais_total: profCount ?? 0,
    google_calendar_conectados: connected,
  };
}
