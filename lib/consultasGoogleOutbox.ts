/**
 * Outbox durável Agenda -> Google Calendar.
 *
 * Toda mutação de sessão (criar/editar/mover/trocar profissional/excluir) enfileira
 * uma intenção; um worker executa no Google com retry/backoff até concluir. O push
 * imediato do cliente continua para UX, mas o outbox garante que o fluxo nunca se perca.
 *
 * O item guarda apenas a intenção (`sync` | `delete`); o estado desejado é relido da
 * linha em `consultas_agenda` no momento do processamento (fonte da verdade), evitando
 * dados obsoletos após colapso de edições sucessivas.
 */
import { supabaseAdmin } from '@/lib/supabaseClient';
import type { ConsultaAgendaRow } from '@/lib/consultasAgenda';
import type { ProfissionalOption } from '@/lib/loadMedicosOptions';
import {
  createGoogleEvent,
  deleteGoogleEvent,
  loadProfissionaisOptions,
  patchGoogleEventFull,
  resolveCalendarAuth,
} from '@/lib/pushConsultasToGoogleServer';
import { listConnectedProfissionalIds } from '@/lib/profissionalGoogleCalendar';
import { resolveGoogleSubByOwnerEmail } from '@/lib/publicAgendamentoCalendar';

const OUTBOX_TABLE = 'consultas_google_outbox';
const BR_TIMEZONE = 'America/Sao_Paulo';
/** Após este nº de tentativas o badge mostra "erro" (mas o cron ainda tenta). */
const ERROR_BADGE_AFTER = 3;
/** Tentativas até marcar terminal `error` (retry manual). */
const MAX_ATTEMPTS = 15;
const DEFAULT_PROCESS_LIMIT = 25;
/**
 * Carência antes de o worker agir num `sync`: dá tempo ao push imediato do cliente
 * persistir o google_event_id, evitando criação de evento duplicado no Google.
 */
const SYNC_GRACE_MS = 45_000;

export type GoogleOutboxOp = 'sync' | 'delete';

