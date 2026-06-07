import type { ConsultationRecord } from '@/lib/consultations';
import { parseEventDate } from '@/lib/consultations';

export function consultationToSyncPayload(ev: ConsultationRecord) {
  const start = parseEventDate(ev.start);
  const end = parseEventDate(ev.end);
  if (!start || !ev.id) return null;
  return {
    id: String(ev.id),
    patient: ev.patient ?? '',
    service: ev.service,
    telefone: ev.telefone ?? null,
    start: start.toISOString(),
    end: end?.toISOString() ?? null,
    location: ev.location,
    googleEventId: ev.googleEventId,
    medico: ev.medico,
    convenio: ev.convenio,
    status: ev.status ?? 'agendado',
    lembretesWhatsapp: ev.lembretesWhatsapp !== false,
    clienteDriveId: ev.clienteDriveId ?? null,
  };
}

let syncTimer: ReturnType<typeof setTimeout> | null = null;

/** Envia consultas futuras ao servidor (debounce) para lembretes D-7/D-1. */
export function scheduleSyncConsultasToServer(events: ConsultationRecord[]): void {
  if (typeof window === 'undefined') return;
  if (syncTimer) clearTimeout(syncTimer);

  syncTimer = setTimeout(() => {
    const now = Date.now();
    const consultas = events
      .map(consultationToSyncPayload)
      .filter((c): c is NonNullable<typeof c> => {
        if (!c) return false;
        const t = new Date(c.start).getTime();
        return t > now - 24 * 60 * 60 * 1000;
      });

    if (consultas.length === 0) return;

    fetch('/api/consultas/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ consultas }),
    }).catch(() => {
      /* sync best-effort */
    });
  }, 800);
}
