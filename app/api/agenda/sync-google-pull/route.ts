import { NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import { buildAgendaViewForOwner, isAgendaViewTableMissing } from '@/lib/agendaViewServer';
import { agendaWindowTimeMin, agendaWindowTimeMax } from '@/lib/consultations';
import { consultasAgendaErrorMessage } from '@/lib/consultasAgenda';
import { syncConsultasAgendaFromGoogleCalendars } from '@/lib/syncConsultasFromGoogleServer';

export const runtime = 'nodejs';
export const maxDuration = 120;

/** Importação leve: Google pull + agenda-view (sem repair nem push). */
export async function POST() {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  try {
    const googleResult = await syncConsultasAgendaFromGoogleCalendars(email, {
      timeMin: agendaWindowTimeMin(),
      timeMax: agendaWindowTimeMax(),
      maxResults: '500',
      paginate: true,
    });

    const consultas = await buildAgendaViewForOwner(email);

    return NextResponse.json({
      success: true,
      googleImported: googleResult.upserted,
      googlePullErrors: googleResult.errors,
      consultas,
    });
  } catch (error) {
    if (isAgendaViewTableMissing(error)) {
      return NextResponse.json({
        success: true,
        googleImported: 0,
        googlePullErrors: [],
        consultas: [],
      });
    }
    console.error('[agenda/sync-google-pull]', error);
    return NextResponse.json(
      { error: consultasAgendaErrorMessage(error) },
      { status: 500 },
    );
  }
}
