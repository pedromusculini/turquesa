import { fetchAgendaViewFromServer, hydrateServerEventsFromLocal } from '@/lib/syncConsultasClient';
import {
  consultationsListsEqual,
  saveConsultations,
} from '@/lib/consultations';
import type { ConsultationRecord } from '@/lib/consultations';

const REVISION_POLL_MS = 25_000;

export type ConsultasRevisionApply = (events: ConsultationRecord[]) => void;

/** Polling de revisão do Supabase — refetch agenda-view (sem merge localStorage). */
export function startConsultasRevisionPolling(options: {
  ownerEmail: string;
  onApply: ConsultasRevisionApply;
  intervalMs?: number;
}): () => void {
  if (typeof window === 'undefined') return () => undefined;

  let revision = '';
  let stopped = false;
  const intervalMs = options.intervalMs ?? REVISION_POLL_MS;

  const tick = async () => {
    if (stopped || document.visibilityState !== 'visible') return;
    try {
      const res = await fetch('/api/consultas/revision', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { revision?: string };
      const next = data.revision ?? '';
      if (!revision) {
        revision = next;
        return;
      }
      if (next === revision) return;
      revision = next;

      const serverEvents = await fetchAgendaViewFromServer();
      const { loadConsultations } = await import('@/lib/consultations');
      const local = loadConsultations(options.ownerEmail);
      const hydrated = hydrateServerEventsFromLocal(local, serverEvents);
      saveConsultations(hydrated, { broadcast: false, ownerEmail: options.ownerEmail });
      options.onApply(hydrated);
    } catch {
      /* best-effort */
    }
  };

  void tick();
  const id = window.setInterval(() => void tick(), intervalMs);

  return () => {
    stopped = true;
    window.clearInterval(id);
  };
}
