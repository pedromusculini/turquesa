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

export async function buildAgendaViewForOwner(
  ownerEmail: string,
  options?: { daysPast?: number; daysFuture?: number },
): Promise<AgendaViewConsulta[]> {
  const rows = await listConsultasAgendaForOwner(ownerEmail, options);
  const telefoneIndex = await loadPacienteTelefoneIndex(ownerEmail);

  return rows.map((r) => ({
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
}

export function isAgendaViewTableMissing(error: unknown): boolean {
  const e = error as { code?: string; message?: string };
  return isConsultasAgendaTableMissing(e);
}
