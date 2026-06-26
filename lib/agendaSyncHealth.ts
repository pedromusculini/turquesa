import type { ConsultaAgendaRow, ConsultaSyncInput } from '@/lib/consultasAgenda';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { normalizeBrazilPhone } from '@/lib/whatsapp';

export type AgendaSyncHealth =
  | 'google_only'
  | 'turquesa_only'
  | 'linked_partial'
  | 'linked_ok'
  | 'needs_review';

export type TelefoneIndex = {
  byDriveId: Map<string, string>;
  byNome: Map<string, string>;
};

export type PacienteEnrichmentIndex = TelefoneIndex & {
  driveIdByNome: Map<string, string>;
};

export function isValidAgendaTelefone(telefone: string | null | undefined): boolean {
  const digits = telefone?.replace(/\D/g, '') ?? '';
  return digits.length >= 10;
}

export function resolveAgendaTelefone(
  row: Pick<ConsultaAgendaRow, 'telefone' | 'cliente_drive_id' | 'paciente'>,
  index: TelefoneIndex,
): string | null {
  const direct = row.telefone?.replace(/\D/g, '');
  if (direct?.length) return row.telefone;

  if (row.cliente_drive_id) {
    const fromDrive = index.byDriveId.get(row.cliente_drive_id);
    if (fromDrive?.replace(/\D/g, '').length) return fromDrive;
  }

  const nomeKey = row.paciente.trim().toLowerCase();
  if (nomeKey) {
    const fromNome = index.byNome.get(nomeKey);
    if (fromNome?.replace(/\D/g, '').length) return fromNome;
  }

  return null;
}

/** Calcula saúde de vínculo Turquesa ↔ Google; `needs_review` vem do Postgres (Fase 5). */
export function computeAgendaSyncHealth(
  row: ConsultaAgendaRow,
  index: TelefoneIndex,
): AgendaSyncHealth {
  if (row.sync_health === 'needs_review') return 'needs_review';

  const hasGoogle = !!row.google_event_id?.trim();
  if (!hasGoogle) return 'turquesa_only';

  const hasCliente = !!row.cliente_drive_id?.trim();
  const telefone = resolveAgendaTelefone(row, index);
  const hasTel = isValidAgendaTelefone(telefone);

  if (hasCliente && hasTel) return 'linked_ok';
  if (hasCliente || hasTel) return 'linked_partial';
  return 'google_only';
}

export type AgendaSyncHealthCounts = Record<AgendaSyncHealth, number>;

export function emptyAgendaSyncHealthCounts(): AgendaSyncHealthCounts {
  return {
    google_only: 0,
    turquesa_only: 0,
    linked_partial: 0,
    linked_ok: 0,
    needs_review: 0,
  };
}

/** Contagem por estado de vínculo Turquesa ↔ Google (admin / diagnóstico). */
export async function countAgendaSyncHealthForOwner(
  ownerEmail: string,
): Promise<AgendaSyncHealthCounts> {
  const owner = ownerEmail.toLowerCase().trim();
  const counts = emptyAgendaSyncHealthCounts();

  const { data, error } = await supabaseAdmin
    .from('consultas_agenda')
    .select(
      'id, google_event_id, sync_health, cliente_drive_id, telefone, paciente',
    )
    .eq('owner_email', owner);

  if (error) {
    if (error.code === 'PGRST205') return counts;
    throw error;
  }

  const index = await loadPacienteTelefoneIndex(owner);
  for (const row of data ?? []) {
    const health = computeAgendaSyncHealth(row as ConsultaAgendaRow, index);
    counts[health] += 1;
  }

  return counts;
}

export async function loadPacienteTelefoneIndex(owner: string): Promise<TelefoneIndex> {
  const { byDriveId, byNome } = await loadPacienteEnrichmentIndex(owner);
  return { byDriveId, byNome };
}

/** Índice em memória para enriquecer consultas (telefone + cliente Drive por nome). */
export async function loadPacienteEnrichmentIndex(
  owner: string,
): Promise<PacienteEnrichmentIndex> {
  const byDriveId = new Map<string, string>();
  const byNome = new Map<string, string>();
  const driveIdByNome = new Map<string, string>();

  const { data, error } = await supabaseAdmin
    .from('pacientes_index')
    .select('cliente_drive_id, nome, telefone_normalizado')
    .eq('owner_email', owner)
    .order('updated_at', { ascending: false });

  if (error) {
    if (error.code === 'PGRST205') return { byDriveId, byNome, driveIdByNome };
    throw error;
  }

  for (const row of data ?? []) {
    const tel = row.telefone_normalizado as string | null;
    const driveId = row.cliente_drive_id as string | null;
    const nomeKey = String(row.nome ?? '')
      .trim()
      .toLowerCase();

    if (tel?.replace(/\D/g, '').length) {
      if (driveId && !byDriveId.has(driveId)) byDriveId.set(driveId, tel);
      if (nomeKey && !byNome.has(nomeKey)) byNome.set(nomeKey, tel);
    }
    if (driveId && nomeKey && !driveIdByNome.has(nomeKey)) {
      driveIdByNome.set(nomeKey, driveId);
    }
  }

  return { byDriveId, byNome, driveIdByNome };
}

/** Enriquece telefone e cliente_drive_id sem consultas por evento. */
export function enrichConsultaSyncInput(
  row: ConsultaSyncInput,
  index: PacienteEnrichmentIndex,
): ConsultaSyncInput {
  let clienteDriveId = row.cliente_drive_id ?? null;
  const nomeKey = row.paciente.trim().toLowerCase();
  if (!clienteDriveId && nomeKey) {
    clienteDriveId = index.driveIdByNome.get(nomeKey) ?? null;
  }

  const telefoneRaw = resolveAgendaTelefone(
    {
      telefone: row.telefone ?? null,
      cliente_drive_id: clienteDriveId,
      paciente: row.paciente,
    },
    index,
  );

  return {
    ...row,
    telefone: telefoneRaw ? normalizeBrazilPhone(telefoneRaw) : null,
    cliente_drive_id: clienteDriveId,
  };
}
