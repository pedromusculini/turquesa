import { supabaseAdmin } from '@/lib/supabaseClient';
import { preferConsultaStatus, type ConsultaStatus } from '@/lib/consultations';
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
  observacoes?: string | null;
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
  observacoes?: string | null;
};

const MS_DAY = 24 * 60 * 60 * 1000;

/** Prefere id local (local-*) sobre id derivado do Google (google-*). */
export function preferCanonicalConsultaId(a: string, b: string): string {
  const aGoogle = a.startsWith('google-');
  const bGoogle = b.startsWith('google-');
  if (aGoogle !== bGoogle) return aGoogle ? b : a;
  return a;
}

async function loadIdByGoogleEventIdForOwner(
  owner: string,
  googleEventIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const ids = [...new Set(googleEventIds.filter(Boolean))];
  if (ids.length === 0) return map;

  const { data, error } = await supabaseAdmin
    .from('consultas_agenda')
    .select('id, google_event_id')
    .eq('owner_email', owner)
    .in('google_event_id', ids);

  if (error) throw error;
  for (const row of data ?? []) {
    if (!row.google_event_id) continue;
    const gid = String(row.google_event_id);
    const existing = map.get(gid);
    map.set(gid, existing ? preferCanonicalConsultaId(existing, String(row.id)) : String(row.id));
  }
  return map;
}

/** Remove linhas duplicadas com o mesmo google_event_id (race local vs Google sync). */
async function dedupeGoogleEventIdRows(
  owner: string,
  googleEventIds: string[],
): Promise<void> {
  const unique = [...new Set(googleEventIds.filter(Boolean))];
  if (unique.length === 0) return;

  for (const gid of unique) {
    const { data: rows, error } = await supabaseAdmin
      .from('consultas_agenda')
      .select('id')
      .eq('owner_email', owner)
      .eq('google_event_id', gid);

    if (error) throw error;
    if (!rows || rows.length <= 1) continue;

    const keepId = rows
      .map((r) => String(r.id))
      .reduce((best, id) => preferCanonicalConsultaId(best, id));
    const deleteIds = rows.map((r) => String(r.id)).filter((id) => id !== keepId);
    if (deleteIds.length === 0) continue;

    const { error: delErr } = await supabaseAdmin
      .from('consultas_agenda')
      .delete()
      .eq('owner_email', owner)
      .in('id', deleteIds);
    if (delErr) throw delErr;
  }
}

export function isConsultasAgendaTableMissing(error: { code?: string; message?: string }): boolean {
  return error.code === 'PGRST205' || (error.message?.includes('consultas_agenda') ?? false);
}

/** Mensagem legível a partir de erros PostgREST/Supabase (não são instanceof Error). */
export function consultasAgendaErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message.trim()) return err.message;
  if (err && typeof err === 'object') {
    const o = err as { message?: string; details?: string; hint?: string; code?: string };
    if (typeof o.message === 'string' && o.message.trim()) return o.message;
    if (typeof o.details === 'string' && o.details.trim()) return o.details;
    if (typeof o.hint === 'string' && o.hint.trim()) return o.hint;
    if (typeof o.code === 'string' && o.code.trim()) return `Erro ${o.code} ao salvar atendimento.`;
  }
  return 'Erro ao sincronizar atendimentos';
}

