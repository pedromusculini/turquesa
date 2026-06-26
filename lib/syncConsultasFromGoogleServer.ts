import { supabaseAdmin } from '@/lib/supabaseClient';
import {
  reconcileGoogleVsSupabaseTime,
} from '@/lib/agendaTimeLww';
import {
  markConsultaTimeNeedsReview,
  preferCanonicalConsultaId,
  upsertConsultasAgenda,
  type ConsultaAgendaRow,
  type ConsultaSyncInput,
} from '@/lib/consultasAgenda';
import { googleCalendarItemToConsultation } from '@/lib/googleCalendarEventParse';
import { getLembretesSettings } from '@/lib/lembretesSettings';
import type { ProfissionalOption } from '@/lib/loadMedicosOptions';
import {
  getProfissionalAccessToken,
  listConnectedProfissionalIds,
} from '@/lib/profissionalGoogleCalendar';
import {
  getOwnerGoogleAccessToken,
} from '@/lib/ownerGoogleTokens';
import { resolveGoogleSubByOwnerEmail } from '@/lib/publicAgendamentoCalendar';
import { chunkForSupabaseIn } from '@/lib/supabaseQueryBatches';
import { normalizeBrazilPhone } from '@/lib/whatsapp';

type GoogleCalendarItem = {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  updated?: string;
  _profissionalId?: string;
};

type CalendarAuth = {
  accessToken: string;
  calendarId: string;
};

const MS_DAY = 24 * 60 * 60 * 1000;

function calendarEventsUrl(calendarId: string): string {
  const encoded = encodeURIComponent(calendarId);
  return `https://www.googleapis.com/calendar/v3/calendars/${encoded}/events`;
}

