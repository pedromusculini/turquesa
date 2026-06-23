import type { ConsultationRecord, ConsultaStatus } from '@/lib/consultations';
import { parseEventDate, resolveConsultaStatus } from '@/lib/consultations';
import { buildConsultaInicioBr } from '@/lib/registrarConsultaLembrete';

const BR_TIMEZONE = 'America/Sao_Paulo';

function inicioForSync(start: Date): string {
  const data = start.toLocaleDateString('en-CA', { timeZone: BR_TIMEZONE });
  const hora = start.toLocaleTimeString('en-GB', {
    timeZone: BR_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return buildConsultaInicioBr(data, hora);
}

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
  observacoes?: string | null;
};

export function consultationToSyncPayload(ev: ConsultationRecord) {
  const start = parseEventDate(ev.start);
  const end = parseEventDate(ev.end);
  if (!start || !ev.id) return null;
  return {
    id: String(ev.id),
    patient: ev.patient?.trim() || 'Cliente',
    service: ev.service,
    telefone: ev.telefone ?? null,
    start: inicioForSync(start),
    end: end?.toISOString() ?? null,
    location: ev.location,
    googleEventId: ev.googleEventId,
    medico: ev.medico,
    convenio: ev.convenio,
    status: ev.status ?? 'confirmado',
    lembretesWhatsapp: ev.lembretesWhatsapp !== false,
    clienteDriveId: ev.clienteDriveId ?? null,
    observacoes: ev.observacoes?.trim() ? ev.observacoes.trim() : null,
  };
}

export function eventMergeKey(ev: ConsultationRecord): string {
  if (ev.googleEventId) return `g:${ev.googleEventId}`;
  return `id:${String(ev.id)}`;
}

export function consultationRichness(ev: ConsultationRecord): number {
  let score = 0;
  if (ev.googleEventId) score += 2;
  if (ev.telefone?.trim()) score += 4;
  if (ev.medico?.trim()) score += 4;
  if (ev.payment) score += 8;
  if (ev.clienteDriveId) score += 2;
  const patient = ev.patient?.trim().toLowerCase();
  if (patient && patient !== 'cliente' && patient !== 'novo cliente') score += 2;
  if (ev.observacoes?.trim()) score += 1;
  return score;
}

function isGenericPatient(patient?: string): boolean {
  const p = patient?.trim().toLowerCase();
  return !p || p === 'cliente' || p === 'novo cliente';
}

/** Mesmo horário (±1 min) e mesma profissional, se informada. */
export function sameAppointmentSlot(a: ConsultationRecord, b: ConsultationRecord): boolean {
  const ta = parseEventDate(a.start)?.getTime();
  const tb = parseEventDate(b.start)?.getTime();
  if (ta == null || tb == null) return false;
  if (Math.abs(ta - tb) > 60_000) return false;
  const medicoA = a.medico?.trim().toLowerCase() ?? '';
  const medicoB = b.medico?.trim().toLowerCase() ?? '';
  if (medicoA && medicoB && medicoA !== medicoB) return false;
  return true;
}

/** Escolhe start/end na mescla: servidor/Google devem vencer sobre cache local rico. */
function pickScheduleOnMerge(
  a: ConsultationRecord,
  b: ConsultationRecord,
  options?: { scheduleFromB?: boolean },
): Pick<ConsultationRecord, 'start' | 'end'> {
  if (options?.scheduleFromB) {
    return { start: b.start, end: b.end };
  }

  const gidA = a.googleEventId ? String(a.googleEventId) : '';
  const gidB = b.googleEventId ? String(b.googleEventId) : '';
  if (gidA && gidA === gidB) {
    const ta = parseEventDate(a.start)?.getTime();
    const tb = parseEventDate(b.start)?.getTime();
    if (ta != null && tb != null && Math.abs(ta - tb) > 60_000) {
      const aFromGoogle = String(a.id).startsWith('google-');
      const bFromGoogle = String(b.id).startsWith('google-');
      if (aFromGoogle && !bFromGoogle) return { start: a.start, end: a.end };
      if (bFromGoogle && !aFromGoogle) return { start: b.start, end: b.end };
      return { start: b.start, end: b.end };
    }
  }

  const rich = consultationRichness(a) >= consultationRichness(b) ? a : b;
  return { start: rich.start, end: rich.end };
}

function mergeConsultationRecords(
  a: ConsultationRecord,
  b: ConsultationRecord,
  options?: { scheduleFromB?: boolean },
): ConsultationRecord {
  const rich = consultationRichness(a) >= consultationRichness(b) ? a : b;
  const sparse = rich === a ? b : a;
  const googleEventId = rich.googleEventId ?? sparse.googleEventId;
  const payment = rich.payment ?? sparse.payment;
  const schedule = pickScheduleOnMerge(a, b, options);

  return {
    ...rich,
    id: String(rich.id),
    start: schedule.start,
    end: schedule.end,
    googleEventId,
    googleProfissionalId: rich.googleProfissionalId ?? sparse.googleProfissionalId,
    medicoProfissionalId: rich.medicoProfissionalId ?? sparse.medicoProfissionalId,
    patient: !isGenericPatient(rich.patient) ? rich.patient : sparse.patient || rich.patient,
    telefone: rich.telefone ?? sparse.telefone,
    medico: rich.medico ?? sparse.medico,
    service: rich.service ?? sparse.service,
    location: rich.location ?? sparse.location,
    payment,
    tipoConsulta: rich.tipoConsulta ?? sparse.tipoConsulta,
    value: rich.value ?? sparse.value,
    observacoes: rich.observacoes ?? sparse.observacoes,
    clienteDriveId: rich.clienteDriveId ?? sparse.clienteDriveId,
    status: resolveConsultaStatus(rich.status, sparse.status, payment),
    lembretesWhatsapp: rich.lembretesWhatsapp,
  };
}

/** Outro registro que representa o mesmo agendamento (googleEventId ou horário+profissional). */
export function findDuplicatePartner(
  target: ConsultationRecord,
  events: ConsultationRecord[],
): ConsultationRecord | null {
  for (const ev of events) {
    if (String(ev.id) === String(target.id)) continue;
    if (target.googleEventId && ev.googleEventId === target.googleEventId) return ev;
    if (sameAppointmentSlot(target, ev)) return ev;
  }
  return null;
}

/** Remove duplicatas (googleEventId, id local órfão ou mesmo horário). */
export function dedupeConsultations(events: ConsultationRecord[]): ConsultationRecord[] {
  if (events.length <= 1) return events;

  const consumed = new Set<number>();
  const result: ConsultationRecord[] = [];

  const byGoogle = new Map<string, number[]>();
  for (let i = 0; i < events.length; i++) {
    const gid = events[i].googleEventId;
    if (!gid) continue;
    const key = String(gid);
    if (!byGoogle.has(key)) byGoogle.set(key, []);
    byGoogle.get(key)!.push(i);
  }

  for (const group of byGoogle.values()) {
    let merged = events[group[0]];
    for (const idx of group.slice(1)) {
      merged = mergeConsultationRecords(merged, events[idx]);
      consumed.add(idx);
    }
    for (let i = 0; i < events.length; i++) {
      if (consumed.has(i) || events[i].googleEventId) continue;
      if (sameAppointmentSlot(events[i], merged)) {
        merged = mergeConsultationRecords(merged, events[i]);
        consumed.add(i);
      }
    }
    consumed.add(group[0]);
    result.push(merged);
  }

  const orphans: number[] = [];
  for (let i = 0; i < events.length; i++) {
    if (!consumed.has(i)) orphans.push(i);
  }

  const orphanConsumed = new Set<number>();
  for (const i of orphans) {
    if (orphanConsumed.has(i)) continue;
    let merged = events[i];
    orphanConsumed.add(i);
    for (const j of orphans) {
      if (orphanConsumed.has(j) || j === i) continue;
      if (sameAppointmentSlot(events[i], events[j])) {
        merged = mergeConsultationRecords(merged, events[j]);
        orphanConsumed.add(j);
      }
    }
    result.push(merged);
  }

  return result.sort((a, b) => {
    const ta = parseEventDate(a.start)?.getTime() ?? 0;
    const tb = parseEventDate(b.start)?.getTime() ?? 0;
    return tb - ta;
  });
}

/** Mescla eventos do Google na lista local (anexa googleEventId ao registro rico existente). */
export function mergeGoogleCalendarEvents(
  current: ConsultationRecord[],
  googleEvents: ConsultationRecord[],
): ConsultationRecord[] {
  const next = [...current];

  for (const ge of googleEvents) {
    if (!ge.googleEventId) continue;
    const gid = String(ge.googleEventId);

    const byGoogleIdx = next.findIndex((e) => e.googleEventId === gid);
    if (byGoogleIdx >= 0) {
      next[byGoogleIdx] = mergeConsultationRecords(next[byGoogleIdx], ge, {
        scheduleFromB: true,
      });
      continue;
    }

    const slotIdx = next.findIndex(
      (e) => !e.googleEventId && sameAppointmentSlot(e, ge),
    );
    if (slotIdx >= 0) {
      next[slotIdx] = mergeConsultationRecords(next[slotIdx], ge, {
        scheduleFromB: true,
      });
      continue;
    }

    next.push(ge);
  }

  return dedupeConsultations(next);
}

export function serverRowToConsultation(row: ServerConsultaRow): ConsultationRecord {
  const googleEventId = row.google_event_id ?? undefined;
  return {
    id: String(row.id),
    patient: row.paciente ?? '',
    service: row.servico ?? 'Atendimento',
    telefone: row.telefone ?? undefined,
    start: row.inicio,
    end: row.fim ?? undefined,
    location: row.local ?? undefined,
    googleEventId,
    medico: row.medico ?? undefined,
    convenio: row.convenio ?? undefined,
    status: (row.status as ConsultaStatus) ?? 'confirmado',
    lembretesWhatsapp: row.lembretes_whatsapp !== false,
    clienteDriveId: row.cliente_drive_id ?? undefined,
    observacoes: row.observacoes ?? undefined,
  };
}

/** Mescla local + servidor: metadados ricos do local; horário do servidor (multi-dispositivo). */
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
      const payment = existing.payment ?? ev.payment;
      byKey.set(
        key,
        mergeConsultationRecords(
          existing,
          {
            ...ev,
            payment,
            status: resolveConsultaStatus(existing.status, ev.status, payment),
            tipoConsulta: existing.tipoConsulta ?? ev.tipoConsulta,
            value: existing.value ?? ev.value,
            observacoes: ev.observacoes?.trim()
              ? ev.observacoes
              : existing.observacoes,
            googleProfissionalId: existing.googleProfissionalId ?? ev.googleProfissionalId,
          },
          { scheduleFromB: true },
        ),
      );
    } else {
      byKey.set(key, ev);
    }
  }

  return dedupeConsultations(Array.from(byKey.values()));
}