export type GoogleOutboxRow = {
  id: string;
  owner_email: string;
  consulta_id: string;
  op: GoogleOutboxOp;
  google_event_id: string | null;
  google_profissional_id: string | null;
  source_profissional_id: string | null;
  desired: Record<string, unknown>;
  status: 'pending' | 'processing' | 'done' | 'error';
  attempts: number;
  next_retry_at: string;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export type GoogleOutboxBadgeState = 'pending' | 'error';

function isOutboxTableMissing(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  return (
    e?.code === 'PGRST205' ||
    e?.code === '42P01' ||
    !!e?.message?.includes(OUTBOX_TABLE)
  );
}

function backoffMs(attempts: number): number {
  // 30s, 2m, 10m, 30m, 2h, 6h, depois teto de 12h
  const ladder = [30_000, 120_000, 600_000, 1_800_000, 7_200_000, 21_600_000];
  return ladder[Math.min(attempts, ladder.length - 1)] ?? 43_200_000;
}

/**
 * Enfileira intenção de sync (create/update/move decidido no processamento).
 *
 * `source` guarda o vínculo Google que existia ANTES desta edição (evento + agenda
 * da profissional). Se a edição trocar a profissional, o worker usa isso para
 * remover o evento antigo na agenda de origem — mesmo que o push imediato do
 * cliente já tenha religado a linha para a nova profissional (senão o evento
 * antigo ficava órfão no Google).
 */
export async function enqueueGoogleSync(
  ownerEmail: string,
  consultaId: string,
  source?: { eventId?: string | null; profissionalId?: string | null },
): Promise<void> {
  await enqueueOutboxItem(ownerEmail, consultaId, {
    op: 'sync',
    google_event_id: source?.eventId ?? null,
    source_profissional_id: source?.profissionalId ?? null,
  });
}

/** Enfileira remoção do evento no Google (após soft-delete da sessão). */
export async function enqueueGoogleDelete(
  ownerEmail: string,
  consultaId: string,
  googleEventId: string | null,
  sourceProfissionalId: string | null,
): Promise<void> {
  if (!googleEventId) return;
  await enqueueOutboxItem(ownerEmail, consultaId, {
    op: 'delete',
    google_event_id: googleEventId,
    source_profissional_id: sourceProfissionalId,
  });
}

async function enqueueOutboxItem(
  ownerEmail: string,
  consultaId: string,
  data: {
    op: GoogleOutboxOp;
    google_event_id?: string | null;
    source_profissional_id?: string | null;
  },
): Promise<void> {
  const owner = ownerEmail.toLowerCase().trim();
  const id = String(consultaId).trim();
  if (!owner || !id) return;
  const now = new Date().toISOString();
  // Delete age imediato; sync espera a carência para o push do cliente vencer.
  const nextRetry =
    data.op === 'delete'
      ? now
      : new Date(Date.now() + SYNC_GRACE_MS).toISOString();

  try {
    // Colapsa: substitui item ativo (pending/processing) da mesma consulta.
    const { data: existing } = await supabaseAdmin
      .from(OUTBOX_TABLE)
      .select('id, op, google_event_id, source_profissional_id')
      .eq('owner_email', owner)
      .eq('consulta_id', id)
      .in('status', ['pending', 'processing'])
      .maybeSingle();

    if (existing?.id) {
      // Em colapso de sync→sync, preserva a origem já capturada (o estado Google
      // ANTES da 1ª edição desta rodada). Edições seguintes já enxergam a linha
      // religada e sobrescreveriam a origem com a agenda nova, perdendo o órfão.
      const isSync = data.op === 'sync';
      const nextEventId = isSync
        ? existing.google_event_id ?? data.google_event_id ?? null
        : data.google_event_id ?? null;
      const nextSourceProf = isSync
        ? existing.source_profissional_id ?? data.source_profissional_id ?? null
        : data.source_profissional_id ?? null;
      await supabaseAdmin
        .from(OUTBOX_TABLE)
        .update({
          op: data.op,
          google_event_id: nextEventId,
          source_profissional_id: nextSourceProf,
          status: 'pending',
          attempts: 0,
          next_retry_at: nextRetry,
          last_error: null,
          updated_at: now,
        })
        .eq('id', existing.id);
      return;
    }

    await supabaseAdmin.from(OUTBOX_TABLE).insert({
      owner_email: owner,
      consulta_id: id,
      op: data.op,
      google_event_id: data.google_event_id ?? null,
      source_profissional_id: data.source_profissional_id ?? null,
      status: 'pending',
      attempts: 0,
      next_retry_at: nextRetry,
      updated_at: now,
    });
  } catch (err) {
    if (isOutboxTableMissing(err)) return; // schema ainda não aplicado — não bloqueia mutação
    console.warn('[googleOutbox] enqueue falhou', id, err);
  }
}

async function ownerHasGoogle(owner: string): Promise<boolean> {
  try {
    if ((await listConnectedProfissionalIds(owner)).length > 0) return true;
  } catch {
    /* ignore */
  }
  return !!(await resolveGoogleSubByOwnerEmail(owner));
}

function eventContentFromRow(row: ConsultaAgendaRow) {
  const serviceLabel = row.servico?.trim() || 'Atendimento';
  const start = row.inicio;
  const end =
    row.fim && new Date(row.fim).getTime() > new Date(row.inicio).getTime()
      ? row.fim
      : new Date(new Date(row.inicio).getTime() + 30 * 60_000).toISOString();
  const summary = `${serviceLabel} - ${row.paciente}`;
  const description = [
    `Cliente: ${row.paciente}`,
    `Serviço: ${serviceLabel}`,
    row.medico ? `Profissional: ${row.medico}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  return { start, end, summary, description, serviceLabel };
}

async function applyGoogleLink(
  owner: string,
  consultaId: string,
  googleEventId: string,
  profissionalId: string | null,
  googleUpdatedAt?: string,
): Promise<void> {
  await supabaseAdmin
    .from('consultas_agenda')
    .update({
      google_event_id: googleEventId,
      google_profissional_id: profissionalId,
      google_updated_at: googleUpdatedAt ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('owner_email', owner)
    .eq('id', consultaId);
}

/**
 * Remove um evento na agenda da profissional de ORIGEM.
 *
 * Estrito: se a origem é uma profissional específica e não conseguimos resolver
 * o calendário dela (token/conexão), lança erro em vez de cair no calendário
 * titular — apagar no calendário errado dá 404 "falso-ok" e deixa o evento
 * antigo órfão. Falhar aqui faz o item repetir (retry/backoff) até limpar.
 */
async function deleteEventFromSource(
  owner: string,
  profissionais: ProfissionalOption[],
  sourceProfId: string | null,
  eventId: string,
): Promise<void> {
  const auth = await resolveCalendarAuth(owner, profissionais, null, sourceProfId);
  if (sourceProfId && (!auth || auth.profissionalId !== sourceProfId)) {
    throw new Error(
      'Agenda Google da profissional de origem indisponível para remover o evento antigo.',
    );
  }
  if (auth) await deleteGoogleEvent(auth, eventId); // idempotente (404/410 = ok)
}

/** Executa a op de sync (create/update/move) para uma linha ativa. */
async function processSyncItem(
  owner: string,
  item: GoogleOutboxRow,
): Promise<'done' | 'skip'> {
  const { data: row } = await supabaseAdmin
    .from('consultas_agenda')
    .select('*')
    .eq('owner_email', owner)
    .eq('id', item.consulta_id)
    .maybeSingle();

  const consulta = row as ConsultaAgendaRow | null;
  if (!consulta) return 'done'; // linha sumiu — nada a sincronizar

  const profissionais = await loadProfissionaisOptions(owner);
  // Vínculo Google que existia antes desta edição (para limpar órfão de troca).
  const sourceEventId = item.google_event_id?.trim() || null;
  const sourceProfId = item.source_profissional_id ?? null;

  // Sessão excluída/cancelada -> remover do Google se houver link.
  if (consulta.deleted_at || consulta.status === 'cancelado') {
    if (consulta.google_event_id) {
      const auth = await resolveCalendarAuth(
        owner,
        profissionais,
        consulta.medico,
        consulta.google_profissional_id,
      );
      if (auth) await deleteGoogleEvent(auth, consulta.google_event_id);
    }
    if (sourceEventId && sourceEventId !== consulta.google_event_id) {
      await deleteEventFromSource(owner, profissionais, sourceProfId, sourceEventId).catch(
        (err) => console.warn('[googleOutbox] limpeza de órfão (cancelado) falhou', err),
      );
    }
    return 'done';
  }

  if (!(await ownerHasGoogle(owner))) return 'skip'; // salão sem Google — nada a fazer

  const targetAuth = await resolveCalendarAuth(
    owner,
    profissionais,
    consulta.medico,
    // sem forçar prof salvo: resolve pela profissional atual (detecta troca de agenda)
    null,
  );
  if (!targetAuth) {
    throw new Error('Agenda Google da profissional indisponível (token/conexão).');
  }

  const content = eventContentFromRow(consulta);
  const targetProf = targetAuth.profissionalId ?? null;
  const linkedEventId = consulta.google_event_id?.trim() || null;
  const linkedProf = consulta.google_profissional_id ?? null;

  const createBody = {
    summary: content.summary,
    description: content.description,
    start: content.start,
    end: content.end,
    ownerEmail: owner,
    clienteDriveId: consulta.cliente_drive_id ?? null,
    paciente: consulta.paciente,
  };

  let finalEventId: string;

  if (!linkedEventId) {
    // Sem evento vinculado -> cria no destino.
    const newId = await createGoogleEvent(targetAuth, createBody);
    if (!newId) throw new Error('Google não retornou id do evento criado.');
    await applyGoogleLink(owner, consulta.id, newId, targetProf);
    finalEventId = newId;
  } else if (linkedProf !== targetProf) {
    // Troca de agenda: cria no destino, religa e remove o antigo na origem.
    const newId = await createGoogleEvent(targetAuth, createBody);
    if (!newId) throw new Error('Google não retornou id do evento (move).');
    await applyGoogleLink(owner, consulta.id, newId, targetProf);
    finalEventId = newId;
    await deleteEventFromSource(owner, profissionais, linkedProf, linkedEventId);
  } else {
    // Mesma agenda: PATCH in-place mantendo o google_event_id.
    const patched = await patchGoogleEventFull(targetAuth, linkedEventId, createBody);
    await applyGoogleLink(owner, consulta.id, linkedEventId, targetProf, patched?.updated);
    finalEventId = linkedEventId;
  }

  // Rede de segurança: se o push do cliente já religou a linha para a nova agenda
  // mas NÃO removeu o evento antigo (troca de profissional), a origem capturada
  // no enqueue ainda aponta o órfão — remove agora. Idempotente (404 = ok).
  if (
    sourceEventId &&
    sourceEventId !== finalEventId &&
    sourceEventId !== linkedEventId
  ) {
    await deleteEventFromSource(owner, profissionais, sourceProfId, sourceEventId);
  }

  return 'done';
}

async function processDeleteItem(
  owner: string,
  item: GoogleOutboxRow,
): Promise<'done'> {
  const gid = item.google_event_id;
  if (!gid) return 'done';
  const auth = await resolveCalendarAuth(
    owner,
    await loadProfissionaisOptions(owner),
    null,
    item.source_profissional_id,
  );
  if (auth) {
    await deleteGoogleEvent(auth, gid); // idempotente (404/410 = ok)
  }
  return 'done';
}

async function finishItemSuccess(itemId: string): Promise<void> {
  // Remove itens concluídos (histórico não é necessário; badge lê só ativos).
  await supabaseAdmin.from(OUTBOX_TABLE).delete().eq('id', itemId);
}

async function finishItemFailure(
  item: GoogleOutboxRow,
  message: string,
): Promise<void> {
  const attempts = (item.attempts ?? 0) + 1;
  const terminal = attempts >= MAX_ATTEMPTS;
  await supabaseAdmin
    .from(OUTBOX_TABLE)
    .update({
      status: terminal ? 'error' : 'pending',
      attempts,
      next_retry_at: new Date(Date.now() + backoffMs(attempts)).toISOString(),
      last_error: message.slice(0, 500),
      updated_at: new Date().toISOString(),
    })
    .eq('id', item.id);
}

export type ProcessOutboxResult = {
  processed: number;
  done: number;
  failed: number;
  skipped: number;
};

/** Processa itens vencidos (poll/load: owner específico; cron: todos). */
export async function processDueGoogleOutbox(opts?: {
  ownerEmail?: string | null;
  limit?: number;
}): Promise<ProcessOutboxResult> {
  const result: ProcessOutboxResult = {
    processed: 0,
    done: 0,
    failed: 0,
    skipped: 0,
  };
  const limit = opts?.limit ?? DEFAULT_PROCESS_LIMIT;
  const nowIso = new Date().toISOString();

  let query = supabaseAdmin
    .from(OUTBOX_TABLE)
    .select('*')
    .eq('status', 'pending')
    .lte('next_retry_at', nowIso)
    .order('next_retry_at', { ascending: true })
    .limit(limit);

  if (opts?.ownerEmail) {
    query = query.eq('owner_email', opts.ownerEmail.toLowerCase().trim());
  }

  let items: GoogleOutboxRow[] = [];
  try {
    const { data, error } = await query;
    if (error) throw error;
    items = (data ?? []) as GoogleOutboxRow[];
  } catch (err) {
    if (isOutboxTableMissing(err)) return result;
    throw err;
  }

  for (const item of items) {
    result.processed += 1;
    const owner = item.owner_email;
    // Lock otimista.
    const { data: claimed } = await supabaseAdmin
      .from(OUTBOX_TABLE)
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', item.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();
    if (!claimed) continue; // outro worker pegou

    try {
      const outcome =
        item.op === 'delete'
          ? await processDeleteItem(owner, item)
          : await processSyncItem(owner, item);
      if (outcome === 'skip') {
        // Sem Google configurado: encerra sem erro (não reprocessa).
        await finishItemSuccess(item.id);
        result.skipped += 1;
      } else {
        await finishItemSuccess(item.id);
        result.done += 1;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao sincronizar com Google';
      await finishItemFailure(item, message);
      result.failed += 1;
    }
  }

  return result;
}

/** Mapa consulta_id -> estado do outbox (para badge da agenda). */
export async function getGoogleOutboxStateByConsulta(
  ownerEmail: string,
): Promise<Map<string, GoogleOutboxBadgeState>> {
  const owner = ownerEmail.toLowerCase().trim();
  const map = new Map<string, GoogleOutboxBadgeState>();
  try {
    const { data, error } = await supabaseAdmin
      .from(OUTBOX_TABLE)
      .select('consulta_id, status, attempts, op')
      .eq('owner_email', owner)
      .in('status', ['pending', 'processing', 'error']);
    if (error) throw error;
    for (const r of data ?? []) {
      if (r.op === 'delete') continue; // remoção não precisa de badge na sessão
      const state: GoogleOutboxBadgeState =
        r.status === 'error' || (r.attempts ?? 0) >= ERROR_BADGE_AFTER
          ? 'error'
          : 'pending';
      map.set(String(r.consulta_id), state);
    }
  } catch (err) {
    if (isOutboxTableMissing(err)) return map;
    console.warn('[googleOutbox] getState falhou', err);
  }
  return map;
}

/** Reencaixa itens em erro para retry imediato (botão "reenviar"). */
export async function retryGoogleOutbox(
  ownerEmail: string,
  consultaId?: string,
): Promise<number> {
  const owner = ownerEmail.toLowerCase().trim();
  const now = new Date().toISOString();
  let query = supabaseAdmin
    .from(OUTBOX_TABLE)
    .update({ status: 'pending', attempts: 0, next_retry_at: now, updated_at: now })
    .eq('owner_email', owner)
    .eq('status', 'error');
  if (consultaId) query = query.eq('consulta_id', consultaId);
  try {
    const { data, error } = await query.select('id');
    if (error) throw error;
    return data?.length ?? 0;
  } catch (err) {
    if (isOutboxTableMissing(err)) return 0;
    throw err;
  }
}
