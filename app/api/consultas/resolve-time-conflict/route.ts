import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import {
  consultasAgendaErrorMessage,
  isConsultasAgendaTableMissing,
  resolveConsultaTimeConflict,
} from '@/lib/consultasAgenda';
import { queuePushConsultaTimeToGoogle } from '@/lib/pushConsultasToGoogleServer';

export const runtime = 'nodejs';

function toIsoOrNull(value: unknown): string | null {
  if (value == null || value === '') return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Resolve conflito de horário Turquesa ↔ Google (Fase 5). */
export async function POST(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const body = await req.json().catch(() => ({}));
  const id = String(body.id ?? '').trim();
  const keep = body.keep === 'google' ? 'google' : body.keep === 'turquesa' ? 'turquesa' : null;

  const googleInicio = toIsoOrNull(body.googleInicio ?? body.google_inicio);
  const turquesaInicio = toIsoOrNull(body.turquesaInicio ?? body.turquesa_inicio);

  if (!id || !keep || !googleInicio || !turquesaInicio) {
    return NextResponse.json(
      { error: 'Campos obrigatórios: id, keep (google|turquesa), googleInicio, turquesaInicio' },
      { status: 400 },
    );
  }

  try {
    const row = await resolveConsultaTimeConflict(email, id, keep, {
      googleInicio,
      googleFim: toIsoOrNull(body.googleFim ?? body.google_fim),
      turquesaInicio,
      turquesaFim: toIsoOrNull(body.turquesaFim ?? body.turquesa_fim),
    });

    if (!row) {
      return NextResponse.json({ error: 'Agendamento não encontrado' }, { status: 404 });
    }

    if (keep === 'turquesa' && row.google_event_id) {
      queuePushConsultaTimeToGoogle(email, row);
    }

    return NextResponse.json({
      success: true,
      consulta: {
        id: row.id,
        inicio: row.inicio,
        fim: row.fim,
        sync_health: row.sync_health,
      },
    });
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    if (isConsultasAgendaTableMissing(e)) {
      return NextResponse.json(
        { error: 'Execute sql/consultas_whatsapp_schema.sql no Supabase.' },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: consultasAgendaErrorMessage(err) },
      { status: 500 },
    );
  }
}
