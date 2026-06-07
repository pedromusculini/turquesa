import { NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import {
  isConsultasAgendaTableMissing,
  listConsultasAgendaForOwner,
} from '@/lib/consultasAgenda';

export const runtime = 'nodejs';

/** Lista consultas do owner (grade cross-device + status WhatsApp). */
export async function GET() {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  try {
    const rows = await listConsultasAgendaForOwner(email);

    const consultas = rows.map((r) => ({
      id: r.id,
      paciente: r.paciente,
      servico: r.servico,
      inicio: r.inicio,
      fim: r.fim,
      local: r.local,
      telefone: r.telefone,
      google_event_id: r.google_event_id,
      medico: r.medico,
      convenio: r.convenio,
      status: r.status,
      lembretes_whatsapp: r.lembretes_whatsapp,
      cliente_drive_id: r.cliente_drive_id ?? null,
    }));

    return NextResponse.json({ consultas });
  } catch (error) {
    const e = error as { code?: string; message?: string };
    if (isConsultasAgendaTableMissing(e)) {
      return NextResponse.json({ consultas: [] });
    }
    return NextResponse.json(
      { error: e.message ?? 'Erro ao listar atendimentos' },
      { status: 500 },
    );
  }
}
