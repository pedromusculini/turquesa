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
  google_profissional_id?: string | null;
  medico?: string | null;
  convenio?: string | null;
  lembretes_whatsapp?: boolean;
  cliente_drive_id?: string | null;
  observacoes?: string | null;
  sync_health?: import('@/lib/agendaSyncHealth').AgendaSyncHealth;
  conflict_google_inicio?: string | null;
  conflict_google_fim?: string | null;
  google_outbox?: 'pending' | 'error' | null;
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
    googleProfissionalId: ev.googleProfissionalId,
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

function normalizedProfissionalName(value?: string | null): string {
  return value?.trim().toLowerCase() ?? '';
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

function normalizePatientKey(name?: string | null): string {
  return (name ?? '').trim().toLowerCase();
}

function normalizePhoneKey(phone?: string | null): string {
  if (!phone?.trim()) return '';
  return phone.replace(/\D/g, '');
}

/** Mesmo slot + mesmo cliente (telefone ou nome) — evita duplicata Google + turquesa_only. */
export function samePatientAppointmentSlot(
  a: ConsultationRecord,
  b: ConsultationRecord,
): boolean {
  if (!sameAppointmentSlot(a, b)) return false;
  const phoneA = normalizePhoneKey(a.telefone);
  const phoneB = normalizePhoneKey(b.telefone);
  if (phoneA && phoneB) return phoneA === phoneB;
  const pacA = normalizePatientKey(a.patient);
  const pacB = normalizePatientKey(b.patient);
  const generic = (p: string) => !p || p === 'cliente' || p === 'novo cliente';
  if (!generic(pacA) && !generic(pacB) && pacA === pacB) return true;
  return false;
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

type MergeConsultationOptions = {
  scheduleFromB?: boolean;
  serverWinsMetadata?: boolean;
  /** Força horário do registro a ou b (ex.: drag aguardando confirmação no servidor). */
  preferScheduleFrom?: 'a' | 'b';
};

function mergeConsultationRecords(
  a: ConsultationRecord,
  b: ConsultationRecord,
  options?: MergeConsultationOptions,
): ConsultationRecord {
  const scheduleFromB = options?.scheduleFromB ?? false;
  const serverWins = options?.serverWinsMetadata ?? false;
  const server = scheduleFromB ? b : a;
  const local = scheduleFromB ? a : b;

  const rich = consultationRichness(a) >= consultationRichness(b) ? a : b;
  const sparse = rich === a ? b : a;
  // Com serverWins (sem edição local pendente) o vínculo Google é do servidor:
  // troca de profissional muda event_id + calendário, e o cache local ficava preso
  // na agenda antiga (ex.: mobile continuava mostrando a profissional anterior).
  const googleEventId = serverWins
    ? (server.googleEventId ?? local.googleEventId ?? rich.googleEventId ?? sparse.googleEventId)
    : (a.googleEventId ?? b.googleEventId ?? rich.googleEventId ?? sparse.googleEventId);
  const payment = rich.payment ?? sparse.payment;
  const schedule =
    options?.preferScheduleFrom === 'a'
      ? { start: a.start, end: a.end }
      : options?.preferScheduleFrom === 'b'
        ? { start: b.start, end: b.end }
        : pickScheduleOnMerge(a, b, options);

  const patient = serverWins
    ? !isGenericPatient(server.patient)
      ? server.patient
      : !isGenericPatient(local.patient)
        ? local.patient
        : rich.patient ?? sparse.patient
    : !isGenericPatient(rich.patient)
      ? rich.patient
      : sparse.patient || rich.patient;

  const service = serverWins
    ? (server.service?.trim() || local.service?.trim() || rich.service || sparse.service)
    : (rich.service ?? sparse.service);

  const observacoes = serverWins
    ? (server.observacoes?.trim()
        ? server.observacoes
        : local.observacoes?.trim()
          ? local.observacoes
          : rich.observacoes ?? sparse.observacoes)
    : (rich.observacoes ?? sparse.observacoes);

  return {
    ...rich,
    id: String(rich.id),
    start: schedule.start,
    end: schedule.end,
    googleEventId,
    googleProfissionalId: serverWins
      ? (server.googleProfissionalId ??
        local.googleProfissionalId ??
        rich.googleProfissionalId ??
        sparse.googleProfissionalId)
      : (a.googleProfissionalId ??
        b.googleProfissionalId ??
        rich.googleProfissionalId ??
        sparse.googleProfissionalId),
    medicoProfissionalId: serverWins
      ? (server.medicoProfissionalId ??
        local.medicoProfissionalId ??
        rich.medicoProfissionalId ??
        sparse.medicoProfissionalId)
      : (rich.medicoProfissionalId ?? sparse.medicoProfissionalId),
    patient,
    telefone: rich.telefone ?? sparse.telefone,
    // serverWins: a profissional do servidor manda (troca Rani→Marri reflete no cache).
    // Se o vínculo Google mudou, NÃO herdar o nome antigo do local mesmo se medico vier vazio.
    medico: serverWins
      ? (() => {
          if (server.medico?.trim()) return server.medico;
          const serverProf = server.googleProfissionalId ?? null;
          const localProf = local.googleProfissionalId ?? null;
          if (serverProf && localProf && serverProf !== localProf) {
            return server.medico?.trim() ? server.medico : undefined;
          }
          return local.medico ?? rich.medico ?? sparse.medico;
        })()
      : (rich.medico ?? sparse.medico),
    service,
    location: rich.location ?? sparse.location,
    payment,
    tipoConsulta: rich.tipoConsulta ?? sparse.tipoConsulta,
    value: rich.value ?? sparse.value,
    observacoes,
    clienteDriveId: rich.clienteDriveId ?? sparse.clienteDriveId,
    status: resolveConsultaStatus(rich.status, sparse.status, payment),
    lembretesWhatsapp: rich.lembretesWhatsapp,
    syncHealth: server.syncHealth ?? rich.syncHealth ?? sparse.syncHealth,
    conflictGoogleInicio:
      server.syncHealth && server.syncHealth !== 'needs_review'
        ? server.conflictGoogleInicio
        : (server.conflictGoogleInicio ??
          rich.conflictGoogleInicio ??
          sparse.conflictGoogleInicio),
    conflictGoogleFim:
      server.syncHealth && server.syncHealth !== 'needs_review'
        ? server.conflictGoogleFim
        : server.conflictGoogleFim !== undefined
          ? server.conflictGoogleFim
          : (rich.conflictGoogleFim ?? sparse.conflictGoogleFim),
    googleOutbox: server.googleOutbox ?? null,
  };
}

/** Outro registro que representa o mesmo agendamento (googleEventId ou horário+profissional). */
export function findDuplicatePartner(
  target: ConsultationRecord,
  events: ConsultationRecord[],
): ConsultationRecord | null {
  return findAllDuplicatePartners(target, events)[0] ?? null;
}

/** Todas as cópias do mesmo agendamento (para exclusão em cascata). */
export function findAllDuplicatePartners(
  target: ConsultationRecord,
  events: ConsultationRecord[],
): ConsultationRecord[] {
  const partners: ConsultationRecord[] = [];
  for (const ev of events) {
    if (String(ev.id) === String(target.id)) continue;
    if (target.googleEventId && ev.googleEventId === target.googleEventId) {
      partners.push(ev);
      continue;
    }
    if (sameAppointmentSlot(target, ev)) partners.push(ev);
  }
  return partners;
}

export type ConsultaRemovePlan = {
  idsToDelete: string[];
  /** Só preenchido quando o registro excluído pelo usuário tem evento Google. */
  googleEventId?: string;
  googleProfissionalId?: string;
  /** Bloqueia reimport — só exclusão canônica (não fantasma). */
  tombstoneGoogleEventId?: string;
};

/**
 * Define o que apagar ao excluir um agendamento:
 * - Fantasma (menos dados / sem cliente): só a linha clicada, sem Google.
 * - Canônico: linha clicada + cópias mais esparsas no Supabase; Google só se a linha clicada tiver vínculo.
 */
export function planConsultaRemoval(
  event: ConsultationRecord,
  events: ConsultationRecord[],
): ConsultaRemovePlan {
  const id = String(event.id);
  const partners = findAllDuplicatePartners(event, events);
  const richerPartner = partners.find(
    (p) => consultationRichness(p) > consultationRichness(event),
  );

  if (richerPartner) {
    return { idsToDelete: [id] };
  }

  const idsToDelete = [id];
  for (const p of partners) {
    if (consultationRichness(p) < consultationRichness(event)) {
      idsToDelete.push(String(p.id));
    }
  }

  const googleEventId = event.googleEventId ? String(event.googleEventId) : undefined;
  return {
    idsToDelete: [...new Set(idsToDelete)],
    googleEventId,
    googleProfissionalId: event.googleProfissionalId,
    tombstoneGoogleEventId: googleEventId,
  };
}

/** Dedupe na UI: mesmo googleEventId; depois Google + turquesa_only do mesmo cliente/slot. */
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
    // Preferir linha canônica (UUID) sobre google-* / local-* como base.
    const ordered = [...group].sort((ia, ib) => {
      const rank = (ev: ConsultationRecord) => {
        const id = String(ev.id ?? '');
        if (id.startsWith('google-') || id.startsWith('local-')) return 0;
        return 1;
      };
      const d = rank(events[ib]) - rank(events[ia]);
      if (d !== 0) return d;
      return consultationRichness(events[ib]) - consultationRichness(events[ia]);
    });
    let merged = events[ordered[0]];
    for (const idx of ordered.slice(1)) {
      // ghost (a) + canônico (b=merged): servidor/canônico vence metadados e horário.
      merged = mergeConsultationRecords(events[idx], merged, {
        scheduleFromB: true,
        serverWinsMetadata: true,
      });
      consumed.add(idx);
    }
    consumed.add(ordered[0]);
    result.push(merged);
  }

  for (let i = 0; i < events.length; i++) {
    if (!consumed.has(i)) result.push(events[i]);
  }

  // Passo 2: linha turquesa_only (sem gid) + evento Google do mesmo cliente/slot.
  const out: ConsultationRecord[] = [];
  const used = new Set<number>();
  for (let i = 0; i < result.length; i++) {
    if (used.has(i)) continue;
    const a = result[i];
    let merged = a;
    for (let j = i + 1; j < result.length; j++) {
      if (used.has(j)) continue;
      const b = result[j];
      const aHasGid = !!a.googleEventId;
      const bHasGid = !!b.googleEventId;
      if (aHasGid === bHasGid) continue;
      if (!samePatientAppointmentSlot(a, b)) continue;
      const withGid = aHasGid ? a : b;
      const without = aHasGid ? b : a;
      // Preferir canônico UUID + vínculo Google.
      merged = mergeConsultationRecords(without, withGid, {
        scheduleFromB: true,
        serverWinsMetadata: true,
      });
      used.add(j);
    }
    used.add(i);
    out.push(merged);
  }

  return out.sort((a, b) => {
    const ta = parseEventDate(a.start)?.getTime() ?? 0;
    const tb = parseEventDate(b.start)?.getTime() ?? 0;
    return tb - ta;
  });
}

