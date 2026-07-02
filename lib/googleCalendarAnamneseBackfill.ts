import { supabaseAdmin } from '@/lib/supabaseClient';
import {
  buildProfessionalGoogleEventPayload,
  professionalGoogleEventNeedsPatch,
} from '@/lib/calendarInvite';
import { getTitularCalendarAccessToken } from '@/lib/calendarAuth';
import { getOwnerGoogleAccessToken } from '@/lib/ownerGoogleTokens';
import { enrichProfessionalCalendarEvent } from '@/lib/professionalCalendarAnamnese';
import { getProfissionalAccessToken } from '@/lib/profissionalGoogleCalendar';
import { resolveGoogleSubByOwnerEmail } from '@/lib/publicAgendamentoCalendar';
import type { NextRequest } from 'next/server';

type CalendarAuth = {
  accessToken: string;
  calendarId: string;
};

type GoogleEventRaw = {
  id?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
};

function normNome(n: string): string {
  return n.trim().toLowerCase();
}

function profissionalIdByNome(
  rows: { id: string; nome: string }[],
  nome: string,
): string | undefined {
  const trimmed = normNome(nome);
  if (!trimmed) return undefined;
  const exact = rows.find((p) => normNome(p.nome) === trimmed);
  if (exact) return exact.id;
  const partial = rows.find((p) => {
    const full = normNome(p.nome);
    const first = full.split(/\s+/)[0];
    return first === trimmed || full.startsWith(`${trimmed} `);
  });
  return partial?.id;
}

async function profissionalHasConnectedAgenda(
  owner: string,
  profissionalId: string,
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('profissional_google_calendar')
    .select('connected_at, refresh_token_encrypted')
    .eq('clinica_medicos_id', profissionalId)
    .maybeSingle();

  if (error) throw error;
  return !!(data?.connected_at && data?.refresh_token_encrypted);
}

async function titularCalendarAuth(ownerEmail: string): Promise<CalendarAuth | null> {
  const googleSub = await resolveGoogleSubByOwnerEmail(ownerEmail);
  if (!googleSub) return null;
  const accessToken = await getOwnerGoogleAccessToken(googleSub, 'calendar');
  if (!accessToken) return null;
  return { accessToken, calendarId: 'primary' };
}

/** Resolve token Google Calendar para uma consulta (profissional conectada ou titular). */
export async function resolveCalendarAuthForConsulta(
  req: NextRequest | null,
  ownerEmail: string,
  medico?: string | null,
  profissionalId?: string | null,
): Promise<CalendarAuth | null> {
  const owner = ownerEmail.toLowerCase().trim();

  let profId = profissionalId?.trim() || undefined;
  if (!profId && medico?.trim()) {
    const { data: rows } = await supabaseAdmin
      .from('clinica_medicos')
      .select('id, nome')
      .eq('clinica_email', owner)
      .eq('ativo', true);
    const matchedId = profissionalIdByNome(rows ?? [], medico);
    if (matchedId && (await profissionalHasConnectedAgenda(owner, matchedId))) {
      profId = matchedId;
    }
  }

  if (profId) {
    const prof = await getProfissionalAccessToken(profId, owner);
    if (prof) return prof;
  }

  if (req) {
    const titularToken = await getTitularCalendarAccessToken(req);
    if (titularToken) return { accessToken: titularToken, calendarId: 'primary' };
  }

  return await titularCalendarAuth(owner);
}

function calendarEventsUrl(calendarId: string, suffix = ''): string {
  const encoded = encodeURIComponent(calendarId);
  return `https://www.googleapis.com/calendar/v3/calendars/${encoded}/events${suffix}`;
}

async function fetchGoogleEvent(
  auth: CalendarAuth,
  eventId: string,
): Promise<GoogleEventRaw | null> {
  const res = await fetch(
    `${calendarEventsUrl(auth.calendarId, `/${encodeURIComponent(eventId)}`)}`,
    {
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        Accept: 'application/json',
      },
    },
  );

  if (res.status === 404) return null;
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(
      (error as { error?: { message?: string } })?.error?.message ||
        'Erro ao ler evento no Google Calendar',
    );
  }

  return res.json() as GoogleEventRaw;
}

