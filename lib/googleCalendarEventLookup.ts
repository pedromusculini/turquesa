import type { NextRequest } from 'next/server';
import { getTitularCalendarAccessToken } from '@/lib/calendarAuth';
import {
  getProfissionalAccessToken,
  listConnectedProfissionalIds,
} from '@/lib/profissionalGoogleCalendar';

export type GoogleCalendarResolveResult = {
  found: boolean;
  profissionalId?: string | null;
};

type CalendarAuth = {
  accessToken: string;
  calendarId: string;
};

function calendarEventsUrl(calendarId: string, suffix = ''): string {
  const encoded = encodeURIComponent(calendarId);
  return `https://www.googleapis.com/calendar/v3/calendars/${encoded}/events${suffix}`;
}

async function fetchGoogleEventById(
  auth: CalendarAuth,
  eventId: string,
): Promise<boolean> {
  const res = await fetch(
    `${calendarEventsUrl(auth.calendarId, `/${encodeURIComponent(eventId)}`)}`,
    {
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        Accept: 'application/json',
      },
    },
  );

  if (res.status === 404 || res.status === 410) return false;
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(
      (error as { error?: { message?: string } })?.error?.message ||
        'Erro ao localizar evento no Google Calendar',
    );
  }

  return true;
}

function uniqueProfCandidates(
  preferred: (string | undefined)[],
  connected: string[],
): (string | undefined)[] {
  const seen = new Set<string>();
  const out: (string | undefined)[] = [];

  for (const id of preferred) {
    const key = id ?? '__titular__';
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(id);
  }

  for (const id of connected) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }

  if (!seen.has('__titular__')) {
    out.push(undefined);
  }

  return out;
}

/**
 * Localiza eventId nas agendas Google do salão (profissionais conectadas + titular).
 */
export async function resolveGoogleCalendarEventForOwner(
  req: NextRequest,
  ownerEmail: string,
  eventId: string,
  preferredProfIds: (string | undefined)[] = [],
): Promise<GoogleCalendarResolveResult> {
  const owner = ownerEmail.toLowerCase().trim();
  const id = eventId.trim();
  if (!id) return { found: false };

  const connected = await listConnectedProfissionalIds(owner);
  const candidates = uniqueProfCandidates(preferredProfIds, connected);

  for (const profId of candidates) {
    try {
      let auth: CalendarAuth | null = null;
      if (profId) {
        auth = await getProfissionalAccessToken(profId, owner);
      } else {
        const titularToken = await getTitularCalendarAccessToken(req);
        if (titularToken) {
          auth = { accessToken: titularToken, calendarId: 'primary' };
        }
      }

      if (!auth) continue;

      const exists = await fetchGoogleEventById(auth, id);
      if (exists) {
        return { found: true, profissionalId: profId ?? null };
      }
    } catch (err) {
      console.warn('[resolveGoogleCalendarEvent]', profId ?? 'titular', err);
    }
  }

  return { found: false };
}