/** Libera google_event_id em outras linhas antes do upsert (evita unique violation). */
async function releaseGoogleEventIdForOtherRows(
  owner: string,
  keepConsultaId: string,
  googleEventId: string,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('consultas_agenda')
    .update({ google_event_id: null, updated_at: new Date().toISOString() })
    .eq('owner_email', owner)
    .eq('google_event_id', googleEventId)
    .neq('id', keepConsultaId);

  if (error) throw error;
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
      status: c.status ?? 'confirmado',
      lembretes_whatsapp: c.lembretes_whatsapp !== false,
      cliente_drive_id: c.cliente_drive_id ?? null,
      observacoes: c.observacoes?.trim() ? c.observacoes.trim() : null,
      updated_at: now,
    }));

  if (rows.length === 0) return { upserted: 0 };

  const googleEventIds = rows
    .map((r) => r.google_event_id)
    .filter((gid): gid is string => !!gid);
  const idByGoogleEvent = await loadIdByGoogleEventIdForOwner(owner, googleEventIds);

  const canonicalRows = rows.map((row) => {
    const gid = row.google_event_id;
    if (!gid) return row;
    const existingId = idByGoogleEvent.get(gid);
    if (!existingId || existingId === row.id) return row;
    return { ...row, id: preferCanonicalConsultaId(row.id, existingId) };
  });

  const ids = canonicalRows.map((r) => r.id);
  const existingById = new Map<
    string,
      Pick<
      ConsultaAgendaRow,
      'telefone' | 'cliente_drive_id' | 'medico' | 'lembretes_whatsapp' | 'status' | 'observacoes'
    >
  >();

  if (ids.length > 0) {
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('consultas_agenda')
      .select('id, telefone, cliente_drive_id, medico, lembretes_whatsapp, status, observacoes')
      .eq('owner_email', owner)
      .in('id', ids);
    if (fetchErr) throw fetchErr;
    for (const row of existing ?? []) {
      existingById.set(String(row.id), row);
    }
  }

  /** Sync em massa (ex.: Google) não apaga telefone/medico/lembrete/status já avançados no Supabase. */
  const mergedRows = canonicalRows.map((row) => {
    const prev = existingById.get(row.id);
    if (!prev) return row;
    return {
      ...row,
      telefone: row.telefone ?? prev.telefone ?? null,
      cliente_drive_id: row.cliente_drive_id ?? prev.cliente_drive_id ?? null,
      medico: row.medico ?? prev.medico ?? null,
      status: preferConsultaStatus(prev.status, row.status),
      lembretes_whatsapp:
        prev.lembretes_whatsapp === false ? false : row.lembretes_whatsapp,
      observacoes: row.observacoes?.trim() ? row.observacoes : prev.observacoes ?? null,
    };
  });

  for (const row of mergedRows) {
    if (!row.google_event_id) continue;
    await releaseGoogleEventIdForOtherRows(owner, row.id, row.google_event_id);
  }

  const { error } = await supabaseAdmin.from('consultas_agenda').upsert(mergedRows, {
    onConflict: 'id',
  });

  if (error) throw error;

  const touchedGoogleIds = mergedRows
    .map((r) => r.google_event_id)
    .filter((gid): gid is string => !!gid);
  if (touchedGoogleIds.length > 0) {
    await dedupeGoogleEventIdRows(owner, touchedGoogleIds);
  }

  await pruneDuplicatesForOwner(ownerEmail);

  return { upserted: mergedRows.length };
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

