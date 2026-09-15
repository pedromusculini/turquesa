import { supabaseAdmin } from '@/lib/supabaseClient';
import {
  reconcileGoogleVsSupabaseTime,
} from '@/lib/agendaTimeLww';
import { professionalGoogleEventNeedsPatch } from '@/lib/calendarInvite';
import {
  markConsultaTimeNeedsReview,
  preferCanonicalConsultaId,
  upsertConsultasAgenda,
  consultaRowsSamePatientSlot,
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
import {
  enrichConsultaSyncInput,
  loadPacienteEnrichmentIndex,
  promoteCadastroMatchedGoogleBloqueiosForOwner,
  promoteGoogleImportIfCadastroCliente,
} from '@/lib/agendaSyncHealth';
import { pushFichaLinkToGoogleImport } from '@/lib/googleCalendarAnamneseBackfill';
import {
  GOOGLE_PESSOAL_BLOQUEIO_MARKER,
  googleEventDescriptionHasTurquesaCliente,
  googleImportMatchedCadastroCliente,
  isGooglePessoalBloqueioObservacoes,
  shouldImportGoogleCalendarItemAsConsulta,
} from '@/lib/googleCalendarTurquesaOwned';

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
      .in('google_event_id', batch)
      .is('deleted_at', null);

    if (error) {
      if (error.message?.includes('deleted_at')) {
        const fallback = await supabaseAdmin
          .from('consultas_agenda')
          .select('*')
          .eq('owner_email', owner)
          .in('google_event_id', batch);
        if (fallback.error) throw fallback.error;
        for (const row of (fallback.data ?? []) as ConsultaAgendaRow[]) {
          if (row.deleted_at || !row.google_event_id) continue;
          const gid = String(row.google_event_id);
          const existing = map.get(gid);
          if (!existing) {
            map.set(gid, row);
            continue;
          }
          const keep = preferCanonicalConsultaId(existing.id, row.id);
          map.set(gid, keep === existing.id ? existing : row);
        }
        continue;
      }
      throw error;
    }
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
  const isPessoal = !googleEventDescriptionHasTurquesaCliente(item.description);

  return {
    id,
    paciente,
    servico: parsed.service ?? (isPessoal ? 'Bloqueio' : 'Atendimento'),
    telefone: parsed.telefone ?? null,
    inicio,
    fim,
    local: parsed.location ?? null,
    google_event_id: item.id,
    google_profissional_id: item._profissionalId ?? null,
    medico: parsed.medico ?? null,
    status: parsed.status ?? 'confirmado',
    lembretes_whatsapp: isPessoal ? false : parsed.lembretesWhatsapp !== false,
    cliente_drive_id: parsed.clienteDriveId ?? null,
    observacoes: isPessoal
      ? GOOGLE_PESSOAL_BLOQUEIO_MARKER
      : undefined,
  };
}