export function serverRowToConsultation(row: ServerConsultaRow): ConsultationRecord {
  const googleEventId = row.google_event_id ?? undefined;
  const googleProfissionalId = row.google_profissional_id ?? undefined;
  return {
    id: String(row.id),
    patient: row.paciente ?? '',
    service: row.servico ?? 'Atendimento',
    telefone: row.telefone ?? undefined,
    start: row.inicio,
    end: row.fim ?? undefined,
    location: row.local ?? undefined,
    googleEventId,
    googleProfissionalId,
    medico: row.medico ?? undefined,
    convenio: row.convenio ?? undefined,
    status: (row.status as ConsultaStatus) ?? 'confirmado',
    lembretesWhatsapp: row.lembretes_whatsapp !== false,
    clienteDriveId: row.cliente_drive_id ?? undefined,
    observacoes: row.observacoes ?? undefined,
    syncHealth: row.sync_health,
    conflictGoogleInicio: row.conflict_google_inicio ?? undefined,
    conflictGoogleFim: row.conflict_google_fim ?? undefined,
    googleOutbox: row.google_outbox ?? null,
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
      const profissionalChanged =
        normalizedProfissionalName(existing.medico) !==
        normalizedProfissionalName(ev.medico);
      const merged = mergeConsultationRecords(
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
        },
        { scheduleFromB: true },
      );
      byKey.set(
        key,
        profissionalChanged
          ? {
              ...merged,
              medico: ev.medico ?? undefined,
              googleProfissionalId: ev.googleProfissionalId ?? undefined,
            }
          : merged,
      );
    } else {
      byKey.set(key, ev);
    }
  }

  return dedupeConsultations(Array.from(byKey.values()));
}

