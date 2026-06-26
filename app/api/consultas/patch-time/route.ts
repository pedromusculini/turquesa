import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import {
  consultasAgendaErrorMessage,
  isConsultasAgendaTableMissing,
  patchConsultaAgendaTime,
} from '@/lib/consultasAgenda';
import { queuePushConsultaTimeToGoogle } from '@/lib/pushConsultasToGoogleServer';

export const runtime = 'nodejs';

function toIsoOrNull(value: unknown): string | null {
  if (value == null || value === '') return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** PATCH horário: Supabase primeiro, push Google em background (Fase 5). */
export async function PATCH(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const body = await req.json().catch(() => ({}));
  const id = String(body.id ?? '').trim();
  const inicio = toIsoOrNull(body.inicio ?? body.start);
  const fim = toIsoOrNull(body.fim ?? body.end);

  if (!id || !inicio) {
    return NextResponse.json(
      { error: 'Campos obrigatórios: id, inicio' },
      { status: 400 },
    );
  }

  try {
    const row = await patchConsultaAgendaTime(email, id, inicio, fim);
    if (!row) {
      return NextResponse.json({ error: 'Agendamento não encontrado' }, { status: 404 });
    }

    if (row.google_event_id) {
      queuePushConsultaTimeToGoogle(email, row);
    }

    return NextResponse.json({
      success: true,
      consulta: {
        id: row.id,
        inicio: row.inicio,
        fim: row.fim,
        updated_at: row.updated_at,
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
