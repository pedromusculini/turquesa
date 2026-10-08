/**
 * Verificação Turquesa -> Google: confere se cada sessão futura da Turquesa
 * está ativa no Google Calendar, no mesmo horário.
 *
 * Só aponta divergências; nunca corrige sozinha. Cada correção é uma decisão
 * explícita do salão (reenviar ao Google ou cancelar na Turquesa).
 */
import { supabaseAdmin } from '@/lib/supabaseClient';
import type { ConsultaAgendaRow } from '@/lib/consultasAgenda';
import { profissionalIdByNome, type ProfissionalOption } from '@/lib/loadMedicosOptions';
import { getOwnerGoogleAccessToken } from '@/lib/ownerGoogleTokens';
import {
  getProfissionalAccessToken,
  listConnectedProfissionalIds,
} from '@/lib/profissionalGoogleCalendar';
import { resolveGoogleSubByOwnerEmail } from '@/lib/publicAgendamentoCalendar';
import { shouldPushConsultaToGoogle } from '@/lib/googleCalendarTurquesaOwned';
import {
  createGoogleEvent,
  findGoogleEventBySlot,
  loadProfissionaisOptions,
  patchGoogleEventFull,
  resolveCalendarAuth,
} from '@/lib/pushConsultasToGoogleServer';
import {
  enqueueGoogleSync,
  eventContentFromRow,
  getGoogleOutboxStateByConsulta,
} from '@/lib/consultasGoogleOutbox';
import { logAgenda } from '@/lib/consultasAgendaLog';

const TITULAR = '__titular__';
const DEFAULT_DIAS = 60;
/** Sessão salva há menos que isso ainda pode estar a caminho do Google. */
const RECENT_EDIT_GRACE_MS = 3 * 60_000;
const HORARIO_TOLERANCIA_MS = 60_000;
const GET_CONCURRENCY = 6;

export type DivergenciaMotivo =
  | 'sem_evento'
  | 'evento_excluido_no_google'
  | 'evento_nao_encontrado'
  | 'horario_diferente'
  | 'agenda_sem_acesso';

export type DivergenciaGoogle = {
  id: string;
  paciente: string;
  servico: string;
  medico: string | null;
  inicio: string;
  fim: string | null;
  motivo: DivergenciaMotivo;
  googleEventId: string | null;
  googleInicio: string | null;
  /** Última alteração do evento no Google (para excluído: aproximadamente quando saiu). */
  googleAtualizadoEm: string | null;
};

export type VerificacaoGoogleResult = {
  semGoogle: boolean;
  dias: number;
  verificadas: number;
  divergencias: DivergenciaGoogle[];
  verificadoEm: string;
};

type CalendarAuth = { accessToken: string; calendarId: string };

type GoogleEventLite = {
  id: string;
  status?: string;
  updated?: string;
  start?: { dateTime?: string; date?: string };
};

type Found = { event: GoogleEventLite; calKey: string };

function calendarEventsUrl(calendarId: string, suffix = ''): string {
  return `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events${suffix}`;
}

function brStartOfToday(): Date {
  const key = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  return new Date(`${key}T00:00:00-03:00`);
}

class CalendarAuthCache {
  private cache = new Map<string, Promise<CalendarAuth | null>>();

  constructor(private owner: string) {}

  get(calKey: string): Promise<CalendarAuth | null> {
    let p = this.cache.get(calKey);
    if (!p) {
      p = this.load(calKey).catch((err) => {
        console.warn('[agendaGoogleVerificacao] token', calKey, err);
        return null;
      });
      this.cache.set(calKey, p);
    }
    return p;
  }

  private async load(calKey: string): Promise<CalendarAuth | null> {
    if (calKey !== TITULAR) return getProfissionalAccessToken(calKey, this.owner);
    const sub = await resolveGoogleSubByOwnerEmail(this.owner);
    if (!sub) return null;
    const token = await getOwnerGoogleAccessToken(sub, 'calendar');
    return token ? { accessToken: token, calendarId: 'primary' } : null;
  }
}