let syncTimer: ReturnType<typeof setTimeout> | null = null;

/** local-* em sync imediato (backgroundSync) — não reenviar no debounce de 800ms. */
const immediateSyncLocalIds = new Set<string>();

export function trackImmediateConsultaSync(...ids: string[]): void {
  for (const id of ids) {
    const s = String(id).trim();
    if (s) immediateSyncLocalIds.add(s);
  }
}

export function untrackImmediateConsultaSync(...ids: string[]): void {
  for (const id of ids) {
    immediateSyncLocalIds.delete(String(id));
  }
}

const PENDING_SERVER_CONFIRM_MS = 90_000;
const pendingServerConfirmUntil = new Map<string, number>();

type PendingScheduleOverride = {
  start: string;
  end?: string;
  until: number;
};

type PendingMetadataOverride = {
  service?: string;
  observacoes?: string;
  googleEventId?: string;
  googleProfissionalId?: string;
  medico?: string;
  until: number;
};

/** Horário local aguardando confirmação — independente do eventsRef (evita race no poll). */
const pendingScheduleOverride = new Map<string, PendingScheduleOverride>();
/** Serviço / vínculo Google locais até o agenda-view confirmar (evita poll reverter save). */
const pendingMetadataOverride = new Map<string, PendingMetadataOverride>();

function pendingConfirmKeys(ev: ConsultationRecord): string[] {
  const keys = [String(ev.id)];
  if (ev.googleEventId) keys.push(`g:${ev.googleEventId}`);
  return keys;
}

function getPendingScheduleOverride(
  ev: ConsultationRecord,
): PendingScheduleOverride | null {
  const now = Date.now();
  for (const key of pendingConfirmKeys(ev)) {
    const entry = pendingScheduleOverride.get(key);
    if (entry && now < entry.until) return entry;
    if (entry) pendingScheduleOverride.delete(key);
  }
  return null;
}

function getPendingMetadataOverride(
  ev: ConsultationRecord,
): PendingMetadataOverride | null {
  const now = Date.now();
  for (const key of pendingConfirmKeys(ev)) {
    const entry = pendingMetadataOverride.get(key);
    if (entry && now < entry.until) return entry;
    if (entry) pendingMetadataOverride.delete(key);
  }
  return null;
}

function applyPendingScheduleOverride(
  ev: ConsultationRecord,
): ConsultationRecord {
  const override = getPendingScheduleOverride(ev);
  if (!override) return ev;
  return {
    ...ev,
    start: override.start,
    end: override.end,
  };
}

function applyPendingMetadataOverride(
  ev: ConsultationRecord,
): ConsultationRecord {
  const override = getPendingMetadataOverride(ev);
  if (!override) return ev;
  return {
    ...ev,
    service: override.service?.trim() || ev.service,
    observacoes: override.observacoes?.trim()
      ? override.observacoes
      : ev.observacoes,
    googleEventId: override.googleEventId || ev.googleEventId,
    googleProfissionalId:
      override.googleProfissionalId || ev.googleProfissionalId,
    medico: override.medico?.trim() || ev.medico,
  };
}

function normalizeServiceLabel(value?: string | null): string {
  return value?.trim().toLowerCase() ?? '';
}

/** Serviço, profissional e vínculo Google alinhados (além do horário). */
export function consultaMetadataMatches(
  local: ConsultationRecord,
  server: ConsultationRecord,
): boolean {
  const localService = normalizeServiceLabel(local.service);
  const serverService = normalizeServiceLabel(server.service);
  if (localService && serverService && localService !== serverService) {
    return false;
  }
  const localMedico = normalizedProfissionalName(local.medico);
  const serverMedico = normalizedProfissionalName(server.medico);
  if (localMedico && serverMedico && localMedico !== serverMedico) {
    return false;
  }
  if (local.googleEventId && !server.googleEventId) return false;
  if (
    local.googleEventId &&
    server.googleEventId &&
    String(local.googleEventId) !== String(server.googleEventId)
  ) {
    return false;
  }
  return true;
}

/** Servidor confirmou o que o cliente acabou de salvar (horário + metadata). */
export function consultaServerConfirmsLocal(
  local: ConsultationRecord,
  server: ConsultationRecord,
): boolean {
  const expected = applyPendingMetadataOverride(
    applyPendingScheduleOverride(local),
  );
  return (
    consultaSchedulesMatch(expected, server) &&
    consultaMetadataMatches(expected, server)
  );
}

/** Marca consulta aguardando confirmação no agenda-view (evita sumir no poll). */
export function markConsultaPendingServerConfirmation(
  ev: ConsultationRecord,
  ttlMs = PENDING_SERVER_CONFIRM_MS,
): void {
  const until = Date.now() + ttlMs;
  for (const key of pendingConfirmKeys(ev)) {
    pendingServerConfirmUntil.set(key, until);
  }
}

