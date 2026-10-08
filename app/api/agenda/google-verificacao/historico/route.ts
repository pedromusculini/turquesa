import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import { listAgendaLogForConsulta } from '@/lib/consultasAgendaLog';
import { consultasAgendaErrorMessage } from '@/lib/consultasAgenda';

export const runtime = 'nodejs';

/** Histórico (log de agendamento) de uma sessão. */
export async function GET(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const consultaId = new URL(req.url).searchParams.get('consultaId')?.trim() ?? '';
  if (!consultaId) {
    return NextResponse.json({ error: 'Informe consultaId.' }, { status: 400 });
  }

  try {
    const log = await listAgendaLogForConsulta(email, consultaId);
    return NextResponse.json({ log });
  } catch (error) {
    return NextResponse.json({ error: consultasAgendaErrorMessage(error) }, { status: 500 });
  }
}