let syncTimer: ReturnType<typeof setTimeout> | null = null;

const fetchOpts = { cache: 'no-store' as RequestCache };

export type ConsultasSyncResult = { ok: true } | { ok: false; error: string };

async function postConsultasSync(
  consultas: NonNullable<ReturnType<typeof consultationToSyncPayload>>[],
): Promise<ConsultasSyncResult> {
  if (consultas.length === 0) return { ok: true };
  const res = await fetch('/api/consultas/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...fetchOpts,
    body: JSON.stringify({ consultas }),
  }).catch(() => null);
  if (!res?.ok) {
    const data = (await res?.json().catch(() => ({}))) as { error?: string };
    const error =
      data.error?.trim() ||
      `Falha ao salvar no servidor${res?.status ? ` (${res.status})` : ''}.`;
    console.warn('[syncConsultasClient] sync falhou:', res?.status, error);
    return { ok: false, error };
  }
  return { ok: true };
}

/** Remove atendimentos do Supabase (por id e/ou googleEventId). */
export async function deleteConsultasFromServer(options: {
  ids?: string[];
  googleEventIds?: string[];
}): Promise<void> {
  if (typeof window === 'undefined') return;
  const ids = options.ids?.filter(Boolean).map(String) ?? [];
  const googleEventIds = options.googleEventIds?.filter(Boolean).map(String) ?? [];
  if (ids.length === 0 && googleEventIds.length === 0) return;

  await fetch('/api/consultas', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    ...fetchOpts,
    body: JSON.stringify({ ids, googleEventIds }),
  }).catch(() => {
    /* delete best-effort */
  });
}