/** Preserva serviço e google_event_id locais até o Supabase refletir o save. */
export function markConsultaPendingMetadata(
  ev: ConsultationRecord,
  ttlMs = PENDING_SERVER_CONFIRM_MS,
): void {
  markConsultaPendingServerConfirmation(ev, ttlMs);
  const entry: PendingMetadataOverride = {
    service: ev.service,
    observacoes: ev.observacoes?.trim() || undefined,
    googleEventId: ev.googleEventId ? String(ev.googleEventId) : undefined,
    googleProfissionalId: ev.googleProfissionalId,
    medico: ev.medico?.trim() || undefined,
    until: Date.now() + ttlMs,
  };
  for (const key of pendingConfirmKeys(ev)) {
    pendingMetadataOverride.set(key, entry);
  }
}

/** Preserva horário local na mescla até o Supabase confirmar (ex.: arrastar na grade). */
export function markConsultaPendingScheduleChange(
  ev: ConsultationRecord,
  ttlMs = PENDING_SERVER_CONFIRM_MS,
): void {
  markConsultaPendingServerConfirmation(ev, ttlMs);
  markConsultaPendingMetadata(ev, ttlMs);
  const entry: PendingScheduleOverride = {
    start: String(ev.start),
    end: ev.end ? String(ev.end) : undefined,
    until: Date.now() + ttlMs,
  };
  for (const key of pendingConfirmKeys(ev)) {
    pendingScheduleOverride.set(key, entry);
  }
}

export function clearConsultaPendingServerConfirmation(ev: ConsultationRecord): void {
  for (const key of pendingConfirmKeys(ev)) {
    pendingServerConfirmUntil.delete(key);
    pendingScheduleOverride.delete(key);
    pendingMetadataOverride.delete(key);
  }
}

function isConsultaPendingServerConfirmation(ev: ConsultationRecord): boolean {
  const now = Date.now();
  for (const key of pendingConfirmKeys(ev)) {
    const until = pendingServerConfirmUntil.get(key);
    if (until != null && now < until) return true;
  }
  return false;
}

function hasPendingMetadata(ev: ConsultationRecord): boolean {
  return (
    isConsultaPendingServerConfirmation(ev) ||
    getPendingMetadataOverride(ev) != null ||
    getPendingScheduleOverride(ev) != null
  );
}

/** Recupera google_event_id de cópia no mesmo slot (evita POST duplicado). */
export function recoverGoogleLinkFromEvents(
  target: ConsultationRecord,
  events: ConsultationRecord[],
): Pick<ConsultationRecord, 'googleEventId' | 'googleProfissionalId'> {
  if (target.googleEventId) {
    return {
      googleEventId: target.googleEventId,
      googleProfissionalId: target.googleProfissionalId,
    };
  }
  for (const partner of findAllDuplicatePartners(target, events)) {
    if (partner.googleEventId) {
      return {
        googleEventId: String(partner.googleEventId),
        googleProfissionalId: partner.googleProfissionalId,
      };
    }
  }
  return {};
}

/** Mesmo início/fim (±1 min). */
export function consultaSchedulesMatch(
  a: ConsultationRecord,
  b: ConsultationRecord,
  toleranceMs = 60_000,
): boolean {
  const aStart = parseEventDate(a.start)?.getTime();
  const bStart = parseEventDate(b.start)?.getTime();
  if (aStart == null || bStart == null) return false;
  if (Math.abs(aStart - bStart) > toleranceMs) return false;
  const aEnd = parseEventDate(a.end)?.getTime();
  const bEnd = parseEventDate(b.end)?.getTime();
  if (aEnd != null && bEnd != null && Math.abs(aEnd - bEnd) > toleranceMs) {
    return false;
  }
  return true;
}

function findServerConsultaMatch(
  ev: ConsultationRecord,
  serverEvents: ConsultationRecord[],
): ConsultationRecord | undefined {
  return serverEvents.find(
    (s) =>
      String(s.id) === String(ev.id) ||
      (ev.googleEventId &&
        s.googleEventId &&
        String(s.googleEventId) === String(ev.googleEventId)),
  );
}

function maybeClearPendingServerConfirmation(
  localEv: ConsultationRecord,
  serverEvents: ConsultationRecord[],
): void {
  if (!hasPendingMetadata(localEv)) return;
  const serverEv = findServerConsultaMatch(localEv, serverEvents);
  if (serverEv && consultaServerConfirmsLocal(localEv, serverEv)) {
    clearConsultaPendingServerConfirmation(localEv);
  }
}

function hasPendingScheduleMismatch(
  localEv: ConsultationRecord,
  serverEv: ConsultationRecord,
): boolean {
  const expectedLocal = applyPendingScheduleOverride(localEv);
  const pending =
    isConsultaPendingServerConfirmation(localEv) ||
    getPendingScheduleOverride(localEv) != null;
  return pending && !consultaSchedulesMatch(expectedLocal, serverEv);
}

function isOnServerList(
  ev: ConsultationRecord,
  serverEvents: ConsultationRecord[],
): boolean {
  return serverEvents.some(
    (s) =>
      String(s.id) === String(ev.id) ||
      (ev.googleEventId &&
        s.googleEventId &&
        String(s.googleEventId) === String(ev.googleEventId)) ||
      sameAppointmentSlot(s, ev),
  );
}

const fetchOpts = { cache: 'no-store' as RequestCache };

export type ConsultaSyncSavedRow = {
  requestedId: string;
  id: string;
  google_event_id: string | null;
  google_profissional_id: string | null;
};

export type ConsultasSyncResult =
  | { ok: true; saved?: ConsultaSyncSavedRow[] }
  | { ok: false; error: string };

