import { randomUUID } from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { preferConsultaStatus, type ConsultaStatus } from '@/lib/consultations';
import { getLembretesSettings } from '@/lib/lembretesSettings';
import { normalizeBrazilPhone } from '@/lib/whatsapp';
import {
  loadExcludedGoogleEventIds,
  recordConsultasExcluidas,
} from '@/lib/consultasAgendaExcluidos';
import { chunkForSupabaseIn } from '@/lib/supabaseQueryBatches';

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
  /** clinica_medicos.id da agenda Google; null = titular */
  google_profissional_id?: string | null;
  medico: string | null;
  convenio: string | null;
  status: ConsultaStatus;
  lembretes_whatsapp: boolean;
  cliente_drive_id?: string | null;
  observacoes?: string | null;
  updated_at?: string | null;
  google_updated_at?: string | null;
  sync_health?: string | null;
  conflict_google_inicio?: string | null;
  conflict_google_fim?: string | null;
  deleted_at?: string | null;
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
  google_profissional_id?: string | null;
  medico?: string | null;
  convenio?: string | null;
  status?: ConsultaStatus;
  lembretes_whatsapp?: boolean;
  cliente_drive_id?: string | null;
  observacoes?: string | null;
};

const MS_DAY = 24 * 60 * 60 * 1000;

/** Id temporário do cliente (localStorage / import Google) — não deve permanecer no Supabase. */
export function isLegacyConsultaId(id: string): boolean {
  const s = String(id);
  return s.startsWith('local-') || s.startsWith('google-');
}

/** UUID estável > local-* > google-*. */
export function consultaIdRank(id: string): number {
  if (!isLegacyConsultaId(id)) return 3;
  if (String(id).startsWith('local-')) return 2;
  return 1;
}

export function preferCanonicalConsultaId(a: string, b: string): string {
  return consultaIdRank(a) >= consultaIdRank(b) ? a : b;
}

