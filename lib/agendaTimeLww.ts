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

function sameInstantMs(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  return !Number.isNaN(ta) && ta === tb;
}

/** LWW com detecção de conflito (<5 min entre updated_at e Google updated). */
export function reconcileGoogleVsSupabaseTime(params: {
  supabase: {
    inicio: string;
    fim: string | null;
    updated_at: string | null;
    google_updated_at?: string | null;
    sync_health?: string | null;
  };
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

  // Já vimos esta versão do evento no Google. Se a usuária resolveu o conflito,
  // um pull seguinte (push ainda pendente) não deve reabrir o modal.
  const alreadySawThisGoogleVersion = sameInstantMs(
    params.supabase.google_updated_at,
    params.google.updated,
  );
  if (alreadySawThisGoogleVersion) {
    if (params.supabase.sync_health === 'needs_review') {
      return {
        action: 'needs_review',
        googleInicio: params.google.inicio,
        googleFim: params.google.fim,
      };
    }
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

/** Data + hora — conflito no mesmo relógio em dias diferentes deixa de parecer idêntico. */
export function formatAgendaHorarioCompleto(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const datePart = d.toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
  const timePart = formatAgendaHorarioLabel(iso);
  return `${datePart} · ${timePart}`;
}
