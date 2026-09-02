import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { ClienteDriveRecord, ClientesDriveStore } from '@/lib/clientesDrive';
import { consultaMatchesCliente } from '@/lib/clienteConsultaLinks';
import { resolveMergedPrimaryId } from '@/lib/clientesGoogleSync';
import { supabaseAdmin } from '@/lib/supabaseClient';

const TZ = 'America/Sao_Paulo';

type AgendaRealizadaRow = {
  cliente_drive_id: string | null;
  inicio: string;
  paciente: string;
  telefone?: string | null;
  deleted_at?: string | null;
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

/** Mapa cliente_drive_id (primário) → última sessão realizada na agenda. */
export async function buildAgendaUltimaSessaoPorCliente(
  ownerEmail: string,
  store: ClientesDriveStore,
): Promise<Map<string, Date>> {
  const owner = ownerEmail.toLowerCase().trim();
  const map = new Map<string, Date>();

  const { data, error } = await supabaseAdmin
    .from('consultas_agenda')
    .select('cliente_drive_id, inicio, paciente, telefone, deleted_at')
    .eq('owner_email', owner)
    .eq('status', 'realizado')
    .is('deleted_at', null);

  if (error) {
    if (error.code === 'PGRST205') return map;
    throw error;
  }

  const rows = (data ?? []) as AgendaRealizadaRow[];

  for (const row of rows) {
    if (row.cliente_drive_id) {
      const primaryId = resolveMergedPrimaryId(store, String(row.cliente_drive_id));
      bumpMax(map, primaryId, new Date(row.inicio));
      continue;
    }
    for (const c of store.clientes) {
      if (!consultaMatchesCliente(row, c)) continue;
      bumpMax(map, c.id, new Date(row.inicio));
    }
  }

  return map;
}

/** Última sessão realizada = ficha Drive + agenda (o mais recente). */
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