/** Sincroniza um atendimento imediatamente (ex.: link calendário no WhatsApp pós-agendar). */
export async function syncConsultaToServerImmediately(
  ev: ConsultationRecord,
): Promise<ConsultasSyncResult> {
  if (typeof window === 'undefined') return { ok: true };
  const payload = consultationToSyncPayload(ev);
  if (!payload) return { ok: false, error: 'Dados do agendamento inválidos para salvar.' };
  return postConsultasSync([payload]);
}

/** Envia todos os atendimentos ao servidor. */
const OBSERVACOES_BACKFILL_KEY = 'turquesa-agenda-observacoes-backfill-v1';

/** Sobe observações que existiam só no localStorage antes da coluna no Supabase. */
export async function backfillObservacoesToServerIfNeeded(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (window.localStorage.getItem(OBSERVACOES_BACKFILL_KEY)) return;

  const { loadConsultations } = await import('@/lib/consultations');
  const local = loadConsultations();
  const toPush = local.filter(
    (ev) => ev.observacoes?.trim() && !isPendingLocalConsulta(ev),
  );
  if (toPush.length === 0) {
    window.localStorage.setItem(OBSERVACOES_BACKFILL_KEY, '1');
    return;
  }

  await syncAllConsultasToServer(toPush);
  window.localStorage.setItem(OBSERVACOES_BACKFILL_KEY, '1');
}

