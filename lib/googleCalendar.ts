/**
 * Helper para acessar a API do Google Calendar usando o token do NextAuth.
 * Documentação: https://developers.google.com/calendar/api/v3/reference
 */

interface GoogleCalendarEventInput {
  summary: string;
  description?: string;
  start: string; // ISO 8601 datetime (ex: '2026-05-30T09:00:00-03:00')
  end: string;
  location?: string;
  timeZone?: string;
}

interface GoogleCalendarReminder {
  method: 'email' | 'popup';
  minutes: number;
}

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

/**
 * @deprecated Use as rotas `/api/google-calendar` (tokens não são expostos ao browser).
 */
export async function getAccessToken(): Promise<string | null> {
  console.warn('[googleCalendar] getAccessToken está obsoleto; use /api/google-calendar');
  return null;
}

/**
 * Lista eventos do Google Calendar em um período.
 */
export async function listCalendarEvents(
  accessToken: string,
  options?: {
    timeMin?: string;
    timeMax?: string;
    maxResults?: number;
  },
) {
  const timeMin =
    options?.timeMin || new Date().toISOString();
  const timeMax =
    options?.timeMax ||
    new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
  const maxResults = options?.maxResults || 100;

  const params = new URLSearchParams({
    timeMin,
    timeMax,
    maxResults: String(maxResults),
    singleEvents: 'true',
    orderBy: 'startTime',
  });

  const res = await fetch(
    `${CALENDAR_API_BASE}/calendars/primary/events?${params}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    },
  );

  if (!res.ok) {
    const error = await res.json();
    throw new Error(
      error?.error?.message || 'Erro ao listar eventos do Google Calendar',
    );
  }

  return res.json();
}

/**
 * Cria um evento no Google Calendar com lembretes e endereço com link do Google Maps.
 */
export async function createCalendarEvent(
  accessToken: string,
  event: GoogleCalendarEventInput,
) {
  const timeZone = event.timeZone || 'America/Sao_Paulo';

  // Formata o endereço como link do Google Maps se fornecido
  const location = event.location
    ? `https://www.google.com/maps/search/${encodeURIComponent(event.location)}`
    : undefined;

  const reminders: { useDefault: boolean; overrides?: GoogleCalendarReminder[] } = {
    useDefault: false,
    overrides: [
      { method: 'popup', minutes: 7 * 24 * 60 }, // 7 dias antes
      { method: 'popup', minutes: 24 * 60 },       // 1 dia antes
      { method: 'popup', minutes: 60 },              // 1 hora antes
    ],
  };

  const body: any = {
    summary: event.summary,
    description: event.description || '',
    start: {
      dateTime: event.start,
      timeZone,
    },
    end: {
      dateTime: event.end,
      timeZone,
    },
    reminders,
    // Atribuímos localização como texto para o link aparecer no Google Maps
    ...(event.location && {
      location: event.location,
      description: (event.description || '') + `\n\n📍 Local: ${event.location}\n🗺️ Maps: ${location}`,
    }),
  };

  // Adicionar link do Google Maps no campo location para abrir o app
  if (location) {
    body.location = location;
    body.conferenceData = undefined; // sem videoconferência
  }

  const res = await fetch(
    `${CALENDAR_API_BASE}/calendars/primary/events?sendUpdates=all`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    const error = await res.json();
    throw new Error(
      error?.error?.message || 'Erro ao criar evento no Google Calendar',
    );
  }

  return res.json();
}

/**
 * Exclui um evento do Google Calendar pelo ID.
 */
export async function deleteCalendarEvent(
  accessToken: string,
  eventId: string,
) {
  const res = await fetch(
    `${CALENDAR_API_BASE}/calendars/primary/events/${eventId}?sendUpdates=all`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!res.ok && res.status !== 410) {
    // 410 = already deleted
    const error = await res.json().catch(() => ({}));
    throw new Error(
      error?.error?.message || 'Erro ao excluir evento do Google Calendar',
    );
  }

  return { success: true };
}