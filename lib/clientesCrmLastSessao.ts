import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { ClienteDriveRecord, ClientesDriveStore } from '@/lib/clientesDrive';
import {
  collectClienteDriveIdsForLookup,
  consultaMatchesCliente,
} from '@/lib/clienteConsultaLinks';
import { resolveMergedPrimaryId } from '@/lib/clientesGoogleSync';
import { nomesMatch } from '@/lib/phoneMatch';
import { supabaseAdmin } from '@/lib/supabaseClient';

const TZ = 'America/Sao_Paulo';

type AgendaRealizadaRow = {
  id?: string;
  cliente_drive_id: string | null;
  inicio: string;
  paciente: string;
  telefone?: string | null;
  deleted_at?: string | null;
};

type FinanceiroEntradaRow = {
  data: string;
  descricao: string | null;
};

/** Data/hora do atendimento no fuso do salão → Date absoluto. */
export function parseAtendimentoDateBr(data: string, hora: string | null | undefined): Date {
  const day = data.includes('T') ? data.slice(0, 10) : data.slice(0, 10);
  const h = hora?.trim() ? hora.trim().slice(0, 5) : '12:00';
  const [hh, mm] = h.split(':');
  const iso = `${day}T${String(hh ?? '12').padStart(2, '0')}:${String(mm ?? '0').padStart(2, '0')}:00-03:00`;
  return new Date(iso);
}

function brDateKey(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: TZ });
}

/** Dias de calendário (SP) entre a última sessão e a data de referência. */
export function diasDesdeUltimaSessao(ref: Date, ultimo: Date): number {
  return differenceInCalendarDays(parseISO(brDateKey(ref)), parseISO(brDateKey(ultimo)));
}

function bumpMax(map: Map<string, Date>, clienteId: string, candidate: Date) {
  const cur = map.get(clienteId);
  if (!cur || candidate > cur) map.set(clienteId, candidate);
}

/** Sessão realizada na agenda pertence ao cliente (ID mesclado, vínculo ou nome/telefone). */
export function consultaPertenceCliente(
  row: Pick<AgendaRealizadaRow, 'cliente_drive_id' | 'paciente' | 'telefone'>,
  cliente: ClienteDriveRecord,
  store: ClientesDriveStore,
): boolean {
  const clientePrimary = resolveMergedPrimaryId(store, cliente.id);
  const driveIds = new Set(collectClienteDriveIdsForLookup(cliente, store));

  if (row.cliente_drive_id) {
    const linkedPrimary = resolveMergedPrimaryId(store, String(row.cliente_drive_id));
    if (linkedPrimary === clientePrimary) return true;
    if (driveIds.has(String(row.cliente_drive_id))) return true;
  }

  return consultaMatchesCliente(row, cliente);
}

/** Entrada no financeiro referente ao cliente (descrição com nome). */
function entradaFinanceiroMatchesCliente(
  row: FinanceiroEntradaRow,
  cliente: ClienteDriveRecord,
): boolean {
  const desc = String(row.descricao ?? '').trim();
  if (!desc) return false;
  if (nomesMatch(desc, cliente.nome)) return true;
  const first = cliente.nome.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  if (first.length >= 3 && desc.toLowerCase().includes(first)) return true;
  return false;
}

/** Última sessão realizada registrada na ficha Drive. */
export function lastSessaoRealizadaDrive(c: ClienteDriveRecord): Date | null {
  let max: Date | null = null;
  for (const a of c.atendimentos ?? []) {
    if (a.status !== 'realizado') continue;
    const d = parseAtendimentoDateBr(a.data, a.hora);
    if (!max || d > max) max = d;
  }
  return max;
}

async function fetchConsultasRealizadas(owner: string): Promise<AgendaRealizadaRow[]> {
  const { data, error } = await supabaseAdmin
    .from('consultas_agenda')
    .select('id, cliente_drive_id, inicio, paciente, telefone, deleted_at')
    .eq('owner_email', owner)
    .eq('status', 'realizado')
    .is('deleted_at', null);

  if (error) {
    if (error.code === 'PGRST205') return [];
    throw error;
  }
  return (data ?? []) as AgendaRealizadaRow[];
}

async function fetchEntradasFinanceiro(owner: string): Promise<FinanceiroEntradaRow[]> {
  const { data, error } = await supabaseAdmin
    .from('financeiro_transacoes')
    .select('data, descricao')
    .eq('owner_email', owner)
    .eq('tipo', 'entrada')
    .order('data', { ascending: false })
    .limit(800);

  if (error) {
    if (error.code === 'PGRST205') return [];
    throw error;
  }
  return (data ?? []) as FinanceiroEntradaRow[];
}

/**
 * Mapa cliente → última sessão realizada fora da ficha Drive:
 * agenda Supabase (realizado) + entradas financeiras pagas.
 */
export async function buildAgendaUltimaSessaoPorCliente(
  ownerEmail: string,
  store: ClientesDriveStore,
): Promise<Map<string, Date>> {
  const owner = ownerEmail.toLowerCase().trim();
  const map = new Map<string, Date>();

  const [consultas, entradas] = await Promise.all([
    fetchConsultasRealizadas(owner),
    fetchEntradasFinanceiro(owner),
  ]);

  for (const c of store.clientes) {
    for (const row of consultas) {
      if (!consultaPertenceCliente(row, c, store)) continue;
      bumpMax(map, c.id, new Date(row.inicio));
    }

    for (const row of entradas) {
      if (!entradaFinanceiroMatchesCliente(row, c)) continue;
      bumpMax(map, c.id, parseAtendimentoDateBr(String(row.data), '12:00'));
    }
  }

  return map;
}

/** Última sessão realizada = ficha Drive + agenda/financeiro (o mais recente). */
export function lastSessaoRealizadaCliente(
  c: ClienteDriveRecord,
  agendaPorCliente?: Map<string, Date>,
): Date | null {
  let max = lastSessaoRealizadaDrive(c);
  const fromAgenda = agendaPorCliente?.get(c.id);
  if (fromAgenda && (!max || fromAgenda > max)) max = fromAgenda;
  return max;
}

export function formatUltimaSessaoIso(d: Date): string {
  return d.toISOString();
}
