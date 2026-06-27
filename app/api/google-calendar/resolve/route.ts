import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import { resolveGoogleCalendarEventForOwner } from '@/lib/googleCalendarEventLookup';

export const runtime = 'nodejs';

/** Verifica se google_event_id existe em alguma agenda conectada (evita POST duplicado). */
export async function GET(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const eventId = new URL(req.url).searchParams.get('eventId')?.trim() ?? '';
  if (!eventId) {
    return NextResponse.json({ error: 'Informe eventId.' }, { status: 400 });
  }

  const profParam = new URL(req.url).searchParams.get('profissionalId');
  const preferred = profParam ? [profParam] : [];

  try {
    const result = await resolveGoogleCalendarEventForOwner(
      req,
      email,
      eventId,
      preferred,
    );
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
