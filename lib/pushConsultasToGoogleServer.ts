import { buildProfessionalGoogleEventPayload } from '@/lib/calendarInvite';
import { enrichProfessionalCalendarEvent } from '@/lib/professionalCalendarAnamnese';
import {
  agendaWindowTimeMin,
  agendaWindowTimeMax,
} from '@/lib/consultations';
import {
  consultaRowsSameSlot,
  type ConsultaAgendaRow,
} from '@/lib/consultasAgenda';
import { profissionalIdByNome, type ProfissionalOption } from '@/lib/loadMedicosOptions';
import { getOwnerGoogleAccessToken } from '@/lib/ownerGoogleTokens';
import {
  getProfissionalAccessToken,
  listConnectedProfissionalIds,
} from '@/lib/profissionalGoogleCalendar';
import { resolveGoogleSubByOwnerEmail } from '@/lib/publicAgendamentoCalendar';
import { supabaseAdmin } from '@/lib/supabaseClient';

const BR_TIMEZONE = 'America/Sao_Paulo';
const MAX_PUSH_PER_SYNC = 40;

type CalendarAuth = {
  accessToken: string;
  calendarId: string;
  profissionalId?: string;
};

function calendarEventsUrl(calendarId: string): string {
  const encoded = encodeURIComponent(calendarId);
  return `https://www.googleapis.com/calendar/v3/calendars/${encoded}/events`;
}

async function resolveCalendarAuth(
  owner: string,
  profissionais: ProfissionalOption[],
  medico: string | null,
): Promise<CalendarAuth | null> {
  const profId = medico ? profissionalIdByNome(profissionais, medico) : undefined;
  if (profId) {
    const prof = await getProfissionalAccessToken(profId, owner);
    if (prof) return { ...prof, profissionalId: profId };
  }

  const googleSub = await resolveGoogleSubByOwnerEmail(owner);
  if (!googleSub) return null;
  const accessToken = await getOwnerGoogleAccessToken(googleSub, 'calendar');
  if (!accessToken) return null;
  return { accessToken, calendarId: 'primary' };
}

function hasGoogleLinkedSlot(
  row: ConsultaAgendaRow,
  withGoogle: ConsultaAgendaRow[],
): boolean {
  return withGoogle.some(
    (other) =>
      other.id !== row.id &&
      other.google_event_id &&
      consultaRowsSameSlot(row, other),
  );
}

async function createGoogleEvent(
  auth: CalendarAuth,
  body: {
    summary: string;
    description: string;
    start: string;
    end: string;
    ownerEmail: string;
    clienteDriveId: string | null;
    paciente: string;
  },
): Promise<string | null> {
  const enriched = await enrichProfessionalCalendarEvent({
    description: body.description,
    ownerEmail: body.ownerEmail,
    clienteDriveId: body.clienteDriveId,
    nomeCliente: body.paciente,
  });

  const eventBody = buildProfessionalGoogleEventPayload({
    summary: body.summary,
    description: enriched.description,
    start: body.start,
    end: body.end,
    timeZone: BR_TIMEZONE,
    anamneseUrl: enriched.anamneseUrl,
  });

  const res = await fetch(
    `${calendarEventsUrl(auth.calendarId)}?sendUpdates=none`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventBody),
    },
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { error?: { message?: string } })?.error?.message ||
        'Erro ao criar evento no Google Calendar',
    );
  }

  const data = (await res.json()) as { id?: string };
  return data.id ?? null;
}

async function patchGoogleEventTime(
  auth: CalendarAuth,
  googleEventId: string,
  start: string,
  end: string,
): Promise<{ updated?: string } | null> {
  const eventBody = {
    start: { dateTime: start, timeZone: BR_TIMEZONE },
    end: { dateTime: end, timeZone: BR_TIMEZONE },
  };

  const res = await fetch(
    `${calendarEventsUrl(auth.calendarId)}/${encodeURIComponent(googleEventId)}?sendUpdates=none`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventBody),
    },
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { error?: { message?: string } })?.error?.message ||
        'Erro ao atualizar horário no Google Calendar',
    );
  }

  return (await res.json()) as { updated?: string };
}

/**
 * Atualiza inicio/fim de um evento Google já vinculado (Fase 5).
 * Chamado em background após PATCH no Supabase.
 */
export async function pushConsultaTimeToGoogle(
  ownerEmail: string,
  row: ConsultaAgendaRow,
): Promise<void> {
  const owner = ownerEmail.toLowerCase().trim();
  const googleEventId = row.google_event_id?.trim();
  if (!googleEventId) return;

  const { data: medicosRows } = await supabaseAdmin
    .from('clinica_medicos')
    .select('id, nome')
    .eq('clinica_email', owner);

  const profissionais: ProfissionalOption[] = (medicosRows ?? []).map((m) => ({
    id: m.id as string,
    nome: m.nome as string,
    agenda_google_status: null,
  }));

  const auth = await resolveCalendarAuth(owner, profissionais, row.medico);
  if (!auth) return;

  const start = row.inicio;
  const end =
    row.fim && new Date(row.fim).getTime() > new Date(row.inicio).getTime()
      ? row.fim
      : new Date(new Date(row.inicio).getTime() + 30 * 60_000).toISOString();

  const patched = await patchGoogleEventTime(auth, googleEventId, start, end);
  if (patched?.updated) {
    await supabaseAdmin
      .from('consultas_agenda')
      .update({ google_updated_at: patched.updated })
      .eq('owner_email', owner)
      .eq('id', row.id);
  }
}

