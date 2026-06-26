import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { unblockGoogleEventForOwner } from '@/lib/consultasAgendaExcluidos';

export const runtime = 'nodejs';

/** Remove tombstone de google_event_id para permitir reimport do Google. */
export async function POST(req: NextRequest) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const body = await req.json().catch(() => ({}));
  const googleEventId =
    typeof body.googleEventId === 'string'
      ? body.googleEventId.trim()
      : typeof body.google_event_id === 'string'
        ? body.google_event_id.trim()
        : '';

  if (!googleEventId) {
    return NextResponse.json({ error: 'Informe googleEventId.' }, { status: 400 });
  }

  const ok = await unblockGoogleEventForOwner(email, googleEventId);
  return NextResponse.json({ success: ok, googleEventId });
}