async function postConsultasSync(
  consultas: NonNullable<ReturnType<typeof consultationToSyncPayload>>[],
  options?: { enqueueGoogleSync?: boolean },
): Promise<ConsultasSyncResult> {
  if (consultas.length === 0) return { ok: true, saved: [] };
  const res = await fetch('/api/consultas/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...fetchOpts,
    body: JSON.stringify({
      consultas,
      enqueueGoogleSync: options?.enqueueGoogleSync === true,
    }),
  }).catch(() => null);
  if (!res?.ok) {
    const data = (await res?.json().catch(() => ({}))) as { error?: string };
    const error =
      data.error?.trim() ||
      `Falha ao salvar no servidor${res?.status ? ` (${res.status})` : ''}.`;
    console.warn('[syncConsultasClient] sync falhou:', res?.status, error);
    return { ok: false, error };
  }
  const data = (await res.json().catch(() => ({}))) as {
    saved?: ConsultaSyncSavedRow[];
    upserted?: number;
  };
  const upserted = data.upserted ?? data.saved?.length ?? 0;
  if (upserted === 0) {
    return {
      ok: false,
      error:
        'O servidor não confirmou o salvamento do agendamento. Tente novamente.',
    };
  }
  return { ok: true, saved: data.saved ?? [] };
}

/** Aplica ids canônicos devolvidos pelo servidor ao registro local. */
export function applyConsultaSyncSavedRow(
  ev: ConsultationRecord,
  saved: ConsultaSyncSavedRow | undefined,
): ConsultationRecord {
  if (!saved) return ev;
  return {
    ...ev,
    id: saved.id,
    googleEventId: saved.google_event_id ?? ev.googleEventId,
    googleProfissionalId:
      saved.google_profissional_id ?? ev.googleProfissionalId,
  };
}

export type ConsultasDeleteResult = { ok: true } | { ok: false; error: string };

/** Remove atendimentos do Supabase (por id e/ou googleEventId). */
export async function deleteConsultasFromServer(options: {
  ids?: string[];
  googleEventIds?: string[];
  tombstoneGoogleEventIds?: string[];
}): Promise<ConsultasDeleteResult> {
  if (typeof window === 'undefined') return { ok: true };
  const ids = options.ids?.filter(Boolean).map(String) ?? [];
  const googleEventIds = options.googleEventIds?.filter(Boolean).map(String) ?? [];
  const tombstoneGoogleEventIds =
    options.tombstoneGoogleEventIds?.filter(Boolean).map(String) ?? [];
  if (ids.length === 0 && googleEventIds.length === 0) return { ok: true };

  try {
    const { fetchWithTimeout } = await import('@/lib/fetchWithTimeout');
    const res = await fetchWithTimeout(
      '/api/consultas',
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        ...fetchOpts,
        body: JSON.stringify({ ids, googleEventIds, tombstoneGoogleEventIds }),
      },
      25_000,
    );
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      return {
        ok: false,
        error: data.error?.trim() || `Falha ao excluir (${res.status})`,
      };
    }
    return { ok: true };
  } catch (err) {
    const { isFetchTimeoutError } = await import('@/lib/fetchWithTimeout');
    return {
      ok: false,
      error: isFetchTimeoutError(err)
        ? 'A exclusão demorou demais. Tente de novo.'
        : err instanceof Error
          ? err.message
          : 'Erro de rede ao excluir',
    };
  }
}

/** PATCH horário no Supabase + fila push Google (Fase 5). */
export async function patchConsultaTimeOnServer(
  ev: ConsultationRecord,
): Promise<
  | { ok: true; inicio: string; fim: string | null }
  | { ok: false; error: string }
> {
  if (typeof window === 'undefined') {
    return { ok: true, inicio: String(ev.start), fim: ev.end ? String(ev.end) : null };
  }
  const start = parseEventDate(ev.start);
  const end = parseEventDate(ev.end);
  if (!start || !ev.id) {
    return { ok: false, error: 'Horário inválido para salvar.' };
  }

  markConsultaPendingScheduleChange(ev);

  try {
    const res = await fetch('/api/consultas/patch-time', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      ...fetchOpts,
      body: JSON.stringify({
        id: String(ev.id),
        inicio: start.toISOString(),
        fim: end?.toISOString() ?? null,
      }),
    });
    if (!res.ok) {
      clearConsultaPendingServerConfirmation(ev);
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: data.error?.trim() || `Falha ao salvar horário (${res.status})` };
    }
    const data = (await res.json().catch(() => ({}))) as {
      consulta?: { inicio?: string; fim?: string | null };
    };
    const inicio = data.consulta?.inicio ?? start.toISOString();
    const fim = data.consulta?.fim ?? end?.toISOString() ?? null;
    return { ok: true, inicio, fim };
  } catch (err) {
    clearConsultaPendingServerConfirmation(ev);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Erro de rede ao salvar horário',
    };
  }
}

export type TimeConflictResolution = {
  id: string;
  keep: 'google' | 'turquesa';
  googleInicio: string;
  googleFim: string | null;
  turquesaInicio: string;
  turquesaFim: string | null;
};

/** Resolve conflito de horário escolhido pelo usuário (Fase 5). */
export async function resolveConsultaTimeConflictOnServer(
  resolution: TimeConflictResolution,
): Promise<{ ok: true; inicio: string; fim: string | null } | { ok: false; error: string }> {
  if (typeof window === 'undefined') {
    return { ok: true, inicio: resolution.turquesaInicio, fim: resolution.turquesaFim };
  }

  try {
    const res = await fetch('/api/consultas/resolve-time-conflict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      ...fetchOpts,
      body: JSON.stringify(resolution),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: data.error?.trim() || `Falha ao resolver conflito (${res.status})` };
    }
    const data = (await res.json()) as {
      consulta?: { inicio: string; fim: string | null };
    };
    return {
      ok: true,
      inicio: data.consulta?.inicio ?? resolution.turquesaInicio,
      fim: data.consulta?.fim ?? resolution.turquesaFim,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Erro de rede ao resolver conflito',
    };
  }
}

