import { supabaseAdmin } from '@/lib/supabaseClient';
import type { TenantBillingSummary } from '@/lib/internalBilling';
import { daysUntilIso } from '@/lib/internalBilling';

export type TenantHealth = {
  google_sub_cadastrado: boolean;
  sync_agendamentos_pendentes: number;
  sync_formularios_pendentes: number;
  ativado: boolean;
  dias_sem_login: number | null;
};

function brTodayKey(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

export function daysSinceLogin(iso: string | null): number | null {
  if (!iso) return null;
  const key = new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const [y1, m1, d1] = brTodayKey().split('-').map(Number);
  const [y2, m2, d2] = key.split('-').map(Number);
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((t1 - t2) / 86400000);
}

export function computeAtivado(params: {
  clientes: number;
  consultas: number;
  slug_ativo: boolean;
}): boolean {
  return params.clientes > 0 || params.consultas > 0 || params.slug_ativo;
}

async function aggregateAgendamentosPendentes(): Promise<Record<string, number>> {
  const { data, error } = await supabaseAdmin
    .from('agendamentos_pendentes_drive')
    .select('owner_email')
    .eq('sincronizado', false);
  if (error) {
    if (error.code === 'PGRST205') return {};
    throw error;
  }
  const map: Record<string, number> = {};
  for (const row of data ?? []) {
    const k = row.owner_email?.toLowerCase().trim();
    if (!k) continue;
    map[k] = (map[k] ?? 0) + 1;
  }
  return map;
}

async function aggregateFormulariosPendentes(): Promise<Record<string, number>> {
  const { data: links, error: linkErr } = await supabaseAdmin
    .from('formulario_links')
    .select('id, owner_email');
  if (linkErr) {
    if (linkErr.code === 'PGRST205') return {};
    throw linkErr;
  }
  if (!links?.length) return {};

  const linkToOwner = new Map(
    links.map((l) => [l.id, l.owner_email.toLowerCase().trim()]),
  );
  const linkIds = links.map((l) => l.id);

  const { data: respostas, error: respErr } = await supabaseAdmin
    .from('formulario_respostas')
    .select('link_id')
    .eq('sincronizado_drive', false)
    .in('link_id', linkIds);
  if (respErr) {
    if (respErr.code === 'PGRST205') return {};
    throw respErr;
  }

  const map: Record<string, number> = {};
  for (const r of respostas ?? []) {
    const owner = linkToOwner.get(r.link_id);
    if (!owner) continue;
    map[owner] = (map[owner] ?? 0) + 1;
  }
  return map;
}

export async function getHealthMapForEmails(
  emails: string[],
  ctx: Map<
    string,
    {
      last_login_at: string | null;
      google_sub: string | null;
      clientes: number;
      consultas: number;
      slug_ativo: boolean;
    }
  >,
): Promise<Map<string, TenantHealth>> {
  const [agPend, formPend] = await Promise.all([
    aggregateAgendamentosPendentes(),
    aggregateFormulariosPendentes(),
  ]);

  const result = new Map<string, TenantHealth>();
  for (const email of emails) {
    const c = ctx.get(email);
    const clientes = c?.clientes ?? 0;
    const consultas = c?.consultas ?? 0;
    const slug = c?.slug_ativo ?? false;
    result.set(email, {
      google_sub_cadastrado: !!c?.google_sub,
      sync_agendamentos_pendentes: agPend[email] ?? 0,
      sync_formularios_pendentes: formPend[email] ?? 0,
      ativado: computeAtivado({ clientes, consultas, slug_ativo: slug }),
      dias_sem_login: daysSinceLogin(c?.last_login_at ?? null),
    });
  }
  return result;
}

export type TenantListFilter =
  | 'all'
  | 'inactive_30'
  | 'onboarding_pending'
  | 'no_slug'
  | 'not_activated'
  | 'sync_pending'
  | 'unverified'
  | 'trial_expiring_7d'
  | 'subscription_expired'
  | 'no_asaas_customer';

export function matchesTenantFilter(
  item: {
    email_verified: boolean;
    onboarding_completed: boolean;
    flags: { slug_ativo: boolean };
    health: TenantHealth;
    billing?: TenantBillingSummary | null;
  },
  filter: TenantListFilter,
): boolean {
  if (filter === 'all') return true;
  if (filter === 'inactive_30') {
    const d = item.health.dias_sem_login;
    return d === null || d > 30;
  }
  if (filter === 'onboarding_pending') return !item.onboarding_completed;
  if (filter === 'no_slug') return !item.flags.slug_ativo;
  if (filter === 'not_activated') return !item.health.ativado;
  if (filter === 'sync_pending') {
    return (
      item.health.sync_agendamentos_pendentes > 0 ||
      item.health.sync_formularios_pendentes > 0
    );
  }
  if (filter === 'unverified') return !item.email_verified;
  if (filter === 'trial_expiring_7d') {
    const b = item.billing;
    if (!b || b.status !== 'trial') return false;
    const days = daysUntilIso(b.trial_ends_at);
    return days !== null && days >= 0 && days <= 7;
  }
  if (filter === 'subscription_expired') {
    return item.billing?.status === 'expired';
  }
  if (filter === 'no_asaas_customer') {
    return !item.billing?.asaas_customer_id;
  }
  return true;
}