async function patchGoogleEvent(
  auth: CalendarAuth,
  eventId: string,
  googleEvent: GoogleEventRaw,
  enrichment: { description: string; anamneseUrl?: string },
): Promise<void> {
  const start = googleEvent.start?.dateTime || googleEvent.start?.date;
  const end = googleEvent.end?.dateTime || googleEvent.end?.date;
  if (!start || !end) throw new Error('Evento Google sem início/fim');

  const eventBody = buildProfessionalGoogleEventPayload({
    summary: googleEvent.summary,
    description: enrichment.description,
    start,
    end,
    timeZone: googleEvent.start?.timeZone,
    anamneseUrl: enrichment.anamneseUrl,
  });

  const res = await fetch(
    `${calendarEventsUrl(auth.calendarId, `/${encodeURIComponent(eventId)}`)}?sendUpdates=none`,
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
    const error = await res.json().catch(() => ({}));
    throw new Error(
      (error as { error?: { message?: string } })?.error?.message ||
        'Erro ao atualizar evento no Google Calendar',
    );
  }
}

/**
 * Acrescenta link de anamnese na descrição do evento Google se ainda não existir.
 * Tenta agenda da profissional e, se necessário, agenda do titular.
 */
export async function ensureGoogleEventAnamneseLink(params: {
  req?: NextRequest | null;
  ownerEmail: string;
  googleEventId: string;
  clienteDriveId: string;
  nomeCliente?: string | null;
  medico?: string | null;
  profissionalId?: string | null;
}): Promise<{ patched: boolean; skipped?: string }> {
  const clienteDriveId = params.clienteDriveId?.trim();
  const googleEventId = params.googleEventId?.trim();
  if (!clienteDriveId || !googleEventId) {
    return { patched: false, skipped: 'sem cliente ou evento' };
  }

  const owner = params.ownerEmail.toLowerCase().trim();
  const authAttempts: CalendarAuth[] = [];

  const primaryAuth = await resolveCalendarAuthForConsulta(
    params.req ?? null,
    owner,
    params.medico,
    params.profissionalId,
  );
  if (primaryAuth) authAttempts.push(primaryAuth);

  const titularAuth = await titularCalendarAuth(owner);
  if (
    titularAuth &&
    !authAttempts.some(
      (a) =>
        a.accessToken === titularAuth.accessToken &&
        a.calendarId === titularAuth.calendarId,
    )
  ) {
    authAttempts.push(titularAuth);
  }

  if (!authAttempts.length) {
    return { patched: false, skipped: 'agenda não conectada' };
  }

  for (const auth of authAttempts) {
    const googleEvent = await fetchGoogleEvent(auth, googleEventId);
    if (!googleEvent) continue;

    const needsPatch = professionalGoogleEventNeedsPatch({
      description: googleEvent.description,
      location: googleEvent.location,
      expectAnamnese: true,
    });
    if (!needsPatch) {
      return { patched: false, skipped: 'já normalizado' };
    }

    const enrichment = await enrichProfessionalCalendarEvent({
      description: googleEvent.description || '',
      ownerEmail: owner,
      clienteDriveId,
      nomeCliente: params.nomeCliente,
      sessaoInicio: googleEvent.start?.dateTime ?? googleEvent.start?.date ?? null,
    });

    if (
      enrichment.description === (googleEvent.description || '') &&
      enrichment.anamneseUrl === (googleEvent.location || '').trim()
    ) {
      return { patched: false, skipped: 'descrição não alterada' };
    }

    await patchGoogleEvent(auth, googleEventId, googleEvent, enrichment);
    return { patched: true };
  }

  return { patched: false, skipped: 'evento não encontrado' };
}
