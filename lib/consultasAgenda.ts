import { supabaseAdmin } from '@/lib/supabaseClient';
import type { ConsultaStatus } from '@/lib/consultations';
import { getLembretesSettings } from '@/lib/lembretesSettings';
import { normalizeBrazilPhone } from '@/lib/whatsapp';

export type ConsultaAgendaRow = {
  id: string;
  owner_email: string;
  paciente: string;
  servico: string;
  telefone: string | null;
  inicio: string;
  fim: string | null;
  local: string | null;
  google_event_id: string | null;
  medico: string | null;
  convenio: string | null;
  status: ConsultaStatus;
  lembretes_whatsapp: boolean;
  cliente_drive_id?: string | null;
};

export type ConsultaSyncInput = {
  id: string;
  paciente: string;
  servico?: string;
  telefone?: string | null;
  inicio: string;
  fim?: string | null;
  local?: string | null;
  google_event_id?: string | null;
  medico?: string | null;
  convenio?: string | null;
  status?: ConsultaStatus;
  lembretes_whatsapp?: boolean;
  cliente_drive_id?: string | null;
};

const MS_DAY = 24 * 60 * 60 * 1000;

export function isConsultasAgendaTableMissing(error: { code?: string; message?: string }): boolean {
  return error.code === 'PGRST205' || (error.message?.includes('consultas_agenda') ?? false);
}

export async function upsertConsultasAgenda(
  ownerEmail: string,
  consultas: ConsultaSyncInput[],
): Promise<{ upserted: number }> {
  const owner = ownerEmail.toLowerCase().trim();
  const now = new Date().toISOString();
  const rows = consultas
    .filter((c) => c.id && c.paciente?.trim() && c.inicio)
    .map((c) => ({
      id: String(c.id),
      owner_email: owner,
      paciente: c.paciente.trim(),
      servico: (c.servico ?? 'Atendimento').trim(),
      telefone: c.telefone?.trim()
        ? normalizeBrazilPhone(c.telefone)
        : null,
      inicio: c.inicio,
      fim: c.fim ?? null,
      local: c.local ?? null,
      google_event_id: c.google_event_id ?? null,
      medico: c.medico ?? null,
      convenio: c.convenio ?? null,
      status: c.status ?? 'agendado',
      lembretes_whatsapp: c.lembretes_whatsapp !== false,
      cliente_drive_id: c.cliente_drive_id ?? null,
      updated_at: now,
    }));

  if (rows.length === 0) return { upserted: 0 };

  const ids = rows.map((r) => r.id);
  const existingById = new Map<
    string,
    Pick<ConsultaAgendaRow, 'telefone' | 'cliente_drive_id' | 'medico'>
  >();

  if (ids.length > 0) {
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('consultas_agenda')
      .select('id, telefone, cliente_drive_id, medico')
      .eq('owner_email', owner)
      .in('id', ids);
    if (fetchErr) throw fetchErr;
    for (const row of existing ?? []) {
      existingById.set(String(row.id), row);
    }
  }

  /** Sync em massa (ex.: Google) não apaga telefone/medico já preenchidos no Supabase. */
  const mergedRows = rows.map((row) => {
    const prev = existingById.get(row.id);
    if (!prev) return row;
    return {
      ...row,
      telefone: row.telefone ?? prev.telefone ?? null,
      cliente_drive_id: row.cliente_drive_id ?? prev.cliente_drive_id ?? null,
      medico: row.medico ?? prev.medico ?? null,
    };
  });

  const { error } = await supabaseAdmin.from('consultas_agenda').upsert(mergedRows, {
    onConflict: 'id',
  });

  if (error) throw error;
  return { upserted: rows.length };
}

export async function deleteConsultasAgenda(
  ownerEmail: string,
  options: { ids?: string[]; googleEventIds?: string[] },
): Promise<{ deleted: number }> {
  const owner = ownerEmail.toLowerCase().trim();
  let deleted = 0;

  const ids = [...new Set((options.ids ?? []).map(String).filter(Boolean))];
  if (ids.length > 0) {
    const { error, count } = await supabaseAdmin
      .from('consultas_agenda')
      .delete({ count: 'exact' })
      .eq('owner_email', owner)
      .in('id', ids);
    if (error) throw error;
    deleted += count ?? 0;
  }

  const googleEventIds = [...new Set((options.googleEventIds ?? []).map(String).filter(Boolean))];
  if (googleEventIds.length > 0) {
    const { error, count } = await supabaseAdmin
      .from('consultas_agenda')
      .delete({ count: 'exact' })
      .eq('owner_email', owner)
      .in('google_event_id', googleEventIds);
    if (error) throw error;
    deleted += count ?? 0;
  }

  return { deleted };
}