export async function syncAllConsultasToServer(
  events: ConsultationRecord[],
): Promise<void> {
  if (typeof window === 'undefined') return;
  const consultas = dedupeConsultations(events)
    .map(consultationToSyncPayload)
    .filter((c): c is NonNullable<typeof c> => !!c);
  await postConsultasSync(consultas);
}

/** Após import Google: sobe só linhas com googleEventId importado (evita regravar cache local antigo). */
export async function syncGoogleImportToServer(
  merged: ConsultationRecord[],
  googleEvents: ConsultationRecord[],
): Promise<void> {
  if (typeof window === 'undefined') return;
  const importedGids = new Set(
    googleEvents
      .map((g) => g.googleEventId)
      .filter((gid): gid is string => !!gid)
      .map(String),
  );
  if (importedGids.size === 0) return;

  const toSync = merged.filter(
    (ev) => ev.googleEventId && importedGids.has(String(ev.googleEventId)),
  );
  await syncAllConsultasToServer(toSync);
}

async function fetchServerConsultas(): Promise<ConsultationRecord[]> {
  const res = await fetch('/api/consultas', fetchOpts);
  if (!res.ok) return [];
  const data = (await res.json()) as { consultas?: ServerConsultaRow[] };
  const rows = data.consultas;
  if (!rows?.length) return [];
  return rows.map(serverRowToConsultation);
}

async function cleanupDedupedOrphans(
  before: ConsultationRecord[],
  after: ConsultationRecord[],
): Promise<void> {
  const keptIds = new Set(after.map((ev) => String(ev.id)));
  const keptGoogle = new Set(
    after.filter((ev) => ev.googleEventId).map((ev) => String(ev.googleEventId)),
  );

  const orphanIds = before
    .filter((ev) => {
      if (keptIds.has(String(ev.id))) return false;
      if (ev.googleEventId && keptGoogle.has(String(ev.googleEventId))) return true;
      return true;
    })
    .map((ev) => String(ev.id));

  if (orphanIds.length > 0) {
    await deleteConsultasFromServer({ ids: orphanIds });
  }
}

