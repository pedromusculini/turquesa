import { NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import { runAgendaSyncFull } from '@/lib/agendaSyncFull';
import { consultasAgendaErrorMessage } from '@/lib/consultasAgenda';
import { isAgendaViewTableMissing } from '@/lib/agendaViewServer';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Sync completo servidor: Google pull + dedupe/repair + push Turquesa → agenda-view. */
export async function POST() {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  try {
    const result = await runAgendaSyncFull(email);
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
