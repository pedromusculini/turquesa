import type { ConsultationRecord, ConsultaStatus } from '@/lib/consultations';
import { parseEventDate } from '@/lib/consultations';

export type ServerConsultaRow = {
  id: string;
  status?: string;
  inicio: string;
  fim?: string | null;
  paciente?: string;
  servico?: string;
  telefone?: string | null;
  local?: string | null;
  google_event_id?: string | null;
  medico?: string | null;
  convenio?: string | null;
  lembretes_whatsapp?: boolean;
  cliente_drive_id?: string | null;
};

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

function eventMergeKey(ev: ConsultationRecord): string {
  if (ev.googleEventId) return `g:${ev.googleEventId}`;
  return `id:${String(ev.id)}`;
}

export function serverRowToConsultation(row: ServerConsultaRow): ConsultationRecord {
  const googleEventId = row.google_event_id ?? undefined;
  const id = googleEventId ? `google-${googleEventId}` : String(row.id);
  return {
    id,
    patient: row.paciente ?? '',
    service: row.servico ?? 'Atendimento',
    telefone: row.telefone ?? undefined,
    start: row.inicio,
    end: row.fim ?? undefined,
    location: row.local ?? undefined,
    googleEventId,
    medico: row.medico ?? undefined,
    convenio: row.convenio ?? undefined,
    status: (row.status as ConsultaStatus) ?? 'agendado',
    lembretesWhatsapp: row.lembretes_whatsapp !== false,
    clienteDriveId: row.cliente_drive_id ?? undefined,
  };
}

/** Mescla local + servidor: união por id/googleEventId; servidor vence em conflito de mesmo id. */
export function mergeConsultationsWithServer(
  local: ConsultationRecord[],
  server: ConsultationRecord[],
): ConsultationRecord[] {
  const byKey = new Map<string, ConsultationRecord>();

  for (const ev of local) {
    byKey.set(eventMergeKey(ev), ev);
  }

  for (const ev of server) {
    const key = eventMergeKey(ev);
    const existing = byKey.get(key);
    if (existing) {
      byKey.set(key, {
        ...ev,
        payment: existing.payment ?? ev.payment,
        tipoConsulta: existing.tipoConsulta ?? ev.tipoConsulta,
        value: existing.value ?? ev.value,
        observacoes: existing.observacoes ?? ev.observacoes,
        googleProfissionalId: existing.googleProfissionalId ?? ev.googleProfissionalId,
      });
    } else {
      byKey.set(key, ev);
    }
  }

  return Array.from(byKey.values()).sort((a, b) => {
    const ta = parseEventDate(a.start)?.getTime() ?? 0;
    const tb = parseEventDate(b.start)?.getTime() ?? 0;
    return tb - ta;
  });
}

let syncTimer: ReturnType<typeof setTimeout> | null = null;

/** Sincroniza um atendimento imediatamente (ex.: link calendário no WhatsApp pós-agendar). */
export async function syncConsultaToServerImmediately(
  ev: ConsultationRecord,
): Promise<void> {
  if (typeof window === 'undefined') return;
  const payload = consultationToSyncPayload(ev);
  if (!payload) return;

  await fetch('/api/consultas/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ consultas: [payload] }),
  }).catch(() => {
    /* sync best-effort */
  });
}

/** Envia todos os atendimentos ao servidor (ex.: hidratação cross-device no mount). */
export async function syncAllConsultasToServer(
  events: ConsultationRecord[],
): Promise<void> {
  if (typeof window === 'undefined') return;
  const consultas = events
    .map(consultationToSyncPayload)
    .filter((c): c is NonNullable<typeof c> => !!c);
  if (consultas.length === 0) return;

  await fetch('/api/consultas/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ consultas }),
  }).catch(() => {
    /* sync best-effort */
  });
}

/** Sobe cache local, puxa Supabase e mescla (grade cross-device). */
export async function loadAndMergeConsultasFromServer(
  local: ConsultationRecord[],
): Promise<ConsultationRecord[]> {
  if (typeof window === 'undefined') return local;

  if (local.length > 0) {
    await syncAllConsultasToServer(local);
  }

  try {
    const res = await fetch('/api/consultas');
    if (!res.ok) return local;
    const data = (await res.json()) as { consultas?: ServerConsultaRow[] };
    const rows = data.consultas;
    if (!rows?.length) return local;
    const serverEvents = rows.map(serverRowToConsultation);
    return mergeConsultationsWithServer(local, serverEvents);
  } catch {
    return local;
  }
}

/** @deprecated use loadAndMergeConsultasFromServer */
export const pullAndMergeConsultasFromServer = loadAndMergeConsultasFromServer;

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
