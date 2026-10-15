import { supabaseAdmin } from '@/lib/supabaseClient';
import { TRIAL_DAYS } from '@/lib/asaasBillingPolicy';
import { metaCapiEventId, sendMetaCapiEvent } from '@/lib/metaCapi';
import { CANONICAL_APP_URL } from '@/lib/constants';

/** Marcos de ativação do salão (checklist do painel, resumo do trial e e-mails). */
export type AtivacaoResumo = {
  clientes: number;
  sessoes: number;
  agendamentosPeloLink: number;
  finalizadas: number;
  /** Soma das entradas no financeiro desde `desde` (início do trial). */
  entradas: number;
};

function trialStartIso(trialEndsAt: string | null): string | null {
  if (!trialEndsAt) return null;
  const d = new Date(trialEndsAt);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() - TRIAL_DAYS);
  return d.toISOString();
}

async function countRows(
  table: string,
  ownerEmail: string,
  filters?: (q: ReturnType<typeof baseCount>) => ReturnType<typeof baseCount>,
): Promise<number> {
  let q = baseCount(table, ownerEmail);
  if (filters) q = filters(q);
  const { count, error } = await q;
  if (error) {
    console.warn(`[ativacao] count ${table}:`, error.message);
    return 0;
  }
  return count ?? 0;
}

function baseCount(table: string, ownerEmail: string) {
  return supabaseAdmin
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('owner_email', ownerEmail);
}

export async function getAtivacaoResumo(
  ownerEmail: string,
  options?: { trialEndsAt?: string | null },
): Promise<AtivacaoResumo> {
  const owner = ownerEmail.toLowerCase().trim();
  const desde = trialStartIso(options?.trialEndsAt ?? null);

  const [clientes, sessoes, agendamentosPeloLink, finalizadas, entradas] = await Promise.all([
    countRows('clientes', owner),
    countRows('consultas_agenda', owner, (q) => q.is('deleted_at', null)),
    countRows('agendamentos_pendentes_drive', owner),
    countRows('consultas_agenda', owner, (q) => q.is('deleted_at', null).eq('status', 'realizado')),
    somaEntradas(owner, desde),
  ]);

  return { clientes, sessoes, agendamentosPeloLink, finalizadas, entradas };
}

async function somaEntradas(owner: string, desdeIso: string | null): Promise<number> {
  let q = supabaseAdmin
    .from('financeiro_transacoes')
    .select('valor')
    .eq('owner_email', owner)
    .eq('tipo', 'entrada')
    .limit(5000);
  if (desdeIso) q = q.gte('data', desdeIso.slice(0, 10));
  const { data, error } = await q;
  if (error || !data) return 0;
  return data.reduce((acc, row) => acc + (Number((row as { valor: unknown }).valor) || 0), 0);
}

/** Donos com sessão criada — para filtrar o lembrete de 48h em lote. */
export async function ownersComSessao(ownerEmails: string[]): Promise<Set<string>> {
  const result = new Set<string>();
  if (ownerEmails.length === 0) return result;
  const { data, error } = await supabaseAdmin
    .from('consultas_agenda')
    .select('owner_email')
    .in('owner_email', ownerEmails)
    .is('deleted_at', null)
    .limit(10000);
  if (error || !data) return result;
  for (const row of data as { owner_email: string }[]) {
    result.add(row.owner_email.toLowerCase().trim());
  }
  return result;
}

const JANELA_ATIVACAO_MS = 7 * 24 * 60 * 60 * 1000;

type PerfilAtivacaoMeta = {
  email: string;
  onboarding_completed_at: string;
  meta_fbp: string | null;
  meta_fbc: string | null;
  meta_client_ua: string | null;
};

/**
 * Evento `StartTrial` na Meta para quem teve a 1ª sessão na agenda em até 7 dias do onboarding
 * (a atribuição da Meta não passa de 7 dias). Cada conta recebe no máximo um envio.
 */
export async function enviarAtivacoesMeta(options: { dryRun: boolean }): Promise<{
  candidatas: number;
  enviadas: number;
}> {
  const desde = new Date(Date.now() - JANELA_ATIVACAO_MS).toISOString();
  const { data: perfis, error } = await supabaseAdmin
    .from('onboarding_profiles')
    .select('email, onboarding_completed_at, meta_fbp, meta_fbc, meta_client_ua')
    .eq('onboarding_completed', true)
    .gte('onboarding_completed_at', desde)
    .is('meta_ativacao_enviada_em', null)
    .limit(500);
  if (error) throw new Error(`perfis para ativação Meta: ${error.message}`);

  const lista = (perfis ?? []) as PerfilAtivacaoMeta[];
  if (lista.length === 0) return { candidatas: 0, enviadas: 0 };

  const { data: sessoes, error: sessoesError } = await supabaseAdmin
    .from('consultas_agenda')
    .select('owner_email, created_at')
    .in('owner_email', lista.map((p) => p.email))
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(10000);
  if (sessoesError) throw new Error(`sessões para ativação Meta: ${sessoesError.message}`);

  const primeiraSessao = new Map<string, string>();
  for (const s of (sessoes ?? []) as { owner_email: string; created_at: string | null }[]) {
    const owner = s.owner_email.toLowerCase().trim();
    if (s.created_at && !primeiraSessao.has(owner)) primeiraSessao.set(owner, s.created_at);
  }

  const ativadas = lista.filter((p) => primeiraSessao.has(p.email.toLowerCase().trim()));
  if (options.dryRun) return { candidatas: ativadas.length, enviadas: 0 };

  let enviadas = 0;
  for (const perfil of ativadas) {
    const email = perfil.email.toLowerCase().trim();
    const sessaoMs = new Date(primeiraSessao.get(email)!).getTime();
    const onboardingMs = new Date(perfil.onboarding_completed_at).getTime();
    const ok = await sendMetaCapiEvent({
      eventName: 'StartTrial',
      eventId: await metaCapiEventId('ativ', email),
      email,
      contentName: 'primeira_sessao',
      eventTime: new Date(Math.max(sessaoMs, onboardingMs)),
      context: {
        fbp: perfil.meta_fbp ?? undefined,
        fbc: perfil.meta_fbc ?? undefined,
        ua: perfil.meta_client_ua ?? undefined,
        sourceUrl: `${CANONICAL_APP_URL}/dashboard`,
      },
    });
    if (!ok) continue;
    enviadas++;
    await supabaseAdmin
      .from('onboarding_profiles')
      .update({ meta_ativacao_enviada_em: new Date().toISOString() })
      .eq('email', perfil.email);
  }
  return { candidatas: ativadas.length, enviadas };
}
