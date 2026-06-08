import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
import {
  getProfissionalAccessToken,
  listConnectedProfissionalIds,
} from '@/lib/profissionalGoogleCalendar';
import { getTitularCalendarAccessToken } from '@/lib/calendarAuth';

type CalendarSyncWarning = {
  profissionalId: string;
  nome?: string;
  error: string;
};

function defaultTimeMin(): string {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
}

function defaultTimeMax(): string {
  return new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Erro ao acessar agenda Google';
}

type CalendarAuth = {
  accessToken: string;
  calendarId: string;
};

async function resolveCalendarAuth(
  req: NextRequest,
  clinicaEmail: string,
  profissionalId?: string | null,
): Promise<CalendarAuth | null> {
  if (profissionalId) {
    const prof = await getProfissionalAccessToken(profissionalId, clinicaEmail);
    if (!prof) return null;
    return prof;
  }

  const titularToken = await getTitularCalendarAccessToken(req);
  if (!titularToken) return null;
  return { accessToken: titularToken, calendarId: 'primary' };
}

function calendarEventsUrl(calendarId: string, suffix = ''): string {
  const encoded = encodeURIComponent(calendarId);
  return `https://www.googleapis.com/calendar/v3/calendars/${encoded}/events${suffix}`;
}

async function fetchCalendarEvents(
  authCtx: CalendarAuth,
  params: URLSearchParams,
): Promise<{ items?: unknown[] }> {
  const res = await fetch(`${calendarEventsUrl(authCtx.calendarId)}?${params}`, {
    headers: {
      Authorization: `Bearer ${authCtx.accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error?.error?.message || 'Erro ao acessar Google Calendar');
  }

  return res.json();
}

// GET: Listar eventos do Google Calendar
export async function GET(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email: clinicaEmail } = authResult;

  try {
    const { searchParams } = new URL(req.url);
    const profissionalId =
      searchParams.get('profissionalId') || searchParams.get('medicoId');
    const allConnected = searchParams.get('allConnected') === 'true';

    const timeMin = searchParams.get('timeMin') || defaultTimeMin();
    const timeMax = searchParams.get('timeMax') || defaultTimeMax();
    const maxResults = searchParams.get('maxResults') || '100';

    const params = new URLSearchParams({
      timeMin,
      timeMax,
      maxResults: String(maxResults),
      singleEvents: 'true',
      orderBy: 'startTime',
    });

    if (allConnected) {
      const connectedIds = await listConnectedProfissionalIds(clinicaEmail);
      const allItems: unknown[] = [];
      const seen = new Set<string>();
      const warnings: CalendarSyncWarning[] = [];

      const { data: medicosRows } = await supabaseAdmin
        .from('clinica_medicos')
        .select('id, nome')
        .eq('clinica_email', clinicaEmail);
      const nomeById = new Map(
        (medicosRows ?? []).map((m) => [m.id as string, m.nome as string]),
      );

      for (const id of connectedIds) {
        const nome = nomeById.get(id);
        let authCtx: CalendarAuth | null = null;
        try {
          authCtx = await getProfissionalAccessToken(id, clinicaEmail);
        } catch (err) {
          const message = errorMessage(err);
          console.warn(`[google-calendar/GET] profissional ${id} token:`, err);
          warnings.push({ profissionalId: id, nome, error: message });
          continue;
        }
        if (!authCtx) {
          warnings.push({
            profissionalId: id,
            nome,
            error: 'Agenda conectada, mas o token não pôde ser renovado. Peça para reconectar.',
          });
          continue;
        }
        try {
          const data = await fetchCalendarEvents(authCtx, params);
          for (const item of data.items ?? []) {
            const ev = item as { id?: string };
            const key = `${id}:${ev.id}`;
            if (ev.id && !seen.has(key)) {
              seen.add(key);
              allItems.push({ ...ev, _profissionalId: id });
            }
          }
        } catch (err) {
          const message = errorMessage(err);
          console.warn(`[google-calendar/GET] profissional ${id}:`, err);
          warnings.push({ profissionalId: id, nome, error: message });
        }
      }

      const titularAuth = await resolveCalendarAuth(req, clinicaEmail, null);
      if (titularAuth) {
        try {
          const data = await fetchCalendarEvents(titularAuth, params);
          for (const item of data.items ?? []) {
            const ev = item as { id?: string };
            const key = `titular:${ev.id}`;
            if (ev.id && !seen.has(key)) {
              seen.add(key);
              allItems.push(item);
            }
          }
        } catch (err) {
          console.warn('[google-calendar/GET] titular:', err);
          warnings.push({
            profissionalId: 'titular',
            nome: 'Titular',
            error: errorMessage(err),
          });
        }
      }

      if (!allItems.length && !titularAuth && !connectedIds.length) {
        return NextResponse.json(
          {
            error:
              'Nenhuma agenda conectada. Conecte sua agenda ou peça às profissionais que autorizem.',
          },
          { status: 403 },
        );
      }

      return NextResponse.json({
        items: allItems,
        ...(warnings.length ? { warnings } : {}),
      });
    }

    const authCtx = await resolveCalendarAuth(req, clinicaEmail, profissionalId);
    if (!authCtx) {
      return NextResponse.json(
        {
          error: profissionalId
            ? 'Agenda desta profissional não está conectada. Envie o convite pelo WhatsApp.'
            : 'Permissão do Google Calendar não concedida. Clique em "Conectar Google" no Dashboard.',
        },
        { status: 403 },
      );
    }

    const data = await fetchCalendarEvents(authCtx, params);
    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error('[google-calendar/GET] Erro inesperado:', error);
    const message = error instanceof Error ? error.message : 'Erro interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function buildGoogleEventPayload(body: {
  summary?: string;
  description?: string;
  start?: string;
  end?: string;
  location?: string;
  timeZone?: string;
}) {
  const { summary, description, start, end, location, timeZone } = body;
  const tz = timeZone || 'America/Sao_Paulo';

  const reminders = {
    useDefault: false,
    overrides: [
      { method: 'popup', minutes: 7 * 24 * 60 },
      { method: 'popup', minutes: 24 * 60 },
      { method: 'popup', minutes: 60 },
    ],
  };

  let finalDescription = description || '';
  let finalLocation: string | undefined;

  if (location) {
    const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(location)}`;
    finalDescription = `${description || ''}\n\n📍 Local: ${location}\n🗺️ Maps: ${mapsUrl}`.trim();
    finalLocation = mapsUrl;
  }

  return {
    summary,
    description: finalDescription,
    start: { dateTime: start, timeZone: tz },
    end: { dateTime: end, timeZone: tz },
    ...(finalLocation && { location: finalLocation }),
    reminders,
  };
}

// POST: Criar evento no Google Calendar com lembretes + Google Maps
export async function POST(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email: clinicaEmail } = authResult;

  try {
    const body = await req.json();
    const profissionalId = body.profissionalId || body.medicoId || null;
    const { summary, description, start, end, location, timeZone } = body;

    const authCtx = await resolveCalendarAuth(req, clinicaEmail, profissionalId);
    if (!authCtx) {
      return NextResponse.json(
        {
          error: profissionalId
            ? 'Agenda desta profissional não está conectada.'
            : 'Permissão do Google Calendar não concedida.',
        },
        { status: 403 },
      );
    }

    if (!summary || !start || !end) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: summary, start, end' },
        { status: 400 },
      );
    }

    const eventBody = buildGoogleEventPayload({
      summary,
      description,
      start,
      end,
      location,
      timeZone,
    });

    const res = await fetch(
      `${calendarEventsUrl(authCtx.calendarId)}?sendUpdates=all`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authCtx.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventBody),
      },
    );

    if (!res.ok) {
      const error = await res.json();
      console.error('[google-calendar/POST] Erro:', error);
      return NextResponse.json(
        { error: error?.error?.message || 'Erro ao criar evento no Google Calendar' },
        { status: res.status },
      );
    }

    const data = await res.json();
    return NextResponse.json(data, { status: 201 });
  } catch (error: unknown) {
    console.error('[google-calendar/POST] Erro inesperado:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// PATCH: Atualizar evento existente no Google Calendar
export async function PATCH(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email: clinicaEmail } = authResult;

  try {
    const body = await req.json();
    const eventId = body.eventId || body.googleEventId;
    const profissionalId = body.profissionalId || body.medicoId || null;
    const { summary, description, start, end, location, timeZone } = body;

    if (!eventId) {
      return NextResponse.json({ error: 'eventId é obrigatório' }, { status: 400 });
    }

    const authCtx = await resolveCalendarAuth(req, clinicaEmail, profissionalId);
    if (!authCtx) {
      return NextResponse.json(
        {
          error: profissionalId
            ? 'Agenda desta profissional não está conectada.'
            : 'Permissão do Google Calendar não concedida.',
        },
        { status: 403 },
      );
    }

    if (!summary || !start || !end) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: summary, start, end' },
        { status: 400 },
      );
    }

    const eventBody = buildGoogleEventPayload({
      summary,
      description,
      start,
      end,
      location,
      timeZone,
    });

    const res = await fetch(
      `${calendarEventsUrl(authCtx.calendarId, `/${encodeURIComponent(eventId)}`)}?sendUpdates=all`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${authCtx.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventBody),
      },
    );

    if (!res.ok) {
      const error = await res.json();
      console.error('[google-calendar/PATCH] Erro:', error);
      return NextResponse.json(
        { error: error?.error?.message || 'Erro ao atualizar evento no Google Calendar' },
        { status: res.status },
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error('[google-calendar/PATCH] Erro inesperado:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// DELETE: Excluir evento do Google Calendar
export async function DELETE(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email: clinicaEmail } = authResult;

  try {
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get('eventId');
    const profissionalId =
      searchParams.get('profissionalId') || searchParams.get('medicoId');

    if (!eventId) {
      return NextResponse.json({ error: 'eventId é obrigatório' }, { status: 400 });
    }

    const authCtx = await resolveCalendarAuth(req, clinicaEmail, profissionalId);
    if (!authCtx) {
      return NextResponse.json(
        { error: 'Permissão do Google Calendar não concedida.' },
        { status: 403 },
      );
    }

    const res = await fetch(
      `${calendarEventsUrl(authCtx.calendarId, `/${encodeURIComponent(eventId)}`)}?sendUpdates=all`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authCtx.accessToken}`,
        },
      },
    );

    if (!res.ok && res.status !== 410) {
      const error = await res.json().catch(() => ({}));
      console.error('[google-calendar/DELETE] Erro:', error);
      return NextResponse.json(
        { error: error?.error?.message || 'Erro ao excluir evento do Google Calendar' },
        { status: res.status },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('[google-calendar/DELETE] Erro inesperado:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
