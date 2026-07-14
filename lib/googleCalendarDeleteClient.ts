import { fetchWithTimeout } from '@/lib/fetchWithTimeout';
import { resolveGoogleCalendarEvent } from '@/lib/googleCalendarResolveClient';

function uniqueProfIds(ids: (string | undefined)[]): (string | undefined)[] {
  const seen = new Set<string>();
  const out: (string | undefined)[] = [];
  for (const id of ids) {
    const key = id ?? '__titular__';
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(id);
  }
  return out;
}

async function tryDeleteOnProf(
  eventId: string,
  profId: string | undefined,
): Promise<'deleted' | 'gone' | 'failed'> {
  const params = new URLSearchParams({ eventId });
  if (profId) params.set('profissionalId', profId);
  const res = await fetchWithTimeout(
    `/api/google-calendar?${params.toString()}`,
    { method: 'DELETE' },
  ).catch(() => null);
  if (res?.ok || res?.status === 410) return 'deleted';
  if (res?.status === 404) return 'gone';
  return 'failed';
}

/**
 * Remove um evento Google tentando a agenda certa.
 * 1) resolve em todas as agendas do salão
 * 2) DELETE com o profissionalId encontrado
 * 3) fallback nos candidatos preferidos (ex.: id da profissional antiga)
 *
 * Se o resolve não achar o evento, considera já removido (idempotente).
 */
export async function deleteGoogleCalendarEventAcrossAgendas(
  eventId: string,
  preferredProfIds: (string | undefined)[] = [],
): Promise<boolean> {
  const id = eventId.trim();
  if (!id) return true;

  const resolved = await resolveGoogleCalendarEvent(id);
  if (resolved.found) {
    const located = await tryDeleteOnProf(
      id,
      resolved.profissionalId ?? undefined,
    );
    if (located === 'deleted' || located === 'gone') return true;
  } else {
    // Não está em nenhuma agenda acessível — já saiu (ou nunca existiu).
    return true;
  }

  for (const profId of uniqueProfIds(preferredProfIds)) {
    // Já tentamos o resolved acima
    if (
      resolved.found &&
      (profId ?? null) === (resolved.profissionalId ?? null)
    ) {
      continue;
    }
    const result = await tryDeleteOnProf(id, profId);
    if (result === 'deleted' || result === 'gone') return true;
  }

  return false;
}

/** Candidatos para apagar o evento ANTIGO na transferência de profissional. */
export function buildPreviousEventDeleteCandidates(opts: {
  previousGoogleProfId?: string | null;
  previousMedicoProfId?: string | null;
  /** ID por nome sem exigir status "connected" na UI. */
  previousMedicoIdByNome?: string | null;
  connectedProfissionalIds?: string[];
  /** Agenda nova — tentar por último (eventId antigo raramente está lá). */
  excludeOrLastProfId?: string | null;
}): (string | undefined)[] {
  const preferred: (string | undefined)[] = [
    opts.previousGoogleProfId ?? undefined,
    opts.previousMedicoIdByNome ?? undefined,
    opts.previousMedicoProfId ?? undefined,
    ...(opts.connectedProfissionalIds ?? []),
    undefined,
  ];

  const last = opts.excludeOrLastProfId?.trim() || undefined;
  if (!last) return uniqueProfIds(preferred);

  const without = preferred.filter((id) => id !== last);
  return uniqueProfIds([...without, last]);
}
