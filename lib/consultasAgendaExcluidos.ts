import { supabaseAdmin } from '@/lib/supabaseClient';
import { isConsultasAgendaTableMissing } from '@/lib/consultasAgenda';

function isExcluidosTableMissing(error: { code?: string; message?: string }): boolean {
  return (
    error.code === 'PGRST205' ||
    (error.message?.includes('consultas_agenda_excluidos') ?? false)
  );
}

/** Registra exclusão para bloquear reimport do Google Calendar. */
export async function recordConsultasExcluidas(
  ownerEmail: string,
  items: { consultaId?: string; googleEventId?: string }[],
): Promise<void> {
  const owner = ownerEmail.toLowerCase().trim();
  const now = new Date().toISOString();
  const rows = items
    .filter((i) => i.consultaId || i.googleEventId)
    .map((i) => ({
      owner_email: owner,
      consulta_id: i.consultaId ? String(i.consultaId) : null,
      google_event_id: i.googleEventId ? String(i.googleEventId) : null,
      deleted_at: now,
    }));

  if (rows.length === 0) return;

  try {
    for (const row of rows) {
      if (row.google_event_id) {
        const { data } = await supabaseAdmin
          .from('consultas_agenda_excluidos')
          .select('id')
          .eq('owner_email', owner)
          .eq('google_event_id', row.google_event_id)
          .maybeSingle();
        if (data) continue;
      }
      await supabaseAdmin.from('consultas_agenda_excluidos').insert(row);
    }
  } catch (err) {
    const e = err as { code?: string; message?: string };
    if (isExcluidosTableMissing(e)) return;
    throw err;
  }
}

/** google_event_id bloqueados para este owner (exclusão explícita no app). */
export async function loadExcludedGoogleEventIds(ownerEmail: string): Promise<Set<string>> {
  const owner = ownerEmail.toLowerCase().trim();
  try {
    const { data, error } = await supabaseAdmin
      .from('consultas_agenda_excluidos')
      .select('google_event_id')
      .eq('owner_email', owner)
      .not('google_event_id', 'is', null);

    if (error) {
      if (isExcluidosTableMissing(error)) return new Set();
      throw error;
    }
    return new Set(
      (data ?? [])
        .map((r) => r.google_event_id)
        .filter((gid): gid is string => !!gid)
        .map(String),
    );
  } catch (err) {
    const e = err as { code?: string; message?: string };
    if (isExcluidosTableMissing(e)) return new Set();
    throw err;
  }
}

/** Remove tombstone de google_event_id (permite reimport do Google). */
export async function unblockGoogleEventForOwner(
  ownerEmail: string,
  googleEventId: string,
): Promise<boolean> {
  const owner = ownerEmail.toLowerCase().trim();
  const gid = String(googleEventId).trim();
  if (!gid) return false;

  try {
    const { error } = await supabaseAdmin
      .from('consultas_agenda_excluidos')
      .delete()
      .eq('owner_email', owner)
      .eq('google_event_id', gid);

    if (error) {
      if (isExcluidosTableMissing(error)) return false;
      throw error;
    }
    return true;
  } catch (err) {
    const e = err as { code?: string; message?: string };
    if (isExcluidosTableMissing(e)) return false;
    throw err;
  }
}

export function isGoogleEventExcluded(
  googleEventId: string | null | undefined,
  excluded: Set<string>,
): boolean {
  if (!googleEventId) return false;
  return excluded.has(String(googleEventId));
}

/** Cursor leve para polling cross-device (sem Realtime/Supabase Auth). */
export async function getConsultasAgendaRevision(
  ownerEmail: string,
): Promise<{ revision: string; updatedAtMax: string | null; count: number }> {
  const owner = ownerEmail.toLowerCase().trim();
  try {
    let query = supabaseAdmin
      .from('consultas_agenda')
      .select('updated_at', { count: 'exact', head: false })
      .eq('owner_email', owner)
      .order('updated_at', { ascending: false })
      .limit(1);

    const { data, error, count } = await query.is('deleted_at', null);

    if (error) {
      if (isConsultasAgendaTableMissing(error)) {
        return { revision: '0|0', updatedAtMax: null, count: 0 };
      }
      if (error.message?.includes('deleted_at')) {
        const fallback = await supabaseAdmin
          .from('consultas_agenda')
          .select('updated_at', { count: 'exact', head: false })
          .eq('owner_email', owner)
          .order('updated_at', { ascending: false })
          .limit(1);
        if (fallback.error) throw fallback.error;
        const max = fallback.data?.[0]?.updated_at ?? null;
        const c = fallback.count ?? 0;
        return { revision: `${max ?? '0'}|${c}`, updatedAtMax: max, count: c };
      }
      throw error;
    }

    const max = data?.[0]?.updated_at ?? null;
    const c = count ?? 0;
    return { revision: `${max ?? '0'}|${c}`, updatedAtMax: max, count: c };
  } catch {
    return { revision: '0|0', updatedAtMax: null, count: 0 };
  }
}