async function fetchCalendarEvents(
  auth: CalendarAuth,
  params: URLSearchParams,
): Promise<GoogleCalendarItem[]> {
  const res = await fetch(`${calendarEventsUrl(auth.calendarId)}?${params}`, {
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(
      (error as { error?: { message?: string } })?.error?.message ||
        'Erro ao acessar Google Calendar',
    );
  }

  const data = (await res.json()) as {
    items?: GoogleCalendarItem[];
    nextPageToken?: string;
  };
  return data.items ?? [];
}

async function fetchAllCalendarEvents(
  auth: CalendarAuth,
  baseParams: URLSearchParams,
): Promise<GoogleCalendarItem[]> {
  const allItems: GoogleCalendarItem[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams(baseParams);
    if (pageToken) params.set('pageToken', pageToken);
    const res = await fetch(`${calendarEventsUrl(auth.calendarId)}?${params}`, {
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(
        (error as { error?: { message?: string } })?.error?.message ||
          'Erro ao acessar Google Calendar',
      );
    }
    const data = (await res.json()) as {
      items?: GoogleCalendarItem[];
      nextPageToken?: string;
    };
    allItems.push(...(data.items ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return allItems;
}

function googleStartToIso(item: GoogleCalendarItem): string | null {
  const raw = item.start?.dateTime || item.start?.date;
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function googleEndToIso(item: GoogleCalendarItem): string | null {
  const raw = item.end?.dateTime || item.end?.date;
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

async function pacienteIndexByNome(
  owner: string,
  nome: string,
): Promise<{ telefone: string | null; clienteDriveId: string | null }> {
  const trimmed = nome.trim();
  if (!trimmed) return { telefone: null, clienteDriveId: null };

  const { data, error } = await supabaseAdmin
    .from('pacientes_index')
    .select('telefone_normalizado, cliente_drive_id')
    .eq('owner_email', owner)
    .ilike('nome', trimmed)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST205') return { telefone: null, clienteDriveId: null };
    throw error;
  }

  return {
    telefone: data?.telefone_normalizado ?? null,
    clienteDriveId: (data?.cliente_drive_id as string | null) ?? null,
  };
}

async function pacienteIndexByDriveId(
  owner: string,
  clienteDriveId: string,
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('pacientes_index')
    .select('telefone_normalizado')
    .eq('owner_email', owner)
    .eq('cliente_drive_id', clienteDriveId)
    .not('telefone_normalizado', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST205') return null;
    throw error;
  }
  return data?.telefone_normalizado ?? null;
}

async function loadRowsByGoogleEventId(
  owner: string,
  googleEventIds: string[],
): Promise<Map<string, ConsultaAgendaRow>> {
  const map = new Map<string, ConsultaAgendaRow>();
  if (googleEventIds.length === 0) return map;

  for (const batch of chunkForSupabaseIn(googleEventIds.filter(Boolean))) {
    const { data, error } = await supabaseAdmin
      .from('consultas_agenda')
      .select('*')
      .eq('owner_email', owner)
      .in('google_event_id', batch);

    if (error) throw error;
    for (const row of (data ?? []) as ConsultaAgendaRow[]) {
      if (!row.google_event_id) continue;
      const gid = String(row.google_event_id);
      const existing = map.get(gid);
      if (!existing) {
        map.set(gid, row);
        continue;
      }
      const keep = preferCanonicalConsultaId(existing.id, row.id);
      map.set(gid, keep === existing.id ? existing : row);
    }
  }
  return map;
}

async function loadIdByGoogleEventId(
  owner: string,
  googleEventIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (googleEventIds.length === 0) return map;

  for (const batch of chunkForSupabaseIn(googleEventIds.filter(Boolean))) {
    const { data, error } = await supabaseAdmin
      .from('consultas_agenda')
      .select('id, google_event_id')
      .eq('owner_email', owner)
      .in('google_event_id', batch);

    if (error) throw error;
    for (const row of data ?? []) {
      if (row.google_event_id) {
        const gid = String(row.google_event_id);
        const existing = map.get(gid);
        map.set(
          gid,
          existing ? preferCanonicalConsultaId(existing, String(row.id)) : String(row.id),
        );
      }
    }
  }
  return map;
}

async function enrichConsultaFromIndex(
  owner: string,
  row: ConsultaSyncInput,
): Promise<ConsultaSyncInput> {
  let telefone = row.telefone?.replace(/\D/g, '').length ? row.telefone : null;
  let clienteDriveId = row.cliente_drive_id ?? null;

  if (clienteDriveId && !telefone) {
    telefone = await pacienteIndexByDriveId(owner, clienteDriveId);
  }

  if (!telefone || !clienteDriveId) {
    const fromNome = await pacienteIndexByNome(owner, row.paciente);
    if (!telefone && fromNome.telefone) telefone = fromNome.telefone;
    if (!clienteDriveId && fromNome.clienteDriveId) clienteDriveId = fromNome.clienteDriveId;
  }

  return {
    ...row,
    telefone: telefone ? normalizeBrazilPhone(telefone) : null,
    cliente_drive_id: clienteDriveId,
  };
}

function itemToSyncInput(
  item: GoogleCalendarItem,
  profissionais: ProfissionalOption[],
  idByGoogleEvent: Map<string, string>,
  timeOverride?: { inicio: string; fim: string | null },
): ConsultaSyncInput | null {
  if (!item.id) return null;
  const inicio = timeOverride?.inicio ?? googleStartToIso(item);
  if (!inicio) return null;

  const parsed = googleCalendarItemToConsultation(item, profissionais);
  const paciente = parsed.patient?.trim();
  if (!paciente) return null;

  const id = idByGoogleEvent.get(item.id) ?? `google-${item.id}`;
  const fim = timeOverride ? timeOverride.fim : googleEndToIso(item);

  return {
    id,
    paciente,
    servico: parsed.service ?? 'Atendimento',
    telefone: parsed.telefone ?? null,
    inicio,
    fim,
    local: parsed.location ?? null,
    google_event_id: item.id,
    medico: parsed.medico ?? null,
    status: parsed.status ?? 'confirmado',
    lembretes_whatsapp: parsed.lembretesWhatsapp !== false,
    cliente_drive_id: parsed.clienteDriveId ?? null,
  };
}

export type SyncGoogleCalendarsOptions = {
  timeMin?: string;
  timeMax?: string;
  maxResults?: string;
  /** Busca todas as páginas (sync-full). */
  paginate?: boolean;
};

/**
 * Puxa eventos das agendas Google conectadas (titular + equipe) e upserta em consultas_agenda.
 * Garante que lembretes WhatsApp no dashboard incluam atendimentos de todas as profissionais.
 */
export async function syncConsultasAgendaFromGoogleCalendars(
  ownerEmail: string,
  options?: SyncGoogleCalendarsOptions,
): Promise<{ upserted: number; errors: string[] }> {
  const owner = ownerEmail.toLowerCase().trim();
  const googleErrors: string[] = [];
  const settings = await getLembretesSettings(owner);
  const maxOffset = Math.max(
    settings.lembrete_antecedencia_ativo ? settings.lembrete_antecedencia_dias : 0,
    settings.lembrete_1_dia_ativo ? 1 : 0,
    1,
  );

  const timeMin =
    options?.timeMin ?? new Date(Date.now() - 2 * MS_DAY).toISOString();
  const timeMax =
    options?.timeMax ??
    new Date(Date.now() + (maxOffset + 3) * MS_DAY).toISOString();

  const params = new URLSearchParams({
    timeMin,
    timeMax,
    maxResults: options?.maxResults ?? '250',
    singleEvents: 'true',
    orderBy: 'startTime',
  });

  const fetchItems = options?.paginate ? fetchAllCalendarEvents : fetchCalendarEvents;

  const { data: medicosRows } = await supabaseAdmin
    .from('clinica_medicos')
    .select('id, nome')
    .eq('clinica_email', owner);

  const profissionais: ProfissionalOption[] = (medicosRows ?? []).map((m) => ({
    id: m.id as string,
    nome: m.nome as string,
    agenda_google_status: null,
  }));

  const allItems: GoogleCalendarItem[] = [];
  const seen = new Set<string>();

  const connectedIds = await listConnectedProfissionalIds(owner);
  for (const profId of connectedIds) {
    try {
      const auth = await getProfissionalAccessToken(profId, owner);
      if (!auth) continue;
      const items = await fetchItems(auth, params);
      for (const item of items) {
        const key = `${profId}:${item.id}`;
        if (item.id && !seen.has(key)) {
          seen.add(key);
          allItems.push({ ...item, _profissionalId: profId });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      googleErrors.push(`profissional:${profId}: ${msg}`);
      console.warn('[syncConsultasFromGoogleServer] profissional', profId, err);
    }
  }

  const googleSub = await resolveGoogleSubByOwnerEmail(owner);
  if (googleSub) {
    try {
      const accessToken = await getOwnerGoogleAccessToken(googleSub, 'calendar');
      if (accessToken) {
        const items = await fetchItems(
          { accessToken, calendarId: 'primary' },
          params,
        );
        for (const item of items) {
          const key = `titular:${item.id}`;
          if (item.id && !seen.has(key)) {
            seen.add(key);
            allItems.push(item);
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      googleErrors.push(`titular: ${msg}`);
      console.warn('[syncConsultasFromGoogleServer] titular', err);
    }
  }

  if (allItems.length === 0) return { upserted: 0, errors: googleErrors };

  const { loadExcludedGoogleEventIds } = await import('@/lib/consultasAgendaExcluidos');
  const excluded = await loadExcludedGoogleEventIds(owner);
  const activeItems = allItems.filter((item) => item.id && !excluded.has(String(item.id)));
  if (activeItems.length === 0) return { upserted: 0, errors: googleErrors };

  const googleEventIds = activeItems.map((i) => i.id).filter(Boolean);
  const idByGoogleEvent = await loadIdByGoogleEventId(owner, googleEventIds);
  const rowsByGoogleEvent = await loadRowsByGoogleEventId(owner, googleEventIds);

  const consultas: ConsultaSyncInput[] = [];
  for (const item of activeItems) {
    if (!item.id) continue;
    try {
      const googleInicio = googleStartToIso(item);
      if (!googleInicio) continue;
      const googleFim = googleEndToIso(item);
      const googleUpdated = item.updated ?? new Date().toISOString();

      const existing = rowsByGoogleEvent.get(item.id);
      let timeOverride: { inicio: string; fim: string | null } | undefined;

      if (existing) {
        const reconcile = reconcileGoogleVsSupabaseTime({
          supabase: {
            inicio: existing.inicio,
            fim: existing.fim,
            updated_at: existing.updated_at ?? null,
          },
          google: {
            inicio: googleInicio,
            fim: googleFim,
            updated: googleUpdated,
          },
        });

        if (reconcile.action === 'needs_review') {
          await markConsultaTimeNeedsReview(
            owner,
            existing.id,
            reconcile.googleInicio,
            reconcile.googleFim,
            googleUpdated,
          );
          timeOverride = { inicio: existing.inicio, fim: existing.fim };
        } else if (reconcile.action === 'apply_google') {
          timeOverride = { inicio: reconcile.inicio, fim: reconcile.fim };
          const { error: lwwErr } = await supabaseAdmin
            .from('consultas_agenda')
            .update({
              google_updated_at: reconcile.google_updated_at,
              sync_health: null,
              conflict_google_inicio: null,
              conflict_google_fim: null,
            })
            .eq('owner_email', owner)
            .eq('id', existing.id);
          if (lwwErr && !lwwErr.message?.includes('sync_health')) {
            throw lwwErr;
          }
        } else if (reconcile.action === 'keep_supabase') {
          timeOverride = { inicio: existing.inicio, fim: existing.fim };
        }
      }

      const row = itemToSyncInput(item, profissionais, idByGoogleEvent, timeOverride);
      if (!row) continue;
      consultas.push(await enrichConsultaFromIndex(owner, row));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      googleErrors.push(`evento:${item.id}: ${msg}`);
      console.warn('[syncConsultasFromGoogleServer] evento', item.id, err);
    }
  }

  if (consultas.length === 0) return { upserted: 0, errors: googleErrors };
  const { upserted } = await upsertConsultasAgenda(owner, consultas);
  return { upserted, errors: googleErrors };
}
