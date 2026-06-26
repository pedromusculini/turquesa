import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import {
  computeAgendaSyncHealth,
  loadPacienteTelefoneIndex,
  type AgendaSyncHealth,
} from '@/lib/agendaSyncHealth';
import {
  isConsultasAgendaTableMissing,
  listConsultasAgendaForOwner,
  type ConsultaAgendaRow,
} from '@/lib/consultasAgenda';

export const runtime = 'nodejs';

export type AgendaViewConsulta = {
  id: string;
  paciente: string;
  servico: string;
  inicio: string;
  fim: string | null;
  local: string | null;
  telefone: string | null;
  google_event_id: string | null;
  medico: string | null;
  convenio: string | null;
  status: ConsultaAgendaRow['status'];
  lembretes_whatsapp: boolean;
  cliente_drive_id: string | null;
  observacoes: string | null;
  sync_health: AgendaSyncHealth;
};

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
    const rows = await listConsultasAgendaForOwner(email, { daysPast, daysFuture });
    const telefoneIndex = await loadPacienteTelefoneIndex(email);

    const consultas: AgendaViewConsulta[] = rows.map((r) => ({
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
      observacoes: r.observacoes ?? null,
      sync_health: computeAgendaSyncHealth(r, telefoneIndex),
    }));

    return NextResponse.json({ consultas });
  } catch (error) {
    const e = error as { code?: string; message?: string };
    if (isConsultasAgendaTableMissing(e)) {
      return NextResponse.json({ consultas: [] });
    }
    return NextResponse.json(
      { error: e.message ?? 'Erro ao carregar agenda' },
      { status: 500 },
    );
  }
}