export async function consultaBelongsToOwner(
  consultaId: string,
  ownerEmail: string,
): Promise<boolean> {
  const owner = ownerEmail.toLowerCase().trim();
  const { data, error } = await supabaseAdmin
    .from('consultas_agenda')
    .select('id')
    .eq('id', consultaId)
    .eq('owner_email', owner)
    .maybeSingle();

  if (error) throw error;
  return !!data;
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

/** Curto o bastante para VARCHAR(10) e CHECK em whatsapp_lembrete_enviado. */
export function lembreteRemovidoTipo(tipo: LembreteTipo): `${LembreteTipo}r` {
  return `${tipo}r`;
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

export async function wasLembreteRemovido(
  consultaId: string,
  tipo: LembreteTipo,
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('whatsapp_lembrete_enviado')
    .select('id')
    .eq('consulta_id', consultaId)
    .eq('lembrete_tipo', lembreteRemovidoTipo(tipo))
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
  const owned = await consultaBelongsToOwner(params.consultaId, params.ownerEmail);
  if (!owned) return;

  const { error } = await supabaseAdmin.from('whatsapp_lembrete_enviado').insert({
    consulta_id: params.consultaId,
    owner_email: params.ownerEmail.toLowerCase().trim(),
    lembrete_tipo: params.tipo,
    fila_id: params.filaId ?? null,
  });

  if (error && error.code !== '23505') throw error;
}

export async function markLembreteRemovido(params: {
  consultaId: string;
  ownerEmail: string;
  tipo: LembreteTipo;
}): Promise<void> {
  const owned = await consultaBelongsToOwner(params.consultaId, params.ownerEmail);
  if (!owned) return;

  const { error } = await supabaseAdmin.from('whatsapp_lembrete_enviado').insert({
    consulta_id: params.consultaId,
    owner_email: params.ownerEmail.toLowerCase().trim(),
    lembrete_tipo: lembreteRemovidoTipo(params.tipo),
    fila_id: null,
  });

  if (error && error.code !== '23505') throw error;
}

const BR_TIMEZONE = 'America/Sao_Paulo';

export function brDateKey(iso: string): string {
  const trimmed = String(iso).trim();
  // YYYY-MM-DD (ex.: Google dia inteiro): data civil em SP, não UTC midnight
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return trimmed.slice(0, 10);
  return d.toLocaleDateString('en-CA', { timeZone: BR_TIMEZONE });
}

/** Chave lógica (mesmo cliente/horário = mesmo atendimento). */
export function consultaLogicalKey(row: {
  inicio: string;
  telefone: string | null;
  paciente: string;
}): string {
  const phone = row.telefone ?? '';
  const paciente = row.paciente.trim().toLowerCase();
  const time = new Date(row.inicio).toLocaleTimeString('en-GB', {
    timeZone: BR_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${phone}|${brDateKey(row.inicio)}|${time}|${paciente}`;
}

function pickBetterConsultaRow(a: ConsultaAgendaRow, b: ConsultaAgendaRow): ConsultaAgendaRow {
  if (a.google_event_id && !b.google_event_id) return a;
  if (b.google_event_id && !a.google_event_id) return b;
  if (a.id.startsWith('google-') && !b.id.startsWith('google-')) return a;
  if (b.id.startsWith('google-') && !a.id.startsWith('google-')) return b;
  if (a.telefone && !b.telefone) return a;
  if (b.telefone && !a.telefone) return b;
  if (a.observacoes?.trim() && !b.observacoes?.trim()) return a;
  if (b.observacoes?.trim() && !a.observacoes?.trim()) return b;
  return a;
}

export function dedupeConsultasRows(rows: ConsultaAgendaRow[]): ConsultaAgendaRow[] {
  const map = new Map<string, ConsultaAgendaRow>();
  for (const row of rows) {
    const key = consultaLogicalKey(row);
    const prev = map.get(key);
    map.set(key, prev ? pickBetterConsultaRow(prev, row) : row);
  }
  return [...map.values()];
}

/** Remove duplicatas no Supabase (ex.: local-* e google-* do mesmo horário). */
export async function pruneDuplicatesForOwner(ownerEmail: string): Promise<number> {
  const owner = ownerEmail.toLowerCase().trim();
  const { data, error } = await supabaseAdmin
    .from('consultas_agenda')
    .select('*')
    .eq('owner_email', owner);

  if (error) throw error;

  const all = (data ?? []) as ConsultaAgendaRow[];
  const kept = dedupeConsultasRows(all);
  const keepIds = new Set(kept.map((r) => r.id));
  const deleteIds = all.filter((r) => !keepIds.has(r.id)).map((r) => r.id);

  if (deleteIds.length === 0) return 0;

  const { error: delErr } = await supabaseAdmin
    .from('consultas_agenda')
    .delete()
    .eq('owner_email', owner)
    .in('id', deleteIds);

  if (delErr) throw delErr;
  return deleteIds.length;
}

export function brTodayKey(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: BR_TIMEZONE });
}

export function addDaysToKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** Limites do dia civil em SP para filtrar `inicio` no Supabase. */
export function brDayBoundsInicio(targetKey: string): { min: string; max: string } {
  return {
    min: `${targetKey}T00:00:00-03:00`,
    max: `${targetKey}T23:59:59.999-03:00`,
  };
}

/** Consultas com lembrete WhatsApp em um dia civil (SP). */
export async function queryConsultasAgendaForDay(
  ownerEmail: string,
  targetKey: string,
): Promise<ConsultaAgendaRow[]> {
  const owner = ownerEmail.toLowerCase().trim();
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
  return (data ?? []) as ConsultaAgendaRow[];
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

async function telefoneFromPacienteNome(
  ownerEmail: string,
  paciente: string,
): Promise<string | null> {
  const nome = paciente.trim();
  if (!nome) return null;

  const { data, error } = await supabaseAdmin
    .from('pacientes_index')
    .select('telefone_normalizado')
    .eq('owner_email', ownerEmail.toLowerCase().trim())
    .ilike('nome', nome)
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

  const fromNome = await telefoneFromPacienteNome(owner, row.paciente);
  if (fromNome?.replace(/\D/g, '').length) return fromNome;

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
    const removido = await wasLembreteRemovido(row.id, tipo);
    if (!removido) filtered.push({ ...row, telefone });
  }

  return filtered.sort((a, b) => a.inicio.localeCompare(b.inicio));
}