export async function updateConsultaAgendaStatus(
  consultaId: string,
  ownerEmail: string,
  status: ConsultaStatus,
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('consultas_agenda')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', consultaId)
    .eq('owner_email', ownerEmail.toLowerCase().trim())
    .select('id')
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

/** Lista atendimentos do owner em janela ampla (grade + sync cross-device). */
export async function listConsultasAgendaForOwner(
  ownerEmail: string,
  options?: { daysPast?: number; daysFuture?: number },
): Promise<ConsultaAgendaRow[]> {
  const daysPast = options?.daysPast ?? 180;
  const daysFuture = options?.daysFuture ?? 365;
  const owner = ownerEmail.toLowerCase().trim();
  const minDate = new Date(Date.now() - daysPast * MS_DAY).toISOString();
  const maxDate = new Date(Date.now() + daysFuture * MS_DAY).toISOString();

  const { data, error } = await supabaseAdmin
    .from('consultas_agenda')
    .select('*')
    .eq('owner_email', owner)
    .gte('inicio', minDate)
    .lte('inicio', maxDate)
    .order('inicio', { ascending: true });

  if (error) throw error;
  return (data ?? []) as ConsultaAgendaRow[];
}

export async function getConsultaAgendaById(
  consultaId: string,
): Promise<ConsultaAgendaRow | null> {
  const { data, error } = await supabaseAdmin
    .from('consultas_agenda')
    .select('*')
    .eq('id', consultaId)
    .maybeSingle();

  if (error) throw error;
  return data as ConsultaAgendaRow | null;
}

export type LembreteTipo = 'd7' | 'd1';

function windowForTipo(tipo: LembreteTipo): { minMs: number; maxMs: number } {
  const now = Date.now();
  if (tipo === 'd7') {
    const target = 7 * MS_DAY;
    return { minMs: target - 12 * 60 * 60 * 1000, maxMs: target + 12 * 60 * 60 * 1000 };
  }
  const target = MS_DAY;
  return { minMs: target - 6 * 60 * 60 * 1000, maxMs: target + 6 * 60 * 60 * 1000 };
}

export async function listConsultasParaLembrete(tipo: LembreteTipo): Promise<ConsultaAgendaRow[]> {
  const { minMs, maxMs } = windowForTipo(tipo);
  const minDate = new Date(Date.now() + minMs).toISOString();
  const maxDate = new Date(Date.now() + maxMs).toISOString();

  const { data, error } = await supabaseAdmin
    .from('consultas_agenda')
    .select('*')
    .eq('lembretes_whatsapp', true)
    .in('status', ['agendado', 'confirmado'])
    .gte('inicio', minDate)
    .lte('inicio', maxDate)
    .not('telefone', 'is', null);

  if (error) throw error;
  return (data ?? []) as ConsultaAgendaRow[];
}

export async function wasLembreteEnviado(
  consultaId: string,
  tipo: LembreteTipo,
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('whatsapp_lembrete_enviado')
    .select('id')
    .eq('consulta_id', consultaId)
    .eq('lembrete_tipo', tipo)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST205') return false;
    throw error;
  }
  return !!data;
}

export async function markLembreteEnviado(params: {
  consultaId: string;
  ownerEmail: string;
  tipo: LembreteTipo | 'criacao';
  filaId?: string;
}): Promise<void> {
  const { error } = await supabaseAdmin.from('whatsapp_lembrete_enviado').insert({
    consulta_id: params.consultaId,
    owner_email: params.ownerEmail.toLowerCase().trim(),
    lembrete_tipo: params.tipo,
    fila_id: params.filaId ?? null,
  });

  if (error && error.code !== '23505') throw error;
}

const BR_TIMEZONE = 'America/Sao_Paulo';

function brDateKey(iso: string): string {
  const trimmed = String(iso).trim();
  // YYYY-MM-DD (ex.: Google dia inteiro): data civil em SP, não UTC midnight
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return trimmed.slice(0, 10);
  return d.toLocaleDateString('en-CA', { timeZone: BR_TIMEZONE });
}

function brTodayKey(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: BR_TIMEZONE });
}

function addDaysToKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** Limites do dia civil em SP para filtrar `inicio` no Supabase. */
function brDayBoundsInicio(targetKey: string): { min: string; max: string } {
  return {
    min: `${targetKey}T00:00:00-03:00`,
    max: `${targetKey}T23:59:59.999-03:00`,
  };
}

async function telefoneFromPacienteIndex(
  ownerEmail: string,
  clienteDriveId: string,
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('pacientes_index')
    .select('telefone_normalizado')
    .eq('owner_email', ownerEmail.toLowerCase().trim())
    .eq('cliente_drive_id', clienteDriveId)
    .not('telefone_normalizado', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST205') return null;
    throw error;
  }
  return data?.telefone_normalizado ?? null;
}

async function resolveConsultaTelefone(
  owner: string,
  row: ConsultaAgendaRow,
): Promise<string | null> {
  const direct = row.telefone?.replace(/\D/g, '');
  if (direct?.length) return row.telefone;

  if (row.cliente_drive_id) {
    const fromIndex = await telefoneFromPacienteIndex(owner, row.cliente_drive_id);
    if (fromIndex?.replace(/\D/g, '').length) return fromIndex;
  }

  return null;
}

export async function listConsultasLembretesManuais(
  ownerEmail: string,
  tipo: LembreteTipo,
): Promise<ConsultaAgendaRow[]> {
  const owner = ownerEmail.toLowerCase().trim();
  const settings = await getLembretesSettings(owner);
  if (tipo === 'd7' && !settings.lembrete_antecedencia_ativo) return [];
  if (tipo === 'd1' && !settings.lembrete_1_dia_ativo) return [];
  const offset = tipo === 'd7' ? settings.lembrete_antecedencia_dias : 1;
  const targetKey = addDaysToKey(brTodayKey(), offset);
  const { min, max } = brDayBoundsInicio(targetKey);

  const { data, error } = await supabaseAdmin
    .from('consultas_agenda')
    .select('*')
    .eq('owner_email', owner)
    .eq('lembretes_whatsapp', true)
    .in('status', ['agendado', 'confirmado'])
    .gte('inicio', min)
    .lte('inicio', max);

  if (error) throw error;

  const rows = (data ?? []) as ConsultaAgendaRow[];
  const filtered: ConsultaAgendaRow[] = [];

  for (const row of rows) {
    if (brDateKey(row.inicio) !== targetKey) continue;
    const telefone = await resolveConsultaTelefone(owner, row);
    if (!telefone?.replace(/\D/g, '').length) continue;
    const sent = await wasLembreteEnviado(row.id, tipo);
    if (!sent) filtered.push({ ...row, telefone });
  }

  return filtered.sort((a, b) => a.inicio.localeCompare(b.inicio));
}
