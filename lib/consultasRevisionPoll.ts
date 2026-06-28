import { fetchAgendaViewFromServer } from '@/lib/syncConsultasClient';
import type { ConsultationRecord } from '@/lib/consultations';

const REVISION_POLL_MS = 25_000;
/** Re-tenta pull adiado (sync local em andamento). */
const DEFERRED_REVISION_RETRY_MS = 5_000;

export type ConsultasRevisionApplyResult = {
  /** true = revisão pode ser marcada como aplicada (dados lidos do servidor). */
  applied: boolean;
  /** true = sync local em andamento; revisão permanece pendente. */
  deferred?: boolean;
};

export type ConsultasRevisionApplyPayload = {
  serverEvents: ConsultationRecord[];
  serverRevision: string;
};

export type ConsultasRevisionApply = (
  payload: ConsultasRevisionApplyPayload,
) => ConsultasRevisionApplyResult;

/** Polling de revisão do Supabase — refetch agenda-view quando revisão muda. */
export function startConsultasRevisionPolling(options: {
  ownerEmail: string;
  onApply: ConsultasRevisionApply;
  onError?: (error: unknown) => void;
  intervalMs?: number;
}): () => void {
  if (typeof window === 'undefined') return () => undefined;

  let appliedRevision = '';
  let pendingRevision: string | null = null;
  let stopped = false;
  let inFlight = false;
  let deferredRetryTimer: ReturnType<typeof setTimeout> | null = null;
  const intervalMs = options.intervalMs ?? REVISION_POLL_MS;

  const scheduleDeferredRetry = () => {
    if (deferredRetryTimer || stopped) return;
    deferredRetryTimer = setTimeout(() => {
      deferredRetryTimer = null;
      void runPull();
    }, DEFERRED_REVISION_RETRY_MS);
  };

  const runPull = async (targetRevision?: string) => {
    if (stopped || inFlight || document.visibilityState !== 'visible') return;

    const revisionToApply = targetRevision ?? pendingRevision;
    if (!revisionToApply) return;

    inFlight = true;
    try {
      const serverEvents = await fetchAgendaViewFromServer();
      const result = options.onApply({
        serverEvents,
        serverRevision: revisionToApply,
      });

      if (result.deferred) {
        pendingRevision = revisionToApply;
        scheduleDeferredRetry();
        return;
      }

      if (result.applied) {
        appliedRevision = revisionToApply;
        pendingRevision = null;
      }
    } catch (err) {
      pendingRevision = revisionToApply;
      options.onError?.(err);
      scheduleDeferredRetry();
    } finally {
      inFlight = false;
    }
  };

  const tick = async () => {
    if (stopped || inFlight || document.visibilityState !== 'visible') return;

    if (pendingRevision && pendingRevision !== appliedRevision) {
      await runPull(pendingRevision);
      return;
    }

    try {
      const res = await fetch('/api/consultas/revision', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { revision?: string };
      const next = data.revision ?? '';

      if (!appliedRevision) {
        appliedRevision = next;
        return;
      }

      if (next === appliedRevision) return;

      pendingRevision = next;
      await runPull(next);
    } catch (err) {
      options.onError?.(err);
    }
  };

  void tick();
  const id = window.setInterval(() => void tick(), intervalMs);

  return () => {
    stopped = true;
    window.clearInterval(id);
    if (deferredRetryTimer) clearTimeout(deferredRetryTimer);
  };
}
