import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import { runAgendaSyncFull } from '@/lib/agendaSyncFull';
import { consultasAgendaErrorMessage } from '@/lib/consultasAgenda';
import { isAgendaViewTableMissing } from '@/lib/agendaViewServer';
import { scheduleDailyAgendaSnapshot } from '@/lib/agendaDriveSnapshot';

export const runtime = 'nodejs';
export const maxDuration = 180;

/** Sync completo servidor: Google pull + push Turquesa → agenda-view (sem repair destrutivo). */
export async function POST(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email, googleSub } = authResult;
  const cookieDriveToken = req.cookies.get('google_drive_token')?.value ?? null;

  try {
    const result = await runAgendaSyncFull(email);

    scheduleDailyAgendaSnapshot({
      ownerEmail: email,
      googleSub,
      cookieDriveToken,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    if (isAgendaViewTableMissing(error)) {
      return NextResponse.json({ success: true, consultas: [] });
    }
    console.error('[agenda/sync-full]', error);
    return NextResponse.json(
      { error: consultasAgendaErrorMessage(error) },
      { status: 500 },
    );
  }
}
