import { NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { getConsultasAgendaRevision } from '@/lib/consultasAgendaExcluidos';

export const runtime = 'nodejs';

/** Cursor leve para polling cross-device da agenda (sem Supabase Realtime/Auth). */
export async function GET() {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const meta = await getConsultasAgendaRevision(email);
  return NextResponse.json(meta);
}