async function listCalendarEvents(
  auth: CalendarAuth,
  timeMin: string,
  timeMax: string,
): Promise<GoogleEventLite[]> {
  const out: GoogleEventLite[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL(calendarEventsUrl(auth.calendarId));
    url.searchParams.set('timeMin', timeMin);
    url.searchParams.set('timeMax', timeMax);
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('showDeleted', 'true');
    url.searchParams.set('maxResults', '2500');
    url.searchParams.set('fields', 'nextPageToken,items(id,status,updated,start)');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${auth.accessToken}`, Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`Google respondeu ${res.status} ao listar eventos`);
    const data = (await res.json()) as { items?: GoogleEventLite[]; nextPageToken?: string };
    out.push(...(data.items ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return out;
}

async function getEventById(
  auth: CalendarAuth,
  eventId: string,
): Promise<GoogleEventLite | null> {
  const res = await fetch(
    `${calendarEventsUrl(auth.calendarId, `/${encodeURIComponent(eventId)}`)}?fields=id,status,updated,start`,
    { headers: { Authorization: `Bearer ${auth.accessToken}`, Accept: 'application/json' } },
  );
  if (res.status === 404 || res.status === 410) return null;
  if (!res.ok) throw new Error(`Google respondeu ${res.status} ao buscar evento`);
  return (await res.json()) as GoogleEventLite;
}

function candidateCalendars(
  row: ConsultaAgendaRow,
  profissionais: ProfissionalOption[],
  connectedIds: string[],
): string[] {
  const keys = [
    row.google_profissional_id?.trim() || null,
    row.medico ? profissionalIdByNome(profissionais, row.medico) ?? null : null,
    ...connectedIds,
    TITULAR,
  ].filter((k): k is string => !!k);
  return [...new Set(keys)];
}

function classify(
  row: ConsultaAgendaRow,
  found: Found | null,
  anyAuth: boolean,
): DivergenciaGoogle | null {
  const base = {
    id: row.id,
    paciente: row.paciente,
    servico: row.servico,
    medico: row.medico,
    inicio: row.inicio,
    fim: row.fim,
    googleEventId: row.google_event_id ?? null,
    googleInicio: null as string | null,
    googleAtualizadoEm: null as string | null,
  };

  if (!row.google_event_id) return { ...base, motivo: 'sem_evento' };
  if (!found) {
    return { ...base, motivo: anyAuth ? 'evento_nao_encontrado' : 'agenda_sem_acesso' };
  }

  const ev = found.event;
  const googleInicio = ev.start?.dateTime ?? ev.start?.date ?? null;
  const withGoogle = { ...base, googleInicio, googleAtualizadoEm: ev.updated ?? null };

  if (ev.status === 'cancelled') return { ...withGoogle, motivo: 'evento_excluido_no_google' };

  if (ev.start?.dateTime) {
    const diff = Math.abs(
      new Date(ev.start.dateTime).getTime() - new Date(row.inicio).getTime(),
    );
    if (diff > HORARIO_TOLERANCIA_MS) return { ...withGoogle, motivo: 'horario_diferente' };
  }
  return null;
}

async function runPool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const item = items[i++];
      await fn(item);
    }
  });
  await Promise.all(workers);
}

async function ownerHasGoogle(owner: string, connectedIds: string[]): Promise<boolean> {
  if (connectedIds.length > 0) return true;
  return !!(await resolveGoogleSubByOwnerEmail(owner));
}

/** Localiza o evento da sessão em qualquer agenda do salão (por id). */
async function locateEvent(
  row: ConsultaAgendaRow,
  candidates: string[],
  auths: CalendarAuthCache,
  listed: Map<string, Found>,
): Promise<{ found: Found | null; anyAuth: boolean }> {
  const gid = row.google_event_id?.trim();
  if (!gid) return { found: null, anyAuth: true };
  const fromList = listed.get(gid);
  if (fromList) return { found: fromList, anyAuth: true };

  let anyAuth = false;
  for (const calKey of candidates) {
    const auth = await auths.get(calKey);
    if (!auth) continue;
    anyAuth = true;
    try {
      const ev = await getEventById(auth, gid);
      if (ev) return { found: { event: ev, calKey }, anyAuth };
    } catch (err) {
      console.warn('[agendaGoogleVerificacao] get', calKey, err);
    }
  }
  return { found: null, anyAuth };
}

export async function verificarSessoesNoGoogle(
  ownerEmail: string,
  opts?: { dias?: number },
): Promise<VerificacaoGoogleResult> {
  const owner = ownerEmail.toLowerCase().trim();
  const dias = Math.min(Math.max(opts?.dias ?? DEFAULT_DIAS, 1), 180);
  const verificadoEm = new Date().toISOString();

  const connectedIds = await listConnectedProfissionalIds(owner);
  if (!(await ownerHasGoogle(owner, connectedIds))) {
    return { semGoogle: true, dias, verificadas: 0, divergencias: [], verificadoEm };
  }

  const from = brStartOfToday();
  const to = new Date(from.getTime() + dias * 86_400_000);

  const { data, error } = await supabaseAdmin
    .from('consultas_agenda')
    .select('*')
    .eq('owner_email', owner)
    .is('deleted_at', null)
    .in('status', ['agendado', 'confirmado'])
    .gte('inicio', from.toISOString())
    .lt('inicio', to.toISOString())
    .order('inicio', { ascending: true });
  if (error) throw error;

  const outbox = await getGoogleOutboxStateByConsulta(owner);
  const nowMs = Date.now();
  const rows = ((data ?? []) as ConsultaAgendaRow[]).filter((row) => {
    if (
      !shouldPushConsultaToGoogle({
        paciente: row.paciente,
        telefone: row.telefone,
        observacoes: row.observacoes,
      })
    ) {
      return false;
    }
    if (outbox.get(String(row.id)) === 'pending') return false;
    const updatedMs = row.updated_at ? new Date(row.updated_at).getTime() : 0;
    return !(Number.isFinite(updatedMs) && nowMs - updatedMs < RECENT_EDIT_GRACE_MS);
  });

  const profissionais = await loadProfissionaisOptions(owner);
  const auths = new CalendarAuthCache(owner);

  // 1 listagem por agenda (inclui excluídos) cobre quase todas as sessões.
  const listed = new Map<string, Found>();
  const timeMin = new Date(from.getTime() - 86_400_000).toISOString();
  const timeMax = new Date(to.getTime() + 86_400_000).toISOString();
  for (const calKey of [...connectedIds, TITULAR]) {
    const auth = await auths.get(calKey);
    if (!auth) continue;
    try {
      for (const ev of await listCalendarEvents(auth, timeMin, timeMax)) {
        if (!ev.id) continue;
        const prev = listed.get(ev.id);
        // Mesmo id em duas agendas: prefere a cópia ativa.
        if (!prev || (prev.event.status === 'cancelled' && ev.status !== 'cancelled')) {
          listed.set(ev.id, { event: ev, calKey });
        }
      }
    } catch (err) {
      console.warn('[agendaGoogleVerificacao] list', calKey, err);
    }
  }

  const divergencias: DivergenciaGoogle[] = [];
  await runPool(rows, GET_CONCURRENCY, async (row) => {
    const candidates = candidateCalendars(row, profissionais, connectedIds);
    const { found, anyAuth } = await locateEvent(row, candidates, auths, listed);
    const div = classify(row, found, anyAuth);
    if (div) divergencias.push(div);
  });
  divergencias.sort((a, b) => a.inicio.localeCompare(b.inicio));

  return { semGoogle: false, dias, verificadas: rows.length, divergencias, verificadoEm };
}

async function loadActiveRow(owner: string, consultaId: string): Promise<ConsultaAgendaRow> {
  const { data, error } = await supabaseAdmin
    .from('consultas_agenda')
    .select('*')
    .eq('owner_email', owner)
    .eq('id', consultaId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Sessão não encontrada.');
  return data as ConsultaAgendaRow;
}

async function checkOne(owner: string, row: ConsultaAgendaRow) {
  const connectedIds = await listConnectedProfissionalIds(owner);
  const profissionais = await loadProfissionaisOptions(owner);
  const auths = new CalendarAuthCache(owner);
  const candidates = candidateCalendars(row, profissionais, connectedIds);
  const { found, anyAuth } = await locateEvent(row, candidates, auths, new Map());
  return { divergencia: classify(row, found, anyAuth), found, auths, profissionais };
}

/**
 * Turquesa soberana: publica a sessão no Google (ou corrige o horário lá).
 * Religa evento ativo do mesmo slot+cliente antes de criar outro (sem duplicata).
 */
export async function reenviarSessaoAoGoogle(
  ownerEmail: string,
  consultaId: string,
): Promise<{ jaEstavaOk: boolean; googleEventId: string | null }> {
  const owner = ownerEmail.toLowerCase().trim();
  const row = await loadActiveRow(owner, consultaId);
  const { divergencia, found, auths, profissionais } = await checkOne(owner, row);
  if (!divergencia) return { jaEstavaOk: true, googleEventId: row.google_event_id ?? null };

  const content = eventContentFromRow(row);
  const body = {
    summary: content.summary,
    description: content.description,
    start: content.start,
    end: content.end,
    ownerEmail: owner,
    clienteDriveId: row.cliente_drive_id ?? null,
    paciente: row.paciente,
  };
  const now = new Date().toISOString();

  if (divergencia.motivo === 'horario_diferente' && found && row.google_event_id) {
    const auth = await auths.get(found.calKey);
    if (!auth) throw new Error('Sem acesso à agenda Google onde o evento está.');
    const patched = await patchGoogleEventFull(auth, row.google_event_id, body);
    await supabaseAdmin
      .from('consultas_agenda')
      .update({ google_updated_at: patched?.updated ?? now, updated_at: now })
      .eq('owner_email', owner)
      .eq('id', row.id);
    await logAgenda(owner, {
      consultaId: row.id,
      googleEventId: row.google_event_id,
      googleProfissionalId: found.calKey === TITULAR ? null : found.calKey,
      acao: 'divergencia_reenviada',
      origem: 'verificacao_google',
      inicio: row.inicio,
      detalhe: { motivo: divergencia.motivo, horario_google_anterior: divergencia.googleInicio },
    });
    return { jaEstavaOk: false, googleEventId: row.google_event_id };
  }

  const target = await resolveCalendarAuth(owner, profissionais, row.medico, null);
  if (!target) throw new Error('Agenda Google da profissional sem acesso (reconectar).');

  const existingId = await findGoogleEventBySlot(target, row.inicio, row.paciente);
  const reusable = existingId && existingId !== row.google_event_id ? existingId : null;
  const newId = reusable ?? (await createGoogleEvent(target, body));
  if (!newId) throw new Error('Google não retornou id do evento criado.');

  const { error: upErr } = await supabaseAdmin
    .from('consultas_agenda')
    .update({
      google_event_id: newId,
      google_profissional_id: target.profissionalId ?? null,
      google_updated_at: now,
      updated_at: now,
    })
    .eq('owner_email', owner)
    .eq('id', row.id)
    .is('deleted_at', null);
  if (upErr) throw upErr;

  await logAgenda(owner, {
    consultaId: row.id,
    googleEventId: newId,
    googleProfissionalId: target.profissionalId ?? null,
    acao: 'divergencia_reenviada',
    origem: 'verificacao_google',
    inicio: row.inicio,
    detalhe: {
      motivo: divergencia.motivo,
      evento_anterior: row.google_event_id ?? null,
      religado_evento_existente: !!reusable,
    },
  });
  return { jaEstavaOk: false, googleEventId: newId };
}

/** O cancelamento no Google era intencional: cancela a sessão na Turquesa. */
export async function cancelarSessaoPelaVerificacao(
  ownerEmail: string,
  consultaId: string,
): Promise<void> {
  const owner = ownerEmail.toLowerCase().trim();
  const row = await loadActiveRow(owner, consultaId);
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('consultas_agenda')
    .update({ status: 'cancelado', updated_at: now })
    .eq('owner_email', owner)
    .eq('id', row.id)
    .is('deleted_at', null);
  if (error) throw error;

  await logAgenda(owner, {
    consultaId: row.id,
    googleEventId: row.google_event_id ?? null,
    googleProfissionalId: row.google_profissional_id ?? null,
    acao: 'divergencia_cancelada',
    origem: 'verificacao_google',
    inicio: row.inicio,
    detalhe: { status_anterior: row.status },
  });

  // Se ainda houver evento ativo no Google (ex.: horário diferente), a fila o remove.
  if (row.google_event_id) {
    await enqueueGoogleSync(owner, row.id, {
      eventId: row.google_event_id,
      profissionalId: row.google_profissional_id ?? null,
    }).catch(() => {});
  }
}