async function promoteBloqueiosAndPushFichaLinks(owner: string): Promise<void> {
  try {
    const promoted = await promoteCadastroMatchedGoogleBloqueiosForOwner(owner);
    for (const row of promoted) {
      await pushFichaLinkToGoogleImport({
        ownerEmail: owner,
        googleEventId: row.googleEventId,
        clienteDriveId: row.clienteDriveId,
        nomeCliente: row.nomeCliente,
        medico: row.medico,
        profissionalId: row.profissionalId,
      });
    }
  } catch (err) {
    console.warn('[syncConsultasFromGoogleServer] promote cadastro:', err);
  }
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
  const profResults = await Promise.all(
    connectedIds.map(async (profId) => {
      try {
        const auth = await getProfissionalAccessToken(profId, owner);
        if (!auth) return { items: [] as GoogleCalendarItem[], error: null as string | null };
        const items = await fetchItems(auth, params);
        return {
          items: items.map((item) => ({ ...item, _profissionalId: profId })),
          error: null as string | null,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn('[syncConsultasFromGoogleServer] profissional', profId, err);
        return {
          items: [] as GoogleCalendarItem[],
          error: `profissional:${profId}: ${msg}`,
        };
      }
    }),
  );

  for (const result of profResults) {
    if (result.error) googleErrors.push(result.error);
    for (const item of result.items) {
      const key = `${item._profissionalId}:${item.id}`;
      if (item.id && !seen.has(key)) {
        seen.add(key);
        allItems.push(item);
      }
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
  const pacienteIndex = await loadPacienteEnrichmentIndex(owner);

  // Sessões Turquesa ativas na janela — bloqueio pessoal com o mesmo cliente+horário
  // não deve criar segunda linha (fantasma após exclusão / dedupe na UI).
  const { data: activeSessionRows } = await supabaseAdmin
    .from('consultas_agenda')
    .select('id, paciente, telefone, medico, inicio, observacoes, google_event_id')
    .eq('owner_email', owner)
    .is('deleted_at', null)
    .gte('inicio', timeMin)
    .lte('inicio', timeMax);
  const turquesaSessions = ((activeSessionRows ?? []) as ConsultaAgendaRow[]).filter(
    (r) => !isGooglePessoalBloqueioObservacoes(r.observacoes),
  );

  const recentlyDeletedQuery = await supabaseAdmin
    .from('consultas_agenda')
    .select(
      'id, paciente, telefone, medico, inicio, observacoes, google_event_id, deleted_at',
    )
    .eq('owner_email', owner)
    .not('deleted_at', 'is', null)
    .gte('inicio', timeMin)
    .lte('inicio', timeMax);
  if (
    recentlyDeletedQuery.error &&
    !recentlyDeletedQuery.error.message?.includes('deleted_at')
  ) {
    throw recentlyDeletedQuery.error;
  }
  const recentlyDeletedSlots = (
    (recentlyDeletedQuery.data ?? []) as ConsultaAgendaRow[]
  ).filter((r) => {
    if (!r.deleted_at) return false;
    const deletedMs = new Date(r.deleted_at).getTime();
    return (
      Number.isFinite(deletedMs) &&
      Date.now() - deletedMs < 48 * 60 * 60 * 1000
    );
  });

  const consultas: ConsultaSyncInput[] = [];
  const fichaLinkTargets: ConsultaSyncInput[] = [];
  for (const item of activeItems) {
    if (!item.id) continue;
    try {
      const googleInicio = googleStartToIso(item);
      if (!googleInicio) continue;
      const googleFim = googleEndToIso(item);
      const googleUpdated = item.updated ?? new Date().toISOString();

      const existing = rowsByGoogleEvent.get(item.id) ?? null;

      if (!existing) {
        const parsedProbe = googleCalendarItemToConsultation(item, profissionais);
        const probe = {
          inicio: googleInicio,
          medico: parsedProbe.medico ?? null,
          paciente: parsedProbe.patient ?? null,
          telefone: parsedProbe.telefone ?? null,
        };
        const deletedSameSlot = recentlyDeletedSlots.some((row) =>
          consultaRowsSamePatientSlot(probe, row),
        );
        if (deletedSameSlot) continue;
      }

      // Importa sessões Turquesa e bloqueios pessoais (ocupação na grade).
      // Bloqueios não levam marcador Cliente:; o outbox não os apaga/reescreve.
      if (
        !shouldImportGoogleCalendarItemAsConsulta({
          description: item.description,
          alreadyLinkedInTurquesa: !!existing,
        })
      ) {
        continue;
      }

      const isPessoalBloqueio =
        !googleEventDescriptionHasTurquesaCliente(item.description);
      if (isPessoalBloqueio && !existing) {
        const parsedProbe = googleCalendarItemToConsultation(item, profissionais);
        const probe = {
          inicio: googleInicio,
          medico: parsedProbe.medico ?? null,
          paciente: parsedProbe.patient ?? null,
          telefone: parsedProbe.telefone ?? null,
        };
        const overlapsSession = turquesaSessions.some((s) =>
          consultaRowsSamePatientSlot(probe, s),
        );
        if (overlapsSession) continue;
      }

      let timeOverride: { inicio: string; fim: string | null } | undefined;

      // Remarcação leftover/adoção no pull foi desligada: em lotes mensais
      // (Carol/Vanessa/Vania) soft-deletava sessões e roubava google_event_id.
      // Ghosts de remarcação real ficam a cargo do upsert Turquesa
      // (pruneAbandonedSlotsAfterReschedule / pruneSamePatientSlotDuplicates).

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

      // LWW de serviço: não sobrescrever anotação mais recente do Supabase com Google atrasado.
      if (existing?.servico?.trim() && existing.updated_at) {
        const supabaseMs = new Date(existing.updated_at).getTime();
        const googleMs = new Date(googleUpdated).getTime();
        if (
          !Number.isNaN(supabaseMs) &&
          !Number.isNaN(googleMs) &&
          supabaseMs >= googleMs
        ) {
          row.servico = existing.servico;
          if (existing.observacoes?.trim()) {
            row.observacoes = existing.observacoes;
          }
        }
      }

      const incoming = enrichConsultaSyncInput(row, pacienteIndex);
      const promoted = promoteGoogleImportIfCadastroCliente(incoming);
      consultas.push(promoted);
      const markerBefore = isGooglePessoalBloqueioObservacoes(
        existing?.observacoes ?? incoming.observacoes,
      );
      const needsFichaLink = professionalGoogleEventNeedsPatch({
        description: item.description,
        location: item.location,
        expectAnamnese: true,
      });
      if (
        (markerBefore || needsFichaLink) &&
        googleImportMatchedCadastroCliente(promoted) &&
        promoted.google_event_id &&
        promoted.cliente_drive_id
      ) {
        fichaLinkTargets.push(promoted);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      googleErrors.push(`evento:${item.id}: ${msg}`);
      console.warn('[syncConsultasFromGoogleServer] evento', item.id, err);
    }
  }

  if (consultas.length === 0) {
    await promoteBloqueiosAndPushFichaLinks(owner);
    return { upserted: 0, errors: googleErrors };
  }
  const { upserted } = await upsertConsultasAgenda(owner, consultas);
  await promoteBloqueiosAndPushFichaLinks(owner);
  for (const row of fichaLinkTargets) {
    await pushFichaLinkToGoogleImport({
      ownerEmail: owner,
      googleEventId: row.google_event_id,
      clienteDriveId: row.cliente_drive_id,
      nomeCliente: row.paciente,
      medico: row.medico,
      profissionalId: row.google_profissional_id,
    });
  }
  return { upserted, errors: googleErrors };
}