/** Sincroniza um atendimento imediatamente (ex.: link calendário no WhatsApp pós-agendar). */
export async function syncConsultaToServerImmediately(
  ev: ConsultationRecord,
): Promise<ConsultasSyncResult & { event?: ConsultationRecord }> {
  if (typeof window === 'undefined') return { ok: true };
  const payload = consultationToSyncPayload(ev);
  if (!payload) return { ok: false, error: 'Dados do agendamento inválidos para salvar.' };

  const trackedId = String(ev.id);
  const wasLocal = isPendingLocalConsulta(ev);
  if (wasLocal) trackImmediateConsultaSync(trackedId);

  try {
    markConsultaPendingScheduleChange(ev);
    markConsultaPendingMetadata(ev);
    // Edição/criação do usuário: enfileira sync durável para o Google (rede de segurança).
    const result = await postConsultasSync([payload], { enqueueGoogleSync: true });
    if (!result.ok) {
      clearConsultaPendingServerConfirmation(ev);
      return result;
    }

    const saved = result.saved?.[0];
    const event = applyConsultaSyncSavedRow(ev, saved);
    markConsultaPendingScheduleChange(event);
    markConsultaPendingMetadata(event);
    return { ok: true, saved: result.saved, event };
  } finally {
    if (wasLocal) untrackImmediateConsultaSync(trackedId);
  }
}

/** Envia todos os atendimentos ao servidor. */
const OBSERVACOES_BACKFILL_KEY = 'turquesa-agenda-observacoes-backfill-v1';

/** Sobe observações que existiam só no localStorage antes da coluna no Supabase. */
export async function backfillObservacoesToServerIfNeeded(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (window.localStorage.getItem(OBSERVACOES_BACKFILL_KEY)) return;

  const { loadConsultations } = await import('@/lib/consultations');
  const local = loadConsultations();
  const toPush = dedupeConsultations(local).filter(
    (ev) => ev.observacoes?.trim() && !isPendingLocalConsulta(ev),
  );
  if (toPush.length === 0) {
    window.localStorage.setItem(OBSERVACOES_BACKFILL_KEY, '1');
    return;
  }

  await syncFullConsultasListToServer(toPush);
  window.localStorage.setItem(OBSERVACOES_BACKFILL_KEY, '1');
}

export async function syncAllConsultasToServer(
  events: ConsultationRecord[],
  options?: { serverKeys?: Set<string> },
): Promise<void> {
  if (typeof window === 'undefined') return;
  const pending = listConsultasPendingPush(events, options?.serverKeys);
  if (pending.length === 0) return;

  const consultas = pending
    .map(consultationToSyncPayload)
    .filter((c): c is NonNullable<typeof c> => !!c);
  await postConsultasSync(consultas);
}

/** @deprecated Push em massa substituído por sync por registro + pending push. */
export async function syncFullConsultasListToServer(
  events: ConsultationRecord[],
): Promise<void> {
  if (typeof window === 'undefined') return;
  const deduped = dedupeConsultations(events);
  const consultas = deduped
    .map(consultationToSyncPayload)
    .filter((c): c is NonNullable<typeof c> => !!c);
  await postConsultasSync(consultas);
}

/** googleEventIds em voo (import UI → POST Supabase) — evita sumir no poll antes de persistir. */
const pendingGoogleImportGids = new Set<string>();

export function trackPendingGoogleImports(gids: Iterable<string>): void {
  for (const gid of gids) {
    const s = String(gid).trim();
    if (s) pendingGoogleImportGids.add(s);
  }
}

export function clearPendingGoogleImports(gids: Iterable<string>): void {
  for (const gid of gids) pendingGoogleImportGids.delete(String(gid));
}

/** Import do Calendar ainda não confirmado no Supabase (só imports em voo). */
export function isPendingGoogleImport(
  ev: ConsultationRecord,
  serverKeys: Set<string>,
): boolean {
  const gid = ev.googleEventId ? String(ev.googleEventId) : '';
  if (!gid || serverKeys.has(`g:${gid}`)) return false;
  // Não tratar todo google-* órfão como pendente eterno — isso ressuscitava
  // profissional/horário antigos no mobile após troca no desktop.
  return pendingGoogleImportGids.has(gid);
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

  trackPendingGoogleImports(importedGids);

  const toSync = merged.filter(
    (ev) => ev.googleEventId && importedGids.has(String(ev.googleEventId)),
  );
  const payloads = dedupeConsultations(toSync)
    .map(consultationToSyncPayload)
    .filter((c): c is NonNullable<typeof c> => !!c);
  if (payloads.length === 0) return;

  const result = await postConsultasSync(payloads);
  if (result.ok) {
    clearPendingGoogleImports(importedGids);
  }
}

async function fetchServerConsultas(): Promise<ConsultationRecord[]> {
  return fetchAgendaViewFromServer();
}

export class AgendaViewFetchError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'AgendaViewFetchError';
    this.status = status;
  }
}

/** Grade autoritativa via GET /api/consultas/agenda-view (Fase 1). */
export async function fetchAgendaViewFromServer(options?: {
  daysPast?: number;
  daysFuture?: number;
}): Promise<ConsultationRecord[]> {
  if (typeof window === 'undefined') return [];

  const params = new URLSearchParams();
  if (options?.daysPast != null) params.set('daysPast', String(options.daysPast));
  if (options?.daysFuture != null) params.set('daysFuture', String(options.daysFuture));
  const qs = params.toString();

  const res = await fetch(
    `/api/consultas/agenda-view${qs ? `?${qs}` : ''}`,
    fetchOpts,
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new AgendaViewFetchError(
      body.error?.trim() || `Falha ao carregar agenda (${res.status})`,
      res.status,
    );
  }
  const data = (await res.json()) as { consultas?: ServerConsultaRow[] };
  return (data.consultas ?? []).map(serverRowToConsultation);
}

/** Monta grade a partir do servidor, preservando apenas rascunhos local-* e imports em voo. */
export async function loadAgendaViewFromServer(
  ownerEmail: string,
): Promise<ConsultationRecord[]> {
  if (typeof window === 'undefined') return [];

  const serverEvents = await fetchAgendaViewFromServer();
  const { loadConsultations } = await import('@/lib/consultations');
  const local = loadConsultations(ownerEmail);
  const pendingDrafts = local.filter(
    (ev) =>
      isPendingLocalConsulta(ev) ||
      (ev.googleEventId != null &&
        pendingGoogleImportGids.has(String(ev.googleEventId))),
  );
  return mergeServerPullWithLocal(pendingDrafts, serverEvents);
}

