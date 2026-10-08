/**
 * Log de agendamento (Turquesa + Google) — histórico por sessão para auditoria.
 *
 * Nunca lança: falha de log não pode bloquear salvar/excluir/sincronizar.
 * Sem dados pessoais da cliente (LGPD): só ids, horário, ação, origem e erro.
 */
import { supabaseAdmin } from '@/lib/supabaseClient';

const LOG_TABLE = 'consultas_agenda_log';
const RETENTION_DAYS = 90;

export type AgendaLogAcao =
  | 'sessao_criada'
  | 'sessao_editada'
  | 'sessao_excluida'
  | 'duplicata_removida'
  | 'google_criado'
  | 'google_atualizado'
  | 'google_excluido'
  | 'google_erro'
  | 'divergencia_reenviada'
  | 'divergencia_cancelada';

export type AgendaLogOrigem =
  | 'usuario'
  | 'agenda_navegador'
  | 'fila_google'
  | 'sincronizar_tudo'
  | 'limpeza_duplicatas'
  | 'excluir_sessao'
  | 'verificacao_google';

export type AgendaLogEntry = {
  consultaId?: string | null;
  googleEventId?: string | null;
  googleProfissionalId?: string | null;
  acao: AgendaLogAcao;
  origem: AgendaLogOrigem;
  inicio?: string | null;
  detalhe?: Record<string, unknown>;
};

export type AgendaLogRow = {
  id: string;
  consulta_id: string | null;
  google_event_id: string | null;
  google_profissional_id: string | null;
  acao: AgendaLogAcao;
  origem: AgendaLogOrigem;
  inicio: string | null;
  detalhe: Record<string, unknown>;
  created_at: string;
};

function isLogTableMissing(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  return (
    err.code === 'PGRST205' ||
    err.code === '42P01' ||
    !!err.message?.includes(LOG_TABLE)
  );
}

function toIsoOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export async function logAgenda(
  ownerEmail: string,
  entries: AgendaLogEntry | AgendaLogEntry[],
): Promise<void> {
  const owner = ownerEmail.toLowerCase().trim();
  const list = Array.isArray(entries) ? entries : [entries];
  if (!owner || list.length === 0) return;

  const rows = list.map((e) => ({
    owner_email: owner,
    consulta_id: e.consultaId ? String(e.consultaId) : null,
    google_event_id: e.googleEventId?.trim() || null,
    google_profissional_id: e.googleProfissionalId?.trim() || null,
    acao: e.acao,
    origem: e.origem,
    inicio: toIsoOrNull(e.inicio),
    detalhe: e.detalhe ?? {},
  }));

  try {
    const { error } = await supabaseAdmin.from(LOG_TABLE).insert(rows);
    if (error && !isLogTableMissing(error)) {
      console.warn('[agendaLog] insert falhou', error.message);
    }
  } catch (err) {
    console.warn('[agendaLog] insert falhou', err);
  }
}

/** Histórico de uma sessão: pelo id e pelos eventos Google que ela já teve. */
export async function listAgendaLogForConsulta(
  ownerEmail: string,
  consultaId: string,
  limit = 100,
): Promise<AgendaLogRow[]> {
  const owner = ownerEmail.toLowerCase().trim();
  const id = String(consultaId).trim();
  if (!owner || !id) return [];

  const select =
    'id, consulta_id, google_event_id, google_profissional_id, acao, origem, inicio, detalhe, created_at';

  const { data: byId, error } = await supabaseAdmin
    .from(LOG_TABLE)
    .select(select)
    .eq('owner_email', owner)
    .eq('consulta_id', id)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    if (isLogTableMissing(error)) return [];
    throw error;
  }

  const rows = (byId ?? []) as AgendaLogRow[];
  const gids = [
    ...new Set(rows.map((r) => r.google_event_id).filter((g): g is string => !!g)),
  ];
  if (gids.length === 0) return rows;

  // Ações no Google feitas sem consulta_id (ex.: exclusão pelo navegador).
  const { data: byGid } = await supabaseAdmin
    .from(LOG_TABLE)
    .select(select)
    .eq('owner_email', owner)
    .in('google_event_id', gids)
    .order('created_at', { ascending: false })
    .limit(limit);

  const seen = new Set(rows.map((r) => r.id));
  for (const r of (byGid ?? []) as AgendaLogRow[]) {
    if (!seen.has(r.id)) rows.push(r);
  }
  rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return rows.slice(0, limit);
}

export async function purgeOldAgendaLog(): Promise<void> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString();
  try {
    const { error } = await supabaseAdmin.from(LOG_TABLE).delete().lt('created_at', cutoff);
    if (error && !isLogTableMissing(error)) {
      console.warn('[agendaLog] purge falhou', error.message);
    }
  } catch (err) {
    console.warn('[agendaLog] purge falhou', err);
  }
}
