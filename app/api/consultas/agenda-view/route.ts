import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import {
  buildAgendaViewForOwner,
  isAgendaViewTableMissing,
} from '@/lib/agendaViewServer';

export const runtime = 'nodejs';

function parseDaysParam(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(n, 730);
}

/** Grade autoritativa da agenda (Supabase) com sync_health calculado — Fase 1. */
export async function GET(req: NextRequest) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const { searchParams } = new URL(req.url);
  const daysPast = parseDaysParam(searchParams.get('daysPast'), 180);
  const daysFuture = parseDaysParam(searchParams.get('daysFuture'), 365);

  try {
    const consultas = await buildAgendaViewForOwner(email, { daysPast, daysFuture });
    return NextResponse.json({ consultas });
  } catch (error) {
    if (isAgendaViewTableMissing(error)) {
      return NextResponse.json({ consultas: [] });
    }
    const e = error as { message?: string };
    return NextResponse.json(
      { error: e.message ?? 'Erro ao carregar agenda' },
      { status: 500 },
    );
  }
}