/** Enfileira push de horário ao Google (não bloqueia resposta da API). */
export function queuePushConsultaTimeToGoogle(
  ownerEmail: string,
  row: ConsultaAgendaRow,
): void {
  void pushConsultaTimeToGoogle(ownerEmail, row).catch((err) => {
    console.warn('[pushConsultaTimeToGoogle]', row.id, err);
  });
}

/**
 * Envia ao Google atendimentos Turquesa sem google_event_id (idempotente por linha).
 * Reutiliza payload de calendarInvite / enrichProfessionalCalendarEvent.
 */
export async function pushPendingConsultasToGoogleCalendars(
  ownerEmail: string,
): Promise<{ pushed: number; skipped: number; errors: string[] }> {
  const owner = ownerEmail.toLowerCase().trim();
  const timeMin = agendaWindowTimeMin();
  const timeMax = agendaWindowTimeMax();

  let query = supabaseAdmin
    .from('consultas_agenda')
    .select('*')
    .eq('owner_email', owner)
    .is('google_event_id', null)
    .gte('inicio', timeMin)
    .lte('inicio', timeMax)
    .neq('status', 'cancelado')
    .order('inicio', { ascending: true });

  const { data, error } = await query.is('deleted_at', null);
  let rows = (data ?? []) as ConsultaAgendaRow[];

  if (error?.message?.includes('deleted_at')) {
    const fallback = await supabaseAdmin
      .from('consultas_agenda')
      .select('*')
      .eq('owner_email', owner)
      .is('google_event_id', null)
      .gte('inicio', timeMin)
      .lte('inicio', timeMax)
      .neq('status', 'cancelado')
      .order('inicio', { ascending: true });
    if (fallback.error) throw fallback.error;
    rows = (fallback.data ?? []) as ConsultaAgendaRow[];
  } else if (error) {
    throw error;
  }

  if (rows.length === 0) {
    return { pushed: 0, skipped: 0, errors: [] };
  }

  const hasGoogle =
    (await listConnectedProfissionalIds(owner)).length > 0 ||
    !!(await resolveGoogleSubByOwnerEmail(owner));

  if (!hasGoogle) {
    return { pushed: 0, skipped: rows.length, errors: [] };
  }

  const { data: medicosRows } = await supabaseAdmin
    .from('clinica_medicos')
    .select('id, nome')
    .eq('clinica_email', owner);

  const profissionais: ProfissionalOption[] = (medicosRows ?? []).map((m) => ({
    id: m.id as string,
    nome: m.nome as string,
    agenda_google_status: null,
  }));

  const { data: googleLinked } = await supabaseAdmin
    .from('consultas_agenda')
    .select('*')
    .eq('owner_email', owner)
    .not('google_event_id', 'is', null)
    .gte('inicio', timeMin)
    .lte('inicio', timeMax);

  const linkedRows = (googleLinked ?? []) as ConsultaAgendaRow[];

  let pushed = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    if (pushed >= MAX_PUSH_PER_SYNC) {
      skipped += 1;
      continue;
    }

    if (hasGoogleLinkedSlot(row, linkedRows)) {
      skipped += 1;
      continue;
    }

    const auth = await resolveCalendarAuth(owner, profissionais, row.medico);
    if (!auth) {
      skipped += 1;
      continue;
    }

    const start = row.inicio;
    const end =
      row.fim && new Date(row.fim).getTime() > new Date(row.inicio).getTime()
        ? row.fim
        : new Date(new Date(row.inicio).getTime() + 30 * 60_000).toISOString();

    const serviceLabel = row.servico?.trim() || 'Atendimento';
    const summary = `${serviceLabel} - ${row.paciente}`;
    const description = [
      `Cliente: ${row.paciente}`,
      `Serviço: ${serviceLabel}`,
      row.medico ? `Profissional: ${row.medico}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const googleEventId = await createGoogleEvent(auth, {
        summary,
        description,
        start,
        end,
        ownerEmail: owner,
        clienteDriveId: row.cliente_drive_id ?? null,
        paciente: row.paciente,
      });

      if (!googleEventId) {
        skipped += 1;
        continue;
      }

      const { error: upErr } = await supabaseAdmin
        .from('consultas_agenda')
        .update({
          google_event_id: googleEventId,
          updated_at: new Date().toISOString(),
        })
        .eq('owner_email', owner)
        .eq('id', row.id)
        .is('google_event_id', null);

      if (upErr) throw upErr;

      row.google_event_id = googleEventId;
      linkedRows.push(row);
      pushed += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao enviar ao Google';
      errors.push(`${row.paciente} (${row.inicio}): ${msg}`);
    }
  }

  return { pushed, skipped, errors };
}
