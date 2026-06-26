/** Janela em que edições simultâneas Turquesa + Google geram conflito (ms). */
export const AGENDA_TIME_CONFLICT_WINDOW_MS = 5 * 60 * 1000;

export function agendaTimesEqual(
  a: { inicio: string; fim?: string | null },
  b: { inicio: string; fim?: string | null },
): boolean {
  const ta = new Date(a.inicio).getTime();
  const tb = new Date(b.inicio).getTime();
  if (Number.isNaN(ta) || Number.isNaN(tb) || Math.abs(ta - tb) > 60_000) return false;

  const fa = a.fim ? new Date(a.fim).getTime() : null;
  const fb = b.fim ? new Date(b.fim).getTime() : null;
  if (fa == null && fb == null) return true;
  if (fa == null || fb == null) return false;
  return Math.abs(fa - fb) <= 60_000;
}

export type TimeReconcileResult =
  | { action: 'unchanged' }
  | {
      action: 'apply_google';
      inicio: string;
      fim: string | null;
      google_updated_at: string;
    }
  | { action: 'keep_supabase' }
  | {
      action: 'needs_review';
      googleInicio: string;
      googleFim: string | null;
    };

/** LWW com detecção de conflito (<5 min entre updated_at e Google updated). */
export function reconcileGoogleVsSupabaseTime(params: {
  supabase: { inicio: string; fim: string | null; updated_at: string | null };
  google: { inicio: string; fim: string | null; updated: string };
}): TimeReconcileResult {
  const googleTimes = { inicio: params.google.inicio, fim: params.google.fim };
  const supabaseTimes = { inicio: params.supabase.inicio, fim: params.supabase.fim };

  if (agendaTimesEqual(googleTimes, supabaseTimes)) {
    return { action: 'unchanged' };
  }

  const googleUpdatedMs = new Date(params.google.updated).getTime();
  const supabaseUpdatedMs = params.supabase.updated_at
    ? new Date(params.supabase.updated_at).getTime()
    : 0;

  if (Number.isNaN(googleUpdatedMs)) {
    return { action: 'keep_supabase' };
  }

  const bothTouched =
    supabaseUpdatedMs > 0 &&
    googleUpdatedMs > 0 &&
    Math.abs(googleUpdatedMs - supabaseUpdatedMs) < AGENDA_TIME_CONFLICT_WINDOW_MS;

  if (bothTouched) {
    return {
      action: 'needs_review',
      googleInicio: params.google.inicio,
      googleFim: params.google.fim,
    };
  }

  if (googleUpdatedMs > supabaseUpdatedMs) {
    return {
      action: 'apply_google',
      inicio: params.google.inicio,
      fim: params.google.fim,
      google_updated_at: params.google.updated,
    };
  }

  return { action: 'keep_supabase' };
}

export function formatAgendaHorarioLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Sao_Paulo',
  });
}