async function loadIdByGoogleEventIdForOwner(
  owner: string,
  googleEventIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const ids = [...new Set(googleEventIds.filter(Boolean))];
  if (ids.length === 0) return map;

  for (const batch of chunkForSupabaseIn(ids)) {
    let query = supabaseAdmin
      .from('consultas_agenda')
      .select('id, google_event_id')
      .eq('owner_email', owner)
      .in('google_event_id', batch);

    const { data, error } = await query.is('deleted_at', null);
    let rows = data;
    if (error) {
      if (error.message?.includes('deleted_at')) {
        const fallback = await supabaseAdmin
          .from('consultas_agenda')
          .select('id, google_event_id')
          .eq('owner_email', owner)
          .in('google_event_id', batch);
        if (fallback.error) throw fallback.error;
        rows = fallback.data;
      } else {
        throw error;
      }
    }
    for (const row of rows ?? []) {
      if (!row.google_event_id) continue;
      const gid = String(row.google_event_id);
      const existing = map.get(gid);
      map.set(
        gid,
        existing ? preferCanonicalConsultaId(existing, String(row.id)) : String(row.id),
      );
    }
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

/** Remove outras linhas com os mesmos google_event_id (evita fantasma sem apagar). */
async function deleteOtherRowsWithGoogleEventIds(
  owner: string,
  keepByGid: Map<string, string>,
): Promise<void> {
  const gids = [...keepByGid.keys()];
  if (gids.length === 0) return;

  const deleteIds: string[] = [];

  for (const batch of chunkForSupabaseIn(gids)) {
    const { data: rows, error } = await supabaseAdmin
      .from('consultas_agenda')
      .select('id, google_event_id')
      .eq('owner_email', owner)
      .in('google_event_id', batch);

    if (error) throw error;

    for (const row of rows ?? []) {
      if (!row.google_event_id) continue;
      const gid = String(row.google_event_id);
      const keepId = keepByGid.get(gid);
      if (keepId && String(row.id) !== keepId) {
        deleteIds.push(String(row.id));
      }
    }
  }

  if (deleteIds.length === 0) return;

  for (const batch of chunkForSupabaseIn([...new Set(deleteIds)])) {
    const { error } = await supabaseAdmin
      .from('consultas_agenda')
      .delete()
      .eq('owner_email', owner)
      .in('id', batch);
    if (error) throw error;
  }
}

export type ConsultaUpsertSavedRow = {
  requestedId: string;
  id: string;
  google_event_id: string | null;
  google_profissional_id: string | null;
};

export async function upsertConsultasAgenda(
  ownerEmail: string,
  consultas: ConsultaSyncInput[],
  options?: { runRepair?: boolean },
): Promise<{ upserted: number; saved: ConsultaUpsertSavedRow[] }> {
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
      google_event_id:
        c.google_event_id !== undefined
          ? c.google_event_id
            ? String(c.google_event_id).trim()
            : null
          : undefined,
      google_profissional_id:
        c.google_profissional_id !== undefined
          ? c.google_profissional_id
            ? String(c.google_profissional_id).trim()
            : null
          : undefined,
      medico: c.medico ?? null,
      convenio: c.convenio ?? null,
      status: c.status ?? 'confirmado',
      lembretes_whatsapp: c.lembretes_whatsapp !== false,
      cliente_drive_id: c.cliente_drive_id ?? null,
      observacoes: c.observacoes?.trim() ? c.observacoes.trim() : null,
      updated_at: now,
    }));

  if (rows.length === 0) return { upserted: 0, saved: [] };

  const excludedGoogle = await loadExcludedGoogleEventIds(owner);
  const activeRows = rows.filter(
    (r) => !r.google_event_id || !excludedGoogle.has(String(r.google_event_id)),
  );
  if (activeRows.length === 0) return { upserted: 0, saved: [] };

  type ActiveRow = (typeof activeRows)[number] & { _requestedId: string };
  const activeWithRequested: ActiveRow[] = activeRows.map((row) => ({
    ...row,
    _requestedId: row.id,
  }));

  const { data: ownerIndexRows, error: indexErr } = await supabaseAdmin
    .from('consultas_agenda')
    .select('id, google_event_id, inicio, medico')
    .eq('owner_email', owner);
  if (indexErr) throw indexErr;
  const ownerIndex = (ownerIndexRows ?? []) as ConsultaIdIndexRow[];

  const rowsWithStableIds = activeWithRequested.map((row) => ({
    ...row,
    id: resolveStableConsultaId(
      { ...row, google_event_id: row.google_event_id ?? null },
      ownerIndex,
    ),
  }));

  const googleEventIds = rowsWithStableIds
    .map((r) => r.google_event_id)
    .filter((gid): gid is string => !!gid);
  const idByGoogleEvent = await loadIdByGoogleEventIdForOwner(owner, googleEventIds);

  const canonicalRows = rowsWithStableIds.map((row) => {
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
      | 'telefone'
      | 'cliente_drive_id'
      | 'medico'
      | 'lembretes_whatsapp'
      | 'status'
      | 'observacoes'
      | 'paciente'
      | 'deleted_at'
      | 'inicio'
      | 'fim'
      | 'updated_at'
      | 'google_event_id'
      | 'google_profissional_id'
    >
  >();

  if (ids.length > 0) {
    for (const batch of chunkForSupabaseIn(ids)) {
      const { data: existing, error: fetchErr } = await supabaseAdmin
        .from('consultas_agenda')
        .select(
          'id, telefone, cliente_drive_id, medico, lembretes_whatsapp, status, observacoes, paciente, deleted_at, inicio, fim, updated_at, google_event_id, google_profissional_id',
        )
        .eq('owner_email', owner)
        .in('id', batch);
      if (fetchErr) throw fetchErr;
      for (const row of existing ?? []) {
        existingById.set(String(row.id), row);
      }
    }
  }

  type PrevRow = NonNullable<ReturnType<typeof existingById.get>>;

  function resolveGoogleEventId(
    row: { google_event_id?: string | null },
    prev?: PrevRow,
  ): string | null {
    if (row.google_event_id !== undefined) {
      const trimmed = row.google_event_id?.trim();
      return trimmed || null;
    }
    return prev?.google_event_id?.trim() ?? null;
  }

  function resolveGoogleProfissionalId(
    row: { google_profissional_id?: string | null },
    prev?: PrevRow,
  ): string | null {
    if (row.google_profissional_id !== undefined) {
      const trimmed = row.google_profissional_id?.trim();
      return trimmed || null;
    }
    return prev?.google_profissional_id?.trim() ?? null;
  }

  /** Sync em massa (ex.: Google) não apaga telefone/medico/lembrete/status já avançados no Supabase. */
  const mergedRows = canonicalRows
    .filter((row) => !existingById.get(row.id)?.deleted_at)
    .map((row) => {
    const prev = existingById.get(row.id);
    const google_event_id = resolveGoogleEventId(row, prev);
    const google_profissional_id = resolveGoogleProfissionalId(row, prev);
    if (!prev) {
      return { ...row, google_event_id, google_profissional_id };
    }
    const pacienteGenerico = (p: string) => {
      const n = p.trim().toLowerCase();
      return !n || n === 'cliente' || n === 'novo cliente';
    };
    const paciente =
      pacienteGenerico(row.paciente) && !pacienteGenerico(String(prev.paciente ?? ''))
        ? String(prev.paciente).trim()
        : row.paciente;
    return {
      ...row,
      paciente,
      telefone: row.telefone ?? prev.telefone ?? null,
      cliente_drive_id: row.cliente_drive_id ?? prev.cliente_drive_id ?? null,
      medico: row.medico ?? prev.medico ?? null,
      status: preferConsultaStatus(prev.status, row.status),
      lembretes_whatsapp:
        prev.lembretes_whatsapp === false ? false : row.lembretes_whatsapp,
      observacoes: row.observacoes?.trim() ? row.observacoes : prev.observacoes ?? null,
      google_event_id,
      google_profissional_id,
    };
  });

  if (mergedRows.length === 0) return { upserted: 0, saved: [] };

  const uniqueMergedRows = dedupeUpsertRowsById(
    mergedRows as (ActiveRow & ConsultaAgendaRow)[],
  );

  const keepByGid = new Map<string, string>();
  for (const row of uniqueMergedRows) {
    if (!row.google_event_id) continue;
    const gid = String(row.google_event_id);
    const existing = keepByGid.get(gid);
    keepByGid.set(
      gid,
      existing ? preferCanonicalConsultaId(existing, row.id) : row.id,
    );
  }
  await deleteOtherRowsWithGoogleEventIds(owner, keepByGid);

  const canonicalById = new Map(
    uniqueMergedRows.map((row) => [String(row.id), row]),
  );
  const saved: ConsultaUpsertSavedRow[] = [];
  const seenRequested = new Set<string>();
  for (const row of mergedRows) {
    const requestedId = String((row as ActiveRow)._requestedId ?? row.id);
    if (seenRequested.has(requestedId)) continue;
    seenRequested.add(requestedId);
    const canonical = canonicalById.get(String(row.id)) ?? row;
    saved.push({
      requestedId,
      id: String(canonical.id),
      google_event_id: canonical.google_event_id ?? null,
      google_profissional_id: canonical.google_profissional_id ?? null,
    });
  }

  const rowsForDb = uniqueMergedRows.map((row) => {
    const { _requestedId: _r, ...dbRow } = row as ActiveRow;
    return dbRow;
  });

  let upsertedCount = 0;
  for (const batch of chunkForSupabaseIn(rowsForDb)) {
    const { error } = await supabaseAdmin.from('consultas_agenda').upsert(batch, {
      onConflict: 'id',
    });
    if (error) throw error;
    upsertedCount += batch.length;
  }

  const touchedGoogleIds = uniqueMergedRows
    .map((r) => r.google_event_id)
    .filter((gid): gid is string => !!gid);
  if (touchedGoogleIds.length > 0) {
    await dedupeGoogleEventIdRows(owner, touchedGoogleIds);
  }

  if (options?.runRepair) {
    await pruneDuplicatesForOwner(ownerEmail);
  }

  return { upserted: upsertedCount, saved };
}

export async function deleteConsultasAgenda(
  ownerEmail: string,
  options: {
    ids?: string[];
    googleEventIds?: string[];
    /** Bloqueia reimport do Google — apenas exclusão canônica explícita. */
    tombstoneGoogleEventIds?: string[];
  },
): Promise<{ deleted: number }> {
  const owner = ownerEmail.toLowerCase().trim();
  let deleted = 0;
  const now = new Date().toISOString();

  const ids = [...new Set((options.ids ?? []).map(String).filter(Boolean))];
  const googleEventIds = [...new Set((options.googleEventIds ?? []).map(String).filter(Boolean))];
  const tombstoneGids = [
    ...new Set((options.tombstoneGoogleEventIds ?? []).map(String).filter(Boolean)),
  ];

  const tombstoneItems: { consultaId?: string; googleEventId?: string }[] = [];
  for (const id of ids) tombstoneItems.push({ consultaId: id });
  for (const gid of tombstoneGids) tombstoneItems.push({ googleEventId: gid });

  await recordConsultasExcluidas(owner, tombstoneItems);

  if (ids.length > 0) {
    const soft = await supabaseAdmin
      .from('consultas_agenda')
      .update({ deleted_at: now, updated_at: now })
      .eq('owner_email', owner)
      .in('id', ids)
      .select('id');

    if (soft.error?.message?.includes('deleted_at')) {
      const { error, count } = await supabaseAdmin
        .from('consultas_agenda')
        .delete({ count: 'exact' })
        .eq('owner_email', owner)
        .in('id', ids);
      if (error) throw error;
      deleted += count ?? 0;
    } else if (soft.error) {
      throw soft.error;
    } else {
      deleted += soft.data?.length ?? 0;
    }
  }

  if (googleEventIds.length > 0) {
    const soft = await supabaseAdmin
      .from('consultas_agenda')
      .update({ deleted_at: now, updated_at: now })
      .eq('owner_email', owner)
      .in('google_event_id', googleEventIds)
      .select('id');

    if (soft.error?.message?.includes('deleted_at')) {
      const { error, count } = await supabaseAdmin
        .from('consultas_agenda')
        .delete({ count: 'exact' })
        .eq('owner_email', owner)
        .in('google_event_id', googleEventIds);
      if (error) throw error;
      deleted += count ?? 0;
    } else if (soft.error) {
      throw soft.error;
    } else {
      deleted += soft.data?.length ?? 0;
    }
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

function clearTimeConflictFields(): Record<string, null> {
  return {
    sync_health: null,
    conflict_google_inicio: null,
    conflict_google_fim: null,
  };
}

/** PATCH horário no Supabase (Fase 5 — fonte antes do push Google). */
export async function patchConsultaAgendaTime(
  ownerEmail: string,
  consultaId: string,
  inicio: string,
  fim: string | null,
): Promise<ConsultaAgendaRow | null> {
  const owner = ownerEmail.toLowerCase().trim();
  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from('consultas_agenda')
    .update({
      inicio,
      fim,
      updated_at: now,
      ...clearTimeConflictFields(),
    })
    .eq('owner_email', owner)
    .eq('id', consultaId)
    .is('deleted_at', null)
    .select('*')
    .maybeSingle();

  if (error) throw error;
  return (data as ConsultaAgendaRow | null) ?? null;
}

/** Marca conflito de horário para revisão manual. */
export async function markConsultaTimeNeedsReview(
  ownerEmail: string,
  consultaId: string,
  googleInicio: string,
  googleFim: string | null,
  googleUpdatedAt?: string,
): Promise<void> {
  const owner = ownerEmail.toLowerCase().trim();
  const patch: Record<string, string | null> = {
    sync_health: 'needs_review',
    conflict_google_inicio: googleInicio,
    conflict_google_fim: googleFim,
  };
  if (googleUpdatedAt) patch.google_updated_at = googleUpdatedAt;

  const { error } = await supabaseAdmin
    .from('consultas_agenda')
    .update(patch)
    .eq('owner_email', owner)
    .eq('id', consultaId);

  if (error) {
    if (
      error.message?.includes('sync_health') ||
      error.message?.includes('conflict_google') ||
      error.code === 'PGRST204'
    ) {
      return;
    }
    throw error;
  }
}

/** Resolve conflito: usuário escolhe Google ou Turquesa. */
export async function resolveConsultaTimeConflict(
  ownerEmail: string,
  consultaId: string,
  keep: 'google' | 'turquesa',
  times: {
    googleInicio: string;
    googleFim: string | null;
    turquesaInicio: string;
    turquesaFim: string | null;
  },
): Promise<ConsultaAgendaRow | null> {
  const owner = ownerEmail.toLowerCase().trim();
  const now = new Date().toISOString();
  const inicio = keep === 'google' ? times.googleInicio : times.turquesaInicio;
  const fim = keep === 'google' ? times.googleFim : times.turquesaFim;

  const { data, error } = await supabaseAdmin
    .from('consultas_agenda')
    .update({
      inicio,
      fim,
      updated_at: now,
      ...clearTimeConflictFields(),
    })
    .eq('owner_email', owner)
    .eq('id', consultaId)
    .is('deleted_at', null)
    .select('*')
    .maybeSingle();

  if (error) throw error;
  return (data as ConsultaAgendaRow | null) ?? null;
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
    .is('deleted_at', null)
    .gte('inicio', minDate)
    .lte('inicio', maxDate)
    .order('inicio', { ascending: true });

  if (error?.message?.includes('deleted_at')) {
    const fallback = await supabaseAdmin
      .from('consultas_agenda')
      .select('*')
      .eq('owner_email', owner)
      .gte('inicio', minDate)
      .lte('inicio', maxDate)
      .order('inicio', { ascending: true });
    if (fallback.error) throw fallback.error;
    return (fallback.data ?? []) as ConsultaAgendaRow[];
  }

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

/** Mesmo slot na agenda (data + hora em SP) — chave auxiliar. */
export function consultaSlotKey(row: {
  inicio: string;
  medico: string | null;
}): string {
  const time = new Date(row.inicio).toLocaleTimeString('en-GB', {
    timeZone: BR_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${brDateKey(row.inicio)}|${time}|${(row.medico ?? '').trim().toLowerCase()}`;
}

/** Mesmo horário (±1 min) e profissional compatível — alinhado a sameAppointmentSlot no cliente. */
export function consultaRowsSameSlot(
  a: { inicio: string; medico: string | null },
  b: { inicio: string; medico: string | null },
): boolean {
  const ta = new Date(a.inicio).getTime();
  const tb = new Date(b.inicio).getTime();
  if (Number.isNaN(ta) || Number.isNaN(tb)) return false;
  if (Math.abs(ta - tb) > 60_000) return false;
  const medicoA = (a.medico ?? '').trim().toLowerCase();
  const medicoB = (b.medico ?? '').trim().toLowerCase();
  if (medicoA && medicoB && medicoA !== medicoB) return false;
  return true;
}

export function pickBetterConsultaRow(a: ConsultaAgendaRow, b: ConsultaAgendaRow): ConsultaAgendaRow {
  const rankA = consultaIdRank(a.id);
  const rankB = consultaIdRank(b.id);
  if (rankA !== rankB) return rankA > rankB ? a : b;
  if (a.google_event_id && !b.google_event_id) return a;
  if (b.google_event_id && !a.google_event_id) return b;
  if (a.telefone && !b.telefone) return a;
  if (b.telefone && !a.telefone) return b;
  if (a.cliente_drive_id && !b.cliente_drive_id) return a;
  if (b.cliente_drive_id && !a.cliente_drive_id) return b;
  if (a.observacoes?.trim() && !b.observacoes?.trim()) return a;
  if (b.observacoes?.trim() && !a.observacoes?.trim()) return b;
  return a;
}

/** Evita "ON CONFLICT DO UPDATE cannot affect row a second time" no upsert em lote. */
function dedupeUpsertRowsById<T extends ConsultaAgendaRow>(rows: T[]): T[] {
  const byId = new Map<string, T>();
  for (const row of rows) {
    const id = String(row.id);
    const existing = byId.get(id);
    if (!existing) {
      byId.set(id, row);
      continue;
    }
    byId.set(id, pickBetterConsultaRow(existing, row) as T);
  }
  return [...byId.values()];
}

/** Dedupe servidor: apenas mesmo `google_event_id` — nunca fundir só por horário. */
export function dedupeConsultasRows(rows: ConsultaAgendaRow[]): ConsultaAgendaRow[] {
  if (rows.length <= 1) return rows;

  const consumed = new Set<number>();
  const result: ConsultaAgendaRow[] = [];

  const byGoogle = new Map<string, number[]>();
  for (let i = 0; i < rows.length; i++) {
    const gid = rows[i].google_event_id;
    if (!gid) continue;
    const key = String(gid);
    if (!byGoogle.has(key)) byGoogle.set(key, []);
    byGoogle.get(key)!.push(i);
  }

  for (const group of byGoogle.values()) {
    let merged = rows[group[0]];
    for (const idx of group.slice(1)) {
      merged = pickBetterConsultaRow(merged, rows[idx]);
      consumed.add(idx);
    }
    consumed.add(group[0]);
    result.push(merged);
  }

  for (let i = 0; i < rows.length; i++) {
    if (!consumed.has(i)) result.push(rows[i]);
  }

  return result;
}

type ConsultaIdIndexRow = Pick<
  ConsultaAgendaRow,
  'id' | 'google_event_id' | 'inicio' | 'medico'
>;

/** Resolve id legado para UUID já existente ou novo. */
export function resolveStableConsultaId(
  row: ConsultaIdIndexRow,
  ownerRows: ConsultaIdIndexRow[],
): string {
  if (!isLegacyConsultaId(row.id)) return row.id;

  if (row.google_event_id) {
    const byGid = ownerRows.find(
      (r) => r.google_event_id === row.google_event_id && !isLegacyConsultaId(r.id),
    );
    if (byGid) return byGid.id;
  }

  const bySlot = ownerRows.find(
    (r) => consultaRowsSameSlot(r, row) && !isLegacyConsultaId(r.id),
  );
  if (bySlot) return bySlot.id;

  return randomUUID();
}

/** Deduplica, remove sobras e promove ids legados a UUID. */
export async function repairConsultasAgendaForOwner(ownerEmail: string): Promise<{
  deleted: number;
  migrated: number;
}> {
  const owner = ownerEmail.toLowerCase().trim();
  const { data, error } = await supabaseAdmin
    .from('consultas_agenda')
    .select('*')
    .eq('owner_email', owner);

  if (error) throw error;

  const all = (data ?? []) as ConsultaAgendaRow[];
  const kept = dedupeConsultasRows(all);
  const keepIdSet = new Set(kept.map((r) => r.id));
  const deleteIds = new Set(all.filter((r) => !keepIdSet.has(r.id)).map((r) => r.id));
  let migrated = 0;
  const now = new Date().toISOString();

  for (const row of kept) {
    if (!isLegacyConsultaId(row.id)) continue;
    const newId = randomUUID();
    const { error: upErr } = await supabaseAdmin.from('consultas_agenda').upsert({
      ...row,
      id: newId,
      owner_email: owner,
      updated_at: now,
    });
    if (upErr) throw upErr;
    deleteIds.add(row.id);
    migrated += 1;
  }

  if (deleteIds.size === 0) return { deleted: 0, migrated };

  let deleted = 0;
  for (const batch of chunkForSupabaseIn([...deleteIds])) {
    const { error: delErr } = await supabaseAdmin
      .from('consultas_agenda')
      .delete()
      .eq('owner_email', owner)
      .in('id', batch);
    if (delErr) throw delErr;
    deleted += batch.length;
  }
  return { deleted, migrated };
}

/** Remove duplicatas no Supabase (ex.: local-* e google-* do mesmo horário). */
export async function pruneDuplicatesForOwner(ownerEmail: string): Promise<number> {
  const { deleted, migrated } = await repairConsultasAgendaForOwner(ownerEmail);
  return deleted;
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