export const SYNC_FULL_TIMEOUT_MS = 180_000;
export const SYNC_GOOGLE_PULL_TIMEOUT_MS = 120_000;

export type AgendaSyncFullClientMeta = {
  googleImported: number;
  repaired: { deleted: number; migrated: number };
  googlePushed: number;
  googlePushSkipped: number;
  googlePushErrors: string[];
  googlePullErrors: string[];
};

/** POST /api/agenda/sync-full — fonte única desktop/mobile (Fase 3). */
export async function syncAgendaFullFromServer(): Promise<{
  events: ConsultationRecord[];
  meta: AgendaSyncFullClientMeta;
}> {
  if (typeof window === 'undefined') {
    return {
      events: [],
      meta: {
        googleImported: 0,
        repaired: { deleted: 0, migrated: 0 },
        googlePushed: 0,
        googlePushSkipped: 0,
        googlePushErrors: [],
        googlePullErrors: [],
      },
    };
  }

  const { fetchWithTimeout } = await import('@/lib/fetchWithTimeout');
  const res = await fetchWithTimeout(
    '/api/agenda/sync-full',
    { method: 'POST', cache: 'no-store' },
    SYNC_FULL_TIMEOUT_MS,
  );

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? 'Falha ao sincronizar agenda');
  }

  const data = (await res.json()) as {
    consultas?: ServerConsultaRow[];
    googleImported?: number;
    repaired?: { deleted: number; migrated: number };
    googlePushed?: number;
    googlePushSkipped?: number;
    googlePushErrors?: string[];
    googlePullErrors?: string[];
  };

  const events = (data.consultas ?? []).map(serverRowToConsultation);
  return {
    events: dedupeConsultations(events),
    meta: {
      googleImported: data.googleImported ?? 0,
      repaired: data.repaired ?? { deleted: 0, migrated: 0 },
      googlePushed: data.googlePushed ?? 0,
      googlePushSkipped: data.googlePushSkipped ?? 0,
      googlePushErrors: data.googlePushErrors ?? [],
      googlePullErrors: data.googlePullErrors ?? [],
    },
  };
}

export type AgendaGooglePullClientMeta = {
  googleImported: number;
  googlePullErrors: string[];
};

/** POST /api/agenda/sync-google-pull — importação leve do Google (sem repair/push). */
export async function syncAgendaGooglePullFromServer(): Promise<{
  events: ConsultationRecord[];
  meta: AgendaGooglePullClientMeta;
}> {
  if (typeof window === 'undefined') {
    return {
      events: [],
      meta: { googleImported: 0, googlePullErrors: [] },
    };
  }

  const { fetchWithTimeout } = await import('@/lib/fetchWithTimeout');
  const res = await fetchWithTimeout(
    '/api/agenda/sync-google-pull',
    { method: 'POST', cache: 'no-store' },
    SYNC_GOOGLE_PULL_TIMEOUT_MS,
  );

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? 'Falha ao importar do Google');
  }

  const data = (await res.json()) as {
    consultas?: ServerConsultaRow[];
    googleImported?: number;
    googlePullErrors?: string[];
  };

  const events = (data.consultas ?? []).map(serverRowToConsultation);
  return {
    events: dedupeConsultations(events),
    meta: {
      googleImported: data.googleImported ?? 0,
      googlePullErrors: data.googlePullErrors ?? [],
    },
  };
}

/** Mescla poll/refresh: preserva grade local inteira até o servidor confirmar cada registro. */
export function mergeAgendaPollWithLocal(
  local: ConsultationRecord[],
  serverEvents: ConsultationRecord[],
): ConsultationRecord[] {
  return mergeServerPullWithLocal(local, serverEvents);
}

/** Preserva rascunhos local-* ao aplicar sync-full (sem ler localStorage como fonte). */
export function mergeAgendaSyncFullWithPendingDrafts(
  pendingDrafts: ConsultationRecord[],
  serverEvents: ConsultationRecord[],
): ConsultationRecord[] {
  return mergeServerPullWithLocal(pendingDrafts, serverEvents);
}

/** Refetch agenda-view: Supabase + rascunhos/pending locais apenas. */
export async function refetchAgendaViewAuthoritative(
  ownerEmail?: string | null,
): Promise<ConsultationRecord[]> {
  return refreshAgendaViewLight(ownerEmail);
}

/** Atualização leve (~2s): GET agenda-view sem sync Google. Servidor manda; só rascunhos locais. */
export async function refreshAgendaViewLight(
  ownerEmail?: string | null,
): Promise<ConsultationRecord[]> {
  if (typeof window === 'undefined') return [];
  const serverEvents = await fetchAgendaViewFromServer();
  const { loadConsultations } = await import('@/lib/consultations');
  const local = loadConsultations(ownerEmail);
  const pendingDrafts = local.filter(
    (ev) =>
      isPendingLocalConsulta(ev) ||
      (ev.googleEventId != null &&
        pendingGoogleImportGids.has(String(ev.googleEventId))),
  );
  return dedupeConsultations(mergeServerPullWithLocal(pendingDrafts, serverEvents));
}

/** Preserva nome, observações e vínculos do cache local quando o Supabase veio genérico/vazio. */
export function hydrateServerEventsFromLocal(
  local: ConsultationRecord[],
  serverEvents: ConsultationRecord[],
): ConsultationRecord[] {
  if (local.length === 0) return serverEvents;

  const localById = new Map<string, ConsultationRecord>();
  const localByGid = new Map<string, ConsultationRecord>();
  for (const ev of local) {
    if (ev.id) localById.set(String(ev.id), ev);
    if (ev.googleEventId) localByGid.set(String(ev.googleEventId), ev);
  }

  return serverEvents.map((serverEv) => {
    const localEv =
      localById.get(String(serverEv.id)) ??
      (serverEv.googleEventId
        ? localByGid.get(String(serverEv.googleEventId))
        : undefined);
    if (!localEv || isPendingLocalConsulta(localEv)) return serverEv;
    const effectiveLocal = applyPendingMetadataOverride(
      applyPendingScheduleOverride(localEv),
    );
    const pendingMeta = hasPendingMetadata(localEv);
    const pendingSchedule = hasPendingScheduleMismatch(effectiveLocal, serverEv);
    return mergeConsultationRecords(effectiveLocal, serverEv, {
      scheduleFromB: !pendingSchedule,
      preferScheduleFrom: pendingSchedule ? 'a' : undefined,
      // Com save recente pendente, metadata local (serviço / google id) vence o poll.
      serverWinsMetadata: !pendingMeta,
    });
  });
}

