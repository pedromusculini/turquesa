import type { ClienteDriveRecord, ClientesDriveStore } from '@/lib/clientesDrive';
import { nomesMatch, phonesMatch } from '@/lib/phoneMatch';
import { telefonePreenchido } from '@/lib/pacienteOpcoesUi';
import { supabaseAdmin } from '@/lib/supabaseClient';

export type ClienteAgendaConsulta = {
  id: string;
  inicio: string;
  fim: string | null;
  medico: string | null;
  servico: string | null;
  status: string | null;
};

type ConsultaRow = {
  id: string;
  inicio: string;
  fim: string | null;
  medico: string | null;
  servico: string | null;
  status: string | null;
  paciente?: string | null;
  telefone?: string | null;
  cliente_drive_id?: string | null;
};

/** IDs de cadastro que devem ser considerados o mesmo cliente (unificação). */
export function collectClienteDriveIdsForLookup(
  cliente: ClienteDriveRecord,
  store?: ClientesDriveStore | null,
): string[] {
  const ids = new Set<string>([cliente.id]);
  for (const mid of cliente.merged_from_cliente_ids ?? []) {
    if (mid) ids.add(mid);
  }
  const map = store?.clientes_merge_map ?? {};
  for (const [secondaryId, primaryId] of Object.entries(map)) {
    if (primaryId === cliente.id) ids.add(secondaryId);
  }
  return Array.from(ids);
}

function rowToAgendaConsulta(c: ConsultaRow): ClienteAgendaConsulta {
  return {
    id: String(c.id),
    inicio: String(c.inicio),
    fim: c.fim ? String(c.fim) : null,
    medico: c.medico ? String(c.medico) : null,
    servico: c.servico ? String(c.servico) : null,
    status: c.status ? String(c.status) : null,
  };
}

export function consultaMatchesCliente(
  row: Pick<ConsultaRow, 'paciente' | 'telefone'>,
  cliente: Pick<ClienteDriveRecord, 'nome' | 'telefone'>,
): boolean {
  const nomeOk =
    row.paciente && cliente.nome.trim().length >= 2
      ? nomesMatch(String(row.paciente), cliente.nome)
      : false;
  const telOk =
    telefonePreenchido(cliente.telefone) && row.telefone
      ? phonesMatch(String(row.telefone), cliente.telefone)
      : false;
  return nomeOk || telOk;
}

const CONSULTA_SELECT =
  'id, inicio, fim, medico, servico, status, paciente, telefone, cliente_drive_id';

/** Carrega sessões da agenda ligadas ao cliente (IDs mesclados + fallback telefone/nome). */
export async function fetchAgendaConsultasForCliente(
  ownerEmail: string,
  cliente: ClienteDriveRecord,
  store?: ClientesDriveStore | null,
): Promise<ClienteAgendaConsulta[]> {
  const owner = ownerEmail.toLowerCase().trim();
  const driveIds = collectClienteDriveIdsForLookup(cliente, store);
  const seen = new Set<string>();
  const out: ClienteAgendaConsulta[] = [];

  const pushRows = (rows: ConsultaRow[] | null | undefined) => {
    for (const row of rows ?? []) {
      const id = String(row.id);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(rowToAgendaConsulta(row));
    }
  };

  if (driveIds.length > 0) {
    const { data } = await supabaseAdmin
      .from('consultas_agenda')
      .select(CONSULTA_SELECT)
      .eq('owner_email', owner)
      .in('cliente_drive_id', driveIds)
      .is('deleted_at', null)
      .order('inicio', { ascending: false })
      .limit(50);
    pushRows(data as ConsultaRow[] | null);
  }

  if (out.length >= 50) {
    return out.sort((a, b) => b.inicio.localeCompare(a.inicio)).slice(0, 50);
  }

  const { data: orphans } = await supabaseAdmin
    .from('consultas_agenda')
    .select(CONSULTA_SELECT)
    .eq('owner_email', owner)
    .is('cliente_drive_id', null)
    .is('deleted_at', null)
    .order('inicio', { ascending: false })
    .limit(120);

  const orphanMatches = (orphans as ConsultaRow[] | null)?.filter((row) =>
    consultaMatchesCliente(row, cliente),
  );
  pushRows(orphanMatches);

  if (out.length >= 50) {
    return out.sort((a, b) => b.inicio.localeCompare(a.inicio)).slice(0, 50);
  }

  const activeIds = new Set(store?.clientes.map((c) => c.id) ?? [cliente.id]);

  const { data: mislinked } = await supabaseAdmin
    .from('consultas_agenda')
    .select(CONSULTA_SELECT)
    .eq('owner_email', owner)
    .not('cliente_drive_id', 'is', null)
    .neq('cliente_drive_id', cliente.id)
    .is('deleted_at', null)
    .order('inicio', { ascending: false })
    .limit(80);

  for (const row of (mislinked as ConsultaRow[] | null) ?? []) {
    const cid = row.cliente_drive_id ? String(row.cliente_drive_id) : '';
    if (!cid || driveIds.includes(cid) || activeIds.has(cid)) continue;
    if (!consultaMatchesCliente(row, cliente)) continue;
    pushRows([row]);
    if (out.length >= 50) break;
  }

  return out.sort((a, b) => b.inicio.localeCompare(a.inicio)).slice(0, 50);
}

