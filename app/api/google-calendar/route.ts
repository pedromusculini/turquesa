import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';

/** Obtém o token de acesso ao Google Calendar do cookie incremental ou da sessão */
async function getCalendarToken(req: NextRequest): Promise<string | null> {
  // 1. Tentar cookie de autorização incremental (fluxo pós-verificação)
  const cookieToken = req.cookies.get('google_calendar_token')?.value;
  if (cookieToken) return cookieToken;

  // 2. Fallback: tentar da sessão NextAuth (para compatibilidade)
  const session = await auth();
  const sessionToken = (session as any)?.accessToken;
  if (sessionToken) return sessionToken;

  return null;
}

// GET: Listar eventos do Google Calendar
export async function GET(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;

  try {
    const googleToken = await getCalendarToken(req);
    if (!googleToken) {
      return NextResponse.json(
        { error: 'Permissão do Google Calendar não concedida. Clique em "Conectar Google Calendar" para autorizar.' },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(req.url);
    const timeMin = searchParams.get('timeMin') || new Date().toISOString();
    const timeMax = searchParams.get('timeMax') ||
      new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    const maxResults = searchParams.get('maxResults') || '100';

    const params = new URLSearchParams({
      timeMin,
      timeMax,
      maxResults: String(maxResults),
      singleEvents: 'true',
      orderBy: 'startTime',
    });

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      {
        headers: {
          Authorization: `Bearer ${googleToken}`,
          Accept: 'application/json',
        },
      },
    );

    if (!res.ok) {
      const error = await res.json();
      console.error('[google-calendar/GET] Erro:', error);
      return NextResponse.json(
        { error: error?.error?.message || 'Erro ao acessar Google Calendar' },
        { status: res.status },
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[google-calendar/GET] Erro inesperado:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// POST: Criar evento no Google Calendar com lembretes + Google Maps
export async function POST(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;

  try {
    const googleToken = await getCalendarToken(req);
    if (!googleToken) {
      return NextResponse.json(
        { error: 'Permissão do Google Calendar não concedida.' },
        { status: 403 },
      );
    }

    const body = await req.json();
    const { summary, description, start, end, location, timeZone } = body;

    if (!summary || !start || !end) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: summary, start, end' },
        { status: 400 },
      );
    }

    const tz = timeZone || 'America/Sao_Paulo';

    // Lembretes: 7 dias, 1 dia e 1 hora antes
    const reminders = {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 7 * 24 * 60 },
        { method: 'popup', minutes: 24 * 60 },
        { method: 'popup', minutes: 60 },
      ],
    };

    // Se tiver endereço, enriquecer a descrição com link do Google Maps
    let finalDescription = description || '';
    let finalLocation = undefined;

    if (location) {
      const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(location)}`;
      finalDescription = `${description || ''}\n\n📍 Local: ${location}\n🗺️ Maps: ${mapsUrl}`.trim();
      finalLocation = mapsUrl;
    }

    const eventBody = {
      summary,
      description: finalDescription,
      start: { dateTime: start, timeZone: tz },
      end: { dateTime: end, timeZone: tz },
      ...(finalLocation && { location: finalLocation }),
      reminders,
    };

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${googleToken}`,
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
  } catch (error: any) {
    console.error('[google-calendar/POST] Erro inesperado:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// DELETE: Excluir evento do Google Calendar
export async function DELETE(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;

  try {
    const googleToken = await getCalendarToken(req);
    if (!googleToken) {
      return NextResponse.json(
        { error: 'Permissão do Google Calendar não concedida.' },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get('eventId');

    if (!eventId) {
      return NextResponse.json({ error: 'eventId é obrigatório' }, { status: 400 });
    }

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}?sendUpdates=all`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${googleToken}`,
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
  } catch (error: any) {
    console.error('[google-calendar/DELETE] Erro inesperado:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}