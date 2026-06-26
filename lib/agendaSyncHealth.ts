import type { ConsultaAgendaRow } from '@/lib/consultasAgenda';
import { supabaseAdmin } from '@/lib/supabaseClient';

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
  const byDriveId = new Map<string, string>();
  const byNome = new Map<string, string>();

  const { data, error } = await supabaseAdmin
    .from('pacientes_index')
    .select('cliente_drive_id, nome, telefone_normalizado')
    .eq('owner_email', owner)
    .not('telefone_normalizado', 'is', null);

  if (error) {
    if (error.code === 'PGRST205') return { byDriveId, byNome };
    throw error;
  }

  for (const row of data ?? []) {
    const tel = row.telefone_normalizado as string | null;
    if (!tel?.replace(/\D/g, '').length) continue;
    const driveId = row.cliente_drive_id as string | null;
    if (driveId && !byDriveId.has(driveId)) byDriveId.set(driveId, tel);
    const nomeKey = String(row.nome ?? '')
      .trim()
      .toLowerCase();
    if (nomeKey && !byNome.has(nomeKey)) byNome.set(nomeKey, tel);
  }

  return { byDriveId, byNome };
}