/** Reponta consultas órfãs / IDs mesclados para o cadastro primário (pós-unificação). */
export async function repairClienteConsultaLinks(
  ownerEmail: string,
  primaryId: string,
  cliente: Pick<ClienteDriveRecord, 'nome' | 'telefone'>,
  store?: ClientesDriveStore | null,
  mergedFromIds: string[] = [],
): Promise<number> {
  const owner = ownerEmail.toLowerCase().trim();
  const driveIds = new Set<string>([primaryId, ...mergedFromIds]);
  const map = store?.clientes_merge_map ?? {};
  for (const [secondaryId, prim] of Object.entries(map)) {
    if (prim === primaryId) driveIds.add(secondaryId);
  }

  let updated = 0;

  for (const oldId of driveIds) {
    if (oldId === primaryId) continue;
    const { data, error } = await supabaseAdmin
      .from('consultas_agenda')
      .update({ cliente_drive_id: primaryId })
      .eq('owner_email', owner)
      .eq('cliente_drive_id', oldId)
      .select('id');

    if (error && error.code !== 'PGRST205') {
      throw new Error(`Erro ao repontar consultas (${oldId}): ${error.message}`);
    }
    updated += data?.length ?? 0;
  }

  const { data: orphans, error: orphanErr } = await supabaseAdmin
    .from('consultas_agenda')
    .select('id, paciente, telefone')
    .eq('owner_email', owner)
    .is('cliente_drive_id', null)
    .order('inicio', { ascending: false })
    .limit(500);

  if (orphanErr && orphanErr.code !== 'PGRST205') {
    throw new Error(`Erro ao listar consultas órfãs: ${orphanErr.message}`);
  }

  const activeIds = new Set(store?.clientes.map((c) => c.id) ?? [primaryId]);
  const orphanIds = (orphans ?? [])
    .filter((row) => consultaMatchesCliente(row as ConsultaRow, cliente))
    .map((row) => String(row.id));

  if (orphanIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from('consultas_agenda')
      .update({ cliente_drive_id: primaryId })
      .eq('owner_email', owner)
      .in('id', orphanIds)
      .select('id');

    if (error && error.code !== 'PGRST205') {
      throw new Error(`Erro ao vincular consultas órfãs: ${error.message}`);
    }
    updated += data?.length ?? 0;
  }

  const { data: mislinked, error: misErr } = await supabaseAdmin
    .from('consultas_agenda')
    .select('id, paciente, telefone, cliente_drive_id')
    .eq('owner_email', owner)
    .not('cliente_drive_id', 'is', null)
    .neq('cliente_drive_id', primaryId)
    .order('inicio', { ascending: false })
    .limit(300);

  if (misErr && misErr.code !== 'PGRST205') {
    throw new Error(`Erro ao listar consultas desalinhadas: ${misErr.message}`);
  }

  const mislinkedIds = (mislinked ?? [])
    .filter((row) => {
      const cid = row.cliente_drive_id ? String(row.cliente_drive_id) : '';
      if (!cid || driveIds.has(cid) || activeIds.has(cid)) return false;
      return consultaMatchesCliente(row as ConsultaRow, cliente);
    })
    .map((row) => String(row.id));

  if (mislinkedIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from('consultas_agenda')
      .update({ cliente_drive_id: primaryId })
      .eq('owner_email', owner)
      .in('id', mislinkedIds)
      .select('id');

    if (error && error.code !== 'PGRST205') {
      throw new Error(`Erro ao vincular consultas desalinhadas: ${error.message}`);
    }
    updated += data?.length ?? 0;
  }

  return updated;
}
