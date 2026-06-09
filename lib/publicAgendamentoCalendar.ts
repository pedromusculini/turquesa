import { supabaseAdmin } from '@/lib/supabaseClient';
import { loadOwnerProfile } from '@/lib/agendamento';
import { buildProfessionalGoogleEventPayload } from '@/lib/calendarInvite';
import { enrichProfessionalCalendarDescription } from '@/lib/professionalCalendarAnamnese';
import {
  getProfissionalAccessToken,
  refreshGoogleAccessToken,
} from '@/lib/profissionalGoogleCalendar';
import { getOwnerGoogleAccessToken } from '@/lib/ownerGoogleTokens';

export const PUBLIC_BOOKING_TZ = 'America/Sao_Paulo';
export const PUBLIC_BOOKING_MAX_DAYS = 15;

export type PublicCalendarAuth = {
  accessToken: string;
  calendarId: string;
  profissionalId: string | null;
};

function normNome(n: string): string {
  return n.trim().toLowerCase();
}

export function brTodayDateString(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: PUBLIC_BOOKING_TZ });
}

export function brMaxBookingDateString(): string {
  const today = brTodayDateString();
  const [y, m, d] = today.split('-').map(Number);
  const max = new Date(Date.UTC(y, m - 1, d + PUBLIC_BOOKING_MAX_DAYS));
  return max.toISOString().slice(0, 10);
}

export function isDateWithinPublicBookingWindow(dateStr: string): boolean {
  const d = dateStr.slice(0, 10);
  return d >= brTodayDateString() && d <= brMaxBookingDateString();
}

export async function resolveGoogleSubByOwnerEmail(
  ownerEmail: string,
): Promise<string | null> {
  const email = ownerEmail.toLowerCase().trim();

  const { data: access } = await supabaseAdmin
    .from('google_account_access')
    .select('google_sub')
    .eq('email', email)
    .maybeSingle();

  if (access?.google_sub) return access.google_sub as string;

  const { data: profile } = await supabaseAdmin
    .from('onboarding_profiles')
    .select('google_sub')
    .eq('email', email)
    .maybeSingle();

  return (profile?.google_sub as string | null) ?? null;
}

export async function ownerHasCalendarConnected(ownerEmail: string): Promise<boolean> {
  const googleSub = await resolveGoogleSubByOwnerEmail(ownerEmail);
  if (!googleSub) return false;
  const token = await getOwnerGoogleAccessToken(googleSub, 'calendar');
  return !!token;
}

export async function titularNome(ownerEmail: string): Promise<string> {
  const profile = await loadOwnerProfile(ownerEmail);
  return (
    (profile?.full_name as string | undefined)?.trim() ||
    (profile?.clinic_name as string | undefined)?.trim() ||
    ''
  );
}

export function nomeMatchesTitular(titular: string, medicoNome: string): boolean {
  const t = normNome(titular);
  const m = normNome(medicoNome);
  if (!t || !m) return false;
  if (t === m) return true;
  const tFirst = t.split(/\s+/)[0];
  const mFirst = m.split(/\s+/)[0];
  return tFirst === mFirst || t.startsWith(`${mFirst} `) || m.startsWith(`${tFirst} `);
}

/** Token Google Calendar para agendamento público (profissional da equipe ou titular). */
export async function resolvePublicCalendarAuth(
  ownerEmail: string,
  medicoNome: string,
): Promise<PublicCalendarAuth | null> {
  const owner = ownerEmail.toLowerCase().trim();
  const nome = medicoNome.trim();
  if (!nome) return null;

  const { data: medicosRows } = await supabaseAdmin
    .from('clinica_medicos')
    .select('id, nome')
    .eq('clinica_email', owner)
    .eq('ativo', true);

  const matched = (medicosRows ?? []).find(
    (m) => normNome(String(m.nome ?? '')) === normNome(nome),
  );

  if (matched) {
    const prof = await getProfissionalAccessToken(matched.id as string, owner);
    if (prof) {
      return {
        accessToken: prof.accessToken,
        calendarId: prof.calendarId,
        profissionalId: matched.id as string,
      };
    }
  }

  const titular = await titularNome(owner);
  if (nomeMatchesTitular(titular, nome)) {
    const googleSub = await resolveGoogleSubByOwnerEmail(owner);
    if (googleSub) {
      const accessToken = await getOwnerGoogleAccessToken(googleSub, 'calendar');
      if (accessToken) {
        return {
          accessToken,
          calendarId: 'primary',
          profissionalId: matched ? (matched.id as string) : null,
        };
      }
    }
  }

  return null;
}

export async function profissionalAgendaConectada(
  ownerEmail: string,
  medicoNome: string,
): Promise<boolean> {
  const auth = await resolvePublicCalendarAuth(ownerEmail, medicoNome);
  return !!auth;
}

export type BusyPeriod = { start: Date; end: Date };

export async function fetchGoogleBusyPeriods(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string,
): Promise<BusyPeriod[]> {
  const res = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      timeMin,
      timeMax,
      timeZone: PUBLIC_BOOKING_TZ,
      items: [{ id: calendarId }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { error?: { message?: string } })?.error?.message ||
        'Erro ao consultar disponibilidade no Google Calendar',
    );
  }

  const data = (await res.json()) as {
    calendars?: Record<string, { busy?: Array<{ start: string; end: string }> }>;
  };

  const key = Object.keys(data.calendars ?? {}).find((k) => k === calendarId) ?? calendarId;
  const busy = data.calendars?.[key]?.busy ?? data.calendars?.[calendarId]?.busy ?? [];

  return busy.map((b) => ({
    start: new Date(b.start),
    end: new Date(b.end),
  }));
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function slotOverlapsBusy(
  slotStart: Date,
  slotEnd: Date,
  busyPeriods: BusyPeriod[],
): boolean {
  return busyPeriods.some((b) => overlaps(slotStart, slotEnd, b.start, b.end));
}

export async function createPublicBookingCalendarEvent(params: {
  auth: PublicCalendarAuth;
  ownerEmail: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
  location?: string;
  clienteDriveId?: string | null;
  nomeCliente?: string | null;
}): Promise<string | null> {
  const {
    auth,
    ownerEmail,
    summary,
    description,
    start,
    end,
    location,
    clienteDriveId,
    nomeCliente,
  } = params;
  const encoded = encodeURIComponent(auth.calendarId);
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encoded}/events?sendUpdates=all`;

  const enrichedDescription = await enrichProfessionalCalendarDescription({
    description: description || '',
    ownerEmail,
    clienteDriveId,
    nomeCliente,
  });

  const eventBody = buildProfessionalGoogleEventPayload({
    summary,
    description: enrichedDescription,
    start,
    end,
    location,
    timeZone: PUBLIC_BOOKING_TZ,
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(eventBody),
  });

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

/** Valida se o intervalo ainda está livre no Google Calendar. */
export async function isSlotFreeOnGoogleCalendar(params: {
  auth: PublicCalendarAuth;
  inicio: string;
  fim: string;
}): Promise<boolean> {
  const start = new Date(params.inicio);
  const end = new Date(params.fim);
  const bufferMs = 60_000;
  const timeMin = new Date(start.getTime() - bufferMs).toISOString();
  const timeMax = new Date(end.getTime() + bufferMs).toISOString();

  const busy = await fetchGoogleBusyPeriods(
    params.auth.accessToken,
    params.auth.calendarId,
    timeMin,
    timeMax,
  );

  return !slotOverlapsBusy(start, end, busy);
}

export { refreshGoogleAccessToken };