/** Mescla pull do servidor: Supabase é fonte de verdade + rascunhos local-* + imports Google pendentes. */
export function mergeServerPullWithLocal(
  local: ConsultationRecord[],
  serverEvents: ConsultationRecord[],
): ConsultationRecord[] {
  const serverKeys = new Set(serverEvents.map(eventMergeKey));
  const base = dedupeConsultations(
    hydrateServerEventsFromLocal(local, serverEvents),
  );

  const pending = local.filter((ev) => {
    if (isPendingLocalConsulta(ev)) {
      return !base.some((s) => sameAppointmentSlot(s, ev));
    }
    if (isPendingGoogleImport(ev, serverKeys)) return true;
    if (
      isConsultaPendingServerConfirmation(ev) ||
      getPendingScheduleOverride(ev) != null
    ) {
      if (!isOnServerList(ev, base)) return true;
      const onBase = findServerConsultaMatch(ev, base);
      if (onBase && hasPendingScheduleMismatch(ev, onBase)) return true;
    }
    return false;
  });

  if (pending.length === 0) {
    for (const ev of local) {
      maybeClearPendingServerConfirmation(ev, serverEvents);
    }
    return base;
  }

  const next = [...base];
  for (const p of pending) {
    const gid = p.googleEventId ? String(p.googleEventId) : null;
    let slotIdx = p.id
      ? next.findIndex((b) => String(b.id) === String(p.id))
      : -1;
    if (slotIdx < 0 && gid) {
      slotIdx = next.findIndex(
        (b) => b.googleEventId && String(b.googleEventId) === gid,
      );
    }
    if (slotIdx < 0) {
      slotIdx = next.findIndex((b) => sameAppointmentSlot(b, p));
    }
    if (slotIdx >= 0) {
      // Só sobrescreve horário se há override local pendente; metadados do servidor vencem
      // (evita ghost google-* antigo reescrever profissional após troca no desktop).
      const pendingMeta = hasPendingMetadata(p);
      const pendingSchedule =
        getPendingScheduleOverride(p) != null ||
        isConsultaPendingServerConfirmation(p);
      next[slotIdx] = mergeConsultationRecords(
        next[slotIdx],
        applyPendingScheduleOverride(p),
        {
          preferScheduleFrom: pendingSchedule ? 'b' : undefined,
          scheduleFromB: !pendingSchedule,
          serverWinsMetadata: !pendingMeta,
        },
      );
    } else {
      next.push(p);
    }
  }

  const result = dedupeConsultations(next);
  for (const ev of local) {
    maybeClearPendingServerConfirmation(ev, serverEvents);
  }
  return result;
}

/** Registros que ainda não existem no Supabase (só estes sobem no push em lote). */
export function listConsultasPendingPush(
  events: ConsultationRecord[],
  serverKeys?: Set<string>,
): ConsultationRecord[] {
  return dedupeConsultations(events).filter((ev) => {
    if (immediateSyncLocalIds.has(String(ev.id))) return false;
    if (isPendingLocalConsulta(ev)) return true;
    if (serverKeys && isPendingGoogleImport(ev, serverKeys)) return true;
    return false;
  });
}

function listPendingGoogleImportsToPush(
  merged: ConsultationRecord[],
  serverKeys: Set<string>,
): ConsultationRecord[] {
  return merged.filter(
    (ev) => isPendingGoogleImport(ev, serverKeys) && !isPendingLocalConsulta(ev),
  );
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

  const serverKeys = new Set(serverEvents.map(eventMergeKey));
  const pendingPush = merged.filter(
    (ev) => isPendingLocalConsulta(ev) && !serverKeys.has(eventMergeKey(ev)),
  );
  if (pendingPush.length > 0) {
    await syncAllConsultasToServer(pendingPush, { serverKeys });
  }

  const pendingGoogle = listPendingGoogleImportsToPush(merged, serverKeys);
  if (pendingGoogle.length > 0) {
    await syncGoogleImportToServer(merged, pendingGoogle);
  }

  return merged;
}

/** Envia apenas rascunhos pendentes ao servidor (debounce). Edições usam sync imediato por registro. */
export function scheduleSyncConsultasToServer(events: ConsultationRecord[]): void {
  if (typeof window === 'undefined') return;
  if (syncTimer) clearTimeout(syncTimer);

  const deduped = dedupeConsultations(events);
  syncTimer = setTimeout(() => {
    void syncAllConsultasToServer(deduped);
  }, 800);
}

/** Sobe rascunhos locais antes de puxar do servidor (sync manual). */
export async function flushLocalConsultasToServer(ownerEmail?: string): Promise<void> {
  if (typeof window === 'undefined') return;
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }
  const { loadConsultations } = await import('@/lib/consultations');
  const local = dedupeConsultations(loadConsultations(ownerEmail));
  await syncAllConsultasToServer(local);
}

/** Puxa consultas do Supabase como fonte de verdade, preservando imports Google ainda não persistidos. */
export async function pullConsultasAuthoritativeFromServer(
  local?: ConsultationRecord[],
  ownerEmail?: string | null,
): Promise<ConsultationRecord[]> {
  if (typeof window === 'undefined') return [];
  const serverEvents = await fetchServerConsultas();
  let localEvents = local;
  if (localEvents === undefined) {
    const { loadConsultations } = await import('@/lib/consultations');
    localEvents = loadConsultations(ownerEmail);
  }
  return mergeServerPullWithLocal(localEvents, serverEvents);
}
