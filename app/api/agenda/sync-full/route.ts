import { NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { runAgendaSyncFull } from '@/lib/agendaSyncFull';
import { isAgendaViewTableMissing } from '@/lib/agendaViewServer';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Sync completo servidor: Google pull + dedupe/repair + push Turquesa → agenda-view. */
export async function POST() {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  try {
    const result = await runAgendaSyncFull(email);
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    const e = error as { message?: string };
    if (isAgendaViewTableMissing(error)) {
      return NextResponse.json({ success: true, consultas: [] });
    }
    console.error('[agenda/sync-full]', error);
    return NextResponse.json(
      { error: e.message ?? 'Erro ao sincronizar agenda' },
      { status: 500 },
    );
  }
}