/** Mescla pull do servidor: existência definida pelo Supabase; só mantém rascunhos local-*. */
export function mergeServerPullWithLocal(
  local: ConsultationRecord[],
  serverEvents: ConsultationRecord[],
): ConsultationRecord[] {
  if (serverEvents.length === 0) {
    return dedupeConsultations(local.filter(isPendingLocalConsulta));
  }

  const serverKeys = new Set(serverEvents.map(eventMergeKey));
  const pendingLocal = local.filter(
    (ev) => !serverKeys.has(eventMergeKey(ev)) && isPendingLocalConsulta(ev),
  );

  const preDedupe = mergeConsultationsWithServer(pendingLocal, serverEvents);
  return dedupeConsultations(preDedupe);
}

/** Consulta criada localmente e ainda não confirmada no Supabase. */
export function isPendingLocalConsulta(ev: ConsultationRecord): boolean {
  const id = String(ev.id ?? '');
  return id.startsWith('local-');
}

/** Puxa Supabase e mescla com local (sem sobrescrever servidor com cache antigo). */
export async function loadAndMergeConsultasFromServer(
  local: ConsultationRecord[],
): Promise<ConsultationRecord[]> {
  if (typeof window === 'undefined') return local;

  let serverEvents: ConsultationRecord[] = [];
  try {
    serverEvents = await fetchServerConsultas();
  } catch {
    return dedupeConsultations(local);
  }

  const preDedupe = mergeServerPullWithLocal(local, serverEvents);
  const merged = preDedupe;

  if (preDedupe.length > merged.length) {
    await cleanupDedupedOrphans(preDedupe, merged);
  }

  const serverKeys = new Set(serverEvents.map(eventMergeKey));
  const pendingPush = merged.filter(
    (ev) => isPendingLocalConsulta(ev) && !serverKeys.has(eventMergeKey(ev)),
  );
  if (pendingPush.length > 0) {
    await syncAllConsultasToServer(pendingPush);
  }

  return merged;
}

/** Atualiza grade a partir do servidor (focus/visibility) — não envia localStorage. */
export async function refreshConsultasFromServer(
  local: ConsultationRecord[],
): Promise<ConsultationRecord[]> {
  if (typeof window === 'undefined') return local;

  try {
    const serverEvents = await fetchServerConsultas();
    const merged = mergeServerPullWithLocal(local, serverEvents);
    if (merged.length < local.length) {
      await cleanupDedupedOrphans(local, merged);
    }
    return merged;
  } catch {
    return dedupeConsultations(local);
  }
}

/** @deprecated use loadAndMergeConsultasFromServer */
export const pullAndMergeConsultasFromServer = loadAndMergeConsultasFromServer;

/** Envia atendimentos ao servidor (debounce) após cada alteração local. */
export function scheduleSyncConsultasToServer(events: ConsultationRecord[]): void {
  if (typeof window === 'undefined') return;
  if (syncTimer) clearTimeout(syncTimer);

  syncTimer = setTimeout(() => {
    void syncAllConsultasToServer(events);
  }, 800);
}

/** Sobe alterações locais pendentes antes de puxar do servidor (sync manual). */
export async function flushLocalConsultasToServer(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }
  const { loadConsultations } = await import('@/lib/consultations');
  await syncAllConsultasToServer(loadConsultations());
}

/** Puxa consultas do Supabase como fonte de verdade (substitui cache local). */
export async function pullConsultasAuthoritativeFromServer(): Promise<ConsultationRecord[]> {
  if (typeof window === 'undefined') return [];
  const serverEvents = await fetchServerConsultas();
  return dedupeConsultations(serverEvents);
}
