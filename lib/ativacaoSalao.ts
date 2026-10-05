import { supabaseAdmin } from '@/lib/supabaseClient';
import { TRIAL_DAYS } from '@/lib/asaasBillingPolicy';

/** Marcos de ativação do salão (checklist do painel, resumo do trial e e-mails). */
export type AtivacaoResumo = {
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

  const [sessoes, agendamentosPeloLink, finalizadas, entradas] = await Promise.all([
    countRows('consultas_agenda', owner, (q) => q.is('deleted_at', null)),
    countRows('agendamentos_pendentes_drive', owner),
    countRows('consultas_agenda', owner, (q) => q.is('deleted_at', null).eq('status', 'realizado')),
    somaEntradas(owner, desde),
  ]);

  return { sessoes, agendamentosPeloLink, finalizadas, entradas };
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
