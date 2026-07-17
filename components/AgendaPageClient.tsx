"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import type { EventInput } from "@fullcalendar/core";
import dynamic from "next/dynamic";

const AgendaCalendar = dynamic(() => import("@/components/AgendaCalendar"), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 min-h-[24rem] sm:min-h-[36rem] flex items-center justify-center text-slate-500">
      Carregando calendário...
    </div>
  ),
});
import { MapPin, ExternalLink, Loader2, Building2, CheckCircle2 } from "lucide-react";
import FinalizarConsultaModal from "@/components/FinalizarConsultaModal";
import AgendaConsultaModal, {
  type AgendaConsultaPayload,
  type AgendaGooglePushSnapshot,
} from "@/components/AgendaConsultaModal";
import AgendaTimeConflictModal from "@/components/AgendaTimeConflictModal";
import { invalidatePacientesOpcoesClientCache } from "@/lib/pacientesOpcoesClient";
import { clientesApiToOpcoes } from "@/lib/pacienteOpcoesUi";
import type { PacienteOpcao } from "@/lib/types";
import AgendaNovaSessaoForm, {
  type AgendaNovaSessaoSubmitData,
} from "@/components/AgendaNovaSessaoForm";
import { useMedicosOptions } from "@/lib/useMedicosOptions";
import {
  profissionalHasAgendaConnected,
  profissionalIdByNome,
} from "@/lib/loadMedicosOptions";
import {
  type ConsultationRecord,
  type FormaPagamentoConsulta,
  loadConsultations,
  saveConsultations,
  setConsultationsStorageOwner,
  applyFinalizarConsulta,
  FORMAS_PAGAMENTO_CONSULTA,
  statusConsultaBadge,
  parseEventDate,
  formatHorario,
  createConsultationEvent,
  consultationsListsEqual,
} from "@/lib/consultations";
import {
  loadAgendaViewFromServer,
  backfillObservacoesToServerIfNeeded,
  scheduleSyncConsultasToServer,
  syncConsultaToServerImmediately,
  deleteConsultasFromServer,
  dedupeConsultations,
  planConsultaRemoval,
  syncAgendaFullFromServer,
  syncAgendaGooglePullFromServer,
  SYNC_FULL_TIMEOUT_MS,
  SYNC_GOOGLE_PULL_TIMEOUT_MS,
  fetchAgendaViewFromServer,
  AgendaViewFetchError,
  mergeAgendaSyncFullWithPendingDrafts,
  mergeAgendaPollWithLocal,
  clearConsultaPendingServerConfirmation,
  markConsultaPendingScheduleChange,
  markConsultaPendingMetadata,
  isPendingLocalConsulta,
  trackImmediateConsultaSync,
  patchConsultaTimeOnServer,
  consultaSchedulesMatch,
  consultaServerConfirmsLocal,
  recoverGoogleLinkFromEvents,
  resolveConsultaTimeConflictOnServer,
} from "@/lib/syncConsultasClient";
import { fetchWithTimeout, formatAgendaFetchError, isFetchTimeoutError } from "@/lib/fetchWithTimeout";
import { resolveGoogleCalendarEvent } from "@/lib/googleCalendarResolveClient";
import {
  buildPreviousEventDeleteCandidates,
  deleteGoogleCalendarEventAcrossAgendas,
} from "@/lib/googleCalendarDeleteClient";
import { format } from "date-fns";
import {
  fetchClientesListAll,
  readClientesListCache,
} from "@/lib/clientesListCache";
import {
  fetchPerfilAgenda,
  readPerfilCacheStale,
  type PerfilAgendaFields,
} from "@/lib/perfilCache";
import PrimeirosPassosHint from "@/components/PrimeirosPassosHint";
import AgendaProfissionalFilter from "@/components/AgendaProfissionalFilter";
import {
  agendaProfFilterStorageKey,
  allProfFilterKeys,
  buildProfissionalFilterEntries,
  filterEventsByVisibleProfissionais,
  hasUnassignedProfissionalEvents,
  loadVisibleProfKeys,
  sanitizeVisibleKeys,
  saveVisibleProfKeys,
} from "@/lib/agendaProfissionalFilter";
import {
  filterEventsBySyncHealth,
  inferSyncHealth,
  SYNC_HEALTH_FILTER_CHIPS,
  type AgendaSyncHealthFilter,
} from "@/lib/agendaSyncHealthUi";
import {
  formatItensResumo,
  formatObservacaoAtendimento,
  type AtendimentoItemLinha,
} from "@/lib/atendimentoItens";
import {
  MSG_FINALIZAR_CLIENTE_FALHOU,
  MSG_FINALIZAR_SEM_CLIENTE_DRIVE,
  MSG_FINANCEIRO_FALHOU,
  postFinalizarClienteFromAgenda,
  postFinanceiroEntradaFromAgenda,
} from "@/lib/finalizarClienteFromAgenda";
import { invalidateFinanceiroCache } from "@/lib/financeiroCache";
import { startConsultasRevisionPolling } from "@/lib/consultasRevisionPoll";
import type { ConsultasRevisionApplyResult } from "@/lib/consultasRevisionPoll";
import {
  retryGoogleOutboxOnServer,
  triggerGoogleOutboxProcessing,
} from "@/lib/googleOutboxClient";
import AgendaPageGate from "@/components/AgendaPageGate";
import { useToast } from "@/components/ToastProvider";
import { useConfirm } from "@/components/ConfirmProvider";
import {
  medicoNomeChanged,
  shouldTransferGoogleCalendar,
} from "@/lib/agendaGoogleProfissionalTransfer";

type ConsultationEvent = ConsultationRecord;

function pickTimeConflictEvent(
  list: ConsultationRecord[],
): ConsultationRecord | null {
  return (
    list.find(
      (ev) =>
        inferSyncHealth(ev) === "needs_review" &&
        !!(ev.conflictGoogleInicio ?? ev.start),
    ) ?? null
  );
}

const AGENDA_DEFER_MS = 1500;
/** Intervalo mínimo entre refresh leve ao voltar para a aba (troca rápida de app). */
const AGENDA_VISIBILITY_COOLDOWN_MS = 12_000;
const AGENDA_VISIBILITY_DEBOUNCE_MS = 800;
/** Teto para adiar o pull do servidor por sync em andamento (destrava contador preso). */
const AGENDA_DEFER_PULL_MAX_MS = 45_000;
/** Após ficar em background por este tempo, ignora o cooldown (só desktop). */
const AGENDA_BACKGROUND_REFRESH_MS = 4_000;
/** Poll mais frequente no mobile (Safari throttleia timers em background). */
const AGENDA_MOBILE_PULL_INTERVAL_MS = 30_000;
/**
 * Pull Google (titular + equipe) enquanto a aba está aberta.
 * Uso: ocupação da profissional (eventos pessoais / bloqueios) para ver horário livre.
 * Fonte da verdade de sessões com ficha de cliente permanece o Turquesa (push → Google).
 */
const AGENDA_GOOGLE_PULL_INTERVAL_MS = 5 * 60_000;
/** Também puxa Google ao voltar à aba se ficou fora por este tempo. */
const AGENDA_GOOGLE_PULL_ON_FOCUS_AFTER_MS = 5 * 60_000;
/** Evita pull Google em sequência (intervalo × foco). */
const AGENDA_GOOGLE_PULL_MIN_GAP_MS = 90_000;

function formatAgendaPullError(err: unknown): string {
  if (err instanceof AgendaViewFetchError) return err.message;
  return formatAgendaFetchError(err);
}

function isMobileAgendaClient(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(max-width: 768px)").matches ||
    "ontouchstart" in window
  );
}

function scheduleMinuteMs(ms: number): number {
  return Math.floor(ms / 60_000) * 60_000;
}

function sameScheduleForEdit(
  prev: ConsultationEvent,
  start: Date,
  end: Date,
): boolean {
  const prevStart = parseEventDate(prev.start)?.getTime();
  const prevEnd = parseEventDate(prev.end)?.getTime();
  if (prevStart == null || prevEnd == null) return false;
  return (
    scheduleMinuteMs(prevStart) === scheduleMinuteMs(start.getTime()) &&
    scheduleMinuteMs(prevEnd) === scheduleMinuteMs(end.getTime())
  );
}

/** Horário e profissional iguais — só serviço, cliente, obs, etc. */
function isMetadataOnlyAgendaEdit(
  prev: ConsultationEvent | null | undefined,
  payload: AgendaConsultaPayload,
): boolean {
  if (!prev || !payload.editingId) return false;
  if (!sameScheduleForEdit(prev, payload.start, payload.end)) return false;
  const prevMed = prev.medico?.trim().toLowerCase() ?? "";
  const newMed = payload.medico?.trim().toLowerCase() ?? "";
  return prevMed === newMed;
}

function uniqueGooglePatchProfCandidates(
  ...ids: (string | undefined)[]
): (string | undefined)[] {
  const seen = new Set<string>();
  const out: (string | undefined)[] = [];
  for (const id of ids) {
    const key = id ?? "__titular__";
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(id);
  }
  return out;
}

/** Adia sync pesado para não bloquear a renderização inicial (localStorage primeiro). */
function deferNonCriticalWork(fn: () => void, delayMs = AGENDA_DEFER_MS): () => void {
  let cancelled = false;
  const run = () => {
    if (!cancelled) fn();
  };

  if (typeof window === "undefined") {
    return () => {
      cancelled = true;
    };
  }

  const w = window as Window &
    typeof globalThis & {
      requestIdleCallback?: (
        callback: IdleRequestCallback,
        options?: IdleRequestOptions,
      ) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

  if (typeof w.requestIdleCallback === "function") {
    const id = w.requestIdleCallback(run, { timeout: delayMs });
    return () => {
      cancelled = true;
      w.cancelIdleCallback?.(id);
    };
  }

  const id = globalThis.setTimeout(run, delayMs);
  return () => {
    cancelled = true;
    globalThis.clearTimeout(id);
  };
}

function consultaPodeFinalizar(ev: ConsultationEvent): boolean {
  return (
    ev.status !== "realizado" &&
    ev.status !== "cancelado" &&
    ev.status !== "faltou"
  );
}

type AgendaPageClientProps = {
  userEmail: string;
  provider?: string | null;
};

export default function AgendaPageClient({
  userEmail,
  provider,
}: AgendaPageClientProps) {
  const toast = useToast();
  const { confirm } = useConfirm();
  const [events, setEvents] = useState<ConsultationEvent[]>([]);
  const [duracaoPadraoMin, setDuracaoPadraoMin] = useState<number | null>(null);

  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [finalizando, setFinalizando] = useState<ConsultationEvent | null>(null);
  const [savingFinalizar, setSavingFinalizar] = useState(false);
  const skipNextSave = useRef(true);
  const savingFromSelf = useRef(false);
  const [serverPullDone, setServerPullDone] = useState(false);
  const [refreshingServer, setRefreshingServer] = useState(false);
  const [googleCheckDone, setGoogleCheckDone] = useState(false);
  const [agendaModal, setAgendaModal] = useState<{
    start: Date;
    end: Date;
    editing: ConsultationEvent | null;
  } | null>(null);
  const [deletingAgendaModal, setDeletingAgendaModal] = useState(false);
  const [pushingEventId, setPushingEventId] = useState<string | null>(null);
  const [googlePushMessage, setGooglePushMessage] = useState<string | null>(null);
  const [googlePushIsError, setGooglePushIsError] = useState(false);
  const backgroundSyncCountRef = useRef(0);
  const lastBackgroundSyncStartRef = useRef(0);
  const eventsRef = useRef<ConsultationEvent[]>([]);
  eventsRef.current = events;
  const [isBackgroundSyncing, setIsBackgroundSyncing] = useState(false);
  const [lastAgendaPullAt, setLastAgendaPullAt] = useState<Date | null>(null);
  const [agendaPullError, setAgendaPullError] = useState<string | null>(null);
  const [retryingGoogleOutbox, setRetryingGoogleOutbox] = useState(false);
  const {
    medicos: medicosOptions,
    profissionais,
    isClinica,
    loading: medicosLoading,
  } = useMedicosOptions();

  const hasProfissionalAgendas = useMemo(
    () => profissionais.some((p) => p.agenda_google_status === "connected"),
    [profissionais],
  );

  const displayEvents = useMemo(() => dedupeConsultations(events), [events]);

  const profFilterEntries = useMemo(
    () => buildProfissionalFilterEntries(medicosOptions, profissionais),
    [medicosOptions, profissionais],
  );
  const showProfFilter = profFilterEntries.length > 0;
  const showUnassignedFilter = useMemo(
    () => hasUnassignedProfissionalEvents(displayEvents, profissionais),
    [displayEvents, profissionais],
  );
  const profFilterStorageKey = userEmail
    ? agendaProfFilterStorageKey(userEmail)
    : "";
  const [visibleProfKeys, setVisibleProfKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [syncHealthFilter, setSyncHealthFilter] =
    useState<AgendaSyncHealthFilter>("todos");
  const [timeConflictEvent, setTimeConflictEvent] =
    useState<ConsultationEvent | null>(null);
  const [resolvingTimeConflict, setResolvingTimeConflict] = useState(false);

  useEffect(() => {
    if (!showProfFilter) return;
    const all = allProfFilterKeys(profFilterEntries, showUnassignedFilter);
    const saved = profFilterStorageKey
      ? loadVisibleProfKeys(profFilterStorageKey)
      : null;
    if (saved) {
      const sanitized = sanitizeVisibleKeys(saved, all);
      setVisibleProfKeys(sanitized.size > 0 ? sanitized : all);
    } else {
      setVisibleProfKeys(all);
    }
  }, [showProfFilter, profFilterEntries, showUnassignedFilter, profFilterStorageKey]);

  const handleVisibleProfChange = useCallback(
    (keys: Set<string>) => {
      setVisibleProfKeys(keys);
      if (profFilterStorageKey) saveVisibleProfKeys(profFilterStorageKey, keys);
    },
    [profFilterStorageKey],
  );

  const syncFilteredEvents = useMemo(
    () => filterEventsBySyncHealth(displayEvents, syncHealthFilter),
    [displayEvents, syncHealthFilter],
  );

  const calendarEvents = useMemo(() => {
    if (!showProfFilter) return syncFilteredEvents;
    return filterEventsByVisibleProfissionais(
      syncFilteredEvents,
      visibleProfKeys,
      profissionais,
    );
  }, [showProfFilter, syncFilteredEvents, visibleProfKeys, profissionais]);

  const canUseGoogleCalendar = isGoogleConnected || hasProfissionalAgendas;

  function resolveGoogleProfissionalId(medicoNome?: string): string | undefined {
    if (!medicoNome || !isClinica) return undefined;
    if (!profissionalHasAgendaConnected(profissionais, medicoNome)) return undefined;
    return profissionalIdByNome(profissionais, medicoNome);
  }

  /** ID da profissional pelo nome — mesmo sem status "connected" na UI (útil no delete). */
  function resolveProfissionalIdByNome(medicoNome?: string): string | undefined {
    if (!medicoNome || !isClinica) return undefined;
    return profissionalIdByNome(profissionais, medicoNome);
  }

  function bumpBackgroundSync(delta: number) {
    if (delta > 0) lastBackgroundSyncStartRef.current = Date.now();
    backgroundSyncCountRef.current = Math.max(
      0,
      backgroundSyncCountRef.current + delta,
    );
    setIsBackgroundSyncing(backgroundSyncCountRef.current > 0);
  }

  /**
   * Adia o pull do servidor só enquanto há sync em andamento — MAS com teto de
   * tempo. No mobile (PWA), um sync pode vazar o contador (fetch travado, aba em
   * background) e, sem esse teto, todo refresh ficava bloqueado e a agenda travava
   * no cache local. Passado o teto, tratamos o contador como preso e liberamos o
   * pull (a mescla preserva overrides pendentes em memória, então é seguro).
   */
  function shouldDeferServerPull(): boolean {
    if (backgroundSyncCountRef.current <= 0) return false;
    const elapsed = Date.now() - lastBackgroundSyncStartRef.current;
    if (elapsed > AGENDA_DEFER_PULL_MAX_MS) {
      backgroundSyncCountRef.current = 0;
      setIsBackgroundSyncing(false);
      return false;
    }
    return true;
  }

  const applyServerEventsToAgenda = useCallback(
    (
      serverEvents: ConsultationRecord[],
      opts?: { force?: boolean },
    ): ConsultasRevisionApplyResult => {
      if (!opts?.force && shouldDeferServerPull()) {
        return { applied: false, deferred: true };
      }

      const prev = eventsRef.current;
      const merged = dedupeConsultations(
        mergeAgendaPollWithLocal(prev, serverEvents),
      );

      if (consultationsListsEqual(prev, merged)) {
        setLastAgendaPullAt(new Date());
        setAgendaPullError(null);
        return { applied: true };
      }

      skipNextSave.current = true;
      setEvents(merged);
      saveConsultations(merged, { broadcast: false, ownerEmail: userEmail });
      skipNextSave.current = false;
      setLastAgendaPullAt(new Date());
      setAgendaPullError(null);
      return { applied: true };
    },
    [userEmail],
  );

  function replaceConsultaInState(
    previousId: string,
    updated: ConsultationEvent,
  ) {
    skipNextSave.current = true;
    setEvents((current) => {
      const next = dedupeConsultations(
        current.map((ev) =>
          String(ev.id) === String(previousId) ? updated : ev,
        ),
      );
      eventsRef.current = next;
      saveConsultations(next, { broadcast: false, ownerEmail: userEmail });
      return next;
    });
    skipNextSave.current = false;
  }

  function rescheduleConsultaInBackground(
    localEvent: ConsultationEvent,
    previousEvent: ConsultationEvent,
  ) {
    const start = parseEventDate(localEvent.start);
    const end = parseEventDate(localEvent.end);
    if (!start || !end) return;

    markConsultaPendingScheduleChange(localEvent);

    void backgroundSyncConsulta(
      localEvent,
      {
        patient: localEvent.patient || "Cliente",
        start,
        end,
        location: localEvent.location,
        medico: localEvent.medico,
      },
      { revertOnFailure: previousEvent, savingMessage: "Salvando horário..." },
    );
  }

  /** Supabase primeiro, Google depois (UI já atualizada). */
  function backgroundSyncConsulta(
    localEvent: ConsultationEvent,
    opts: {
      patient: string;
      start: Date;
      end: Date;
      location?: string;
      medico?: string;
      previousMedico?: string;
    },
    syncOptions?: {
      metadataOnly?: boolean;
      revertOnFailure?: ConsultationEvent;
      savingMessage?: string;
    },
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    bumpBackgroundSync(1);
    const savingMsg = syncOptions?.savingMessage ?? "Sincronizando agendamento...";
    setSyncMessage(savingMsg);
    setSyncStatus("loading");

    return (async () => {
      const localId = String(localEvent.id);
      const revertOnFailure = syncOptions?.revertOnFailure;

      function revertIfNeeded() {
        if (revertOnFailure) {
          clearConsultaPendingServerConfirmation(localEvent);
          replaceConsultaInState(localId, revertOnFailure);
        }
      }

      async function clearPendingIfServerConfirmed(
        ev: ConsultationEvent,
      ): Promise<void> {
        try {
          const serverEvents = await fetchAgendaViewFromServer();
          const serverEv = serverEvents.find(
            (s) => String(s.id) === String(ev.id),
          );
          if (serverEv && consultaServerConfirmsLocal(ev, serverEv)) {
            clearConsultaPendingServerConfirmation(ev);
          }
        } catch {
          /* poll confirmará depois */
        }
      }

      try {
        let workingEvent = localEvent;

        const profissionalChanged = medicoNomeChanged(
          opts.previousMedico,
          opts.medico,
        );

        if (
          !syncOptions?.metadataOnly &&
          !isPendingLocalConsulta(localEvent) &&
          !profissionalChanged
        ) {
          const patchResult = await patchConsultaTimeOnServer(localEvent);
          if (!patchResult.ok) {
            revertIfNeeded();
            setSyncMessage(patchResult.error);
            setSyncStatus("error");
            return { ok: false, error: patchResult.error };
          }
        }

        const supabaseResult = await syncConsultaToServerImmediately(localEvent);
        if (!supabaseResult.ok) {
          revertIfNeeded();
          const error = `Falha ao salvar: ${supabaseResult.error}`;
          setSyncMessage(error);
          setSyncStatus("error");
          return { ok: false, error };
        }

        if (supabaseResult.event) {
          workingEvent = supabaseResult.event;
          replaceConsultaInState(localId, workingEvent);
        }

        const {
          event: syncedEvent,
          error: googleError,
          recreated,
          transferred,
        } = await pushEventToGoogleCalendar(workingEvent, {
          ...opts,
          silent: true,
          metadataOnly: syncOptions?.metadataOnly,
        });

        if (googleError) {
          const msg = `Salvo no Turquesa. Google Calendar: ${googleError}`;
          setSyncMessage(msg);
          setSyncStatus("error");
          await clearPendingIfServerConfirmed(workingEvent);
          return { ok: true };
        }

        workingEvent = syncedEvent;
        const stateChanged =
          String(syncedEvent.id) !== String(localId) ||
          syncedEvent.googleEventId !== localEvent.googleEventId ||
          syncedEvent.googleProfissionalId !== localEvent.googleProfissionalId;
        if (stateChanged) {
          replaceConsultaInState(localId, syncedEvent);
        }

        if (
          syncedEvent.googleEventId !== supabaseResult.event?.googleEventId ||
          syncedEvent.googleProfissionalId !==
            supabaseResult.event?.googleProfissionalId
        ) {
          const googleSync = await syncConsultaToServerImmediately(syncedEvent);
          if (!googleSync.ok) {
            const error = `Google Calendar ok, mas falha ao salvar: ${googleSync.error}`;
            setSyncMessage(error);
            setSyncStatus("error");
            await clearPendingIfServerConfirmed(workingEvent);
            return { ok: true };
          }
          if (googleSync.event) {
            workingEvent = googleSync.event;
            replaceConsultaInState(String(workingEvent.id), googleSync.event);
          }
        }

        await clearPendingIfServerConfirmed(workingEvent);

        if (recreated || transferred) {
          setSyncMessage(
            transferred
              ? "Aviso: evento transferido no Google Calendar — verifique se não ficou duplicado."
              : "Aviso: evento recriado no Google Calendar — verifique se não ficou duplicado.",
          );
          setSyncStatus("success");
        } else {
          setSyncMessage((msg) =>
            msg === savingMsg ? null : msg,
          );
          setSyncStatus("idle");
        }
        void reloadClientesAgenda();
        return { ok: true };
      } catch (err) {
        revertIfNeeded();
        const error =
          err instanceof Error
            ? err.message
            : "Falha ao sincronizar agendamento.";
        setSyncMessage(error);
        setSyncStatus("error");
        return { ok: false, error };
      } finally {
        bumpBackgroundSync(-1);
      }
    })();
  }

  /** Cria ou atualiza evento no Google Calendar da profissional (ou titular). */
  async function pushEventToGoogleCalendar(
    event: ConsultationEvent,
    opts: {
      patient: string;
      start: Date;
      end: Date;
      location?: string;
      medico?: string;
      /** Profissional anterior (edição com troca de agenda Google). */
      previousMedico?: string;
      silent?: boolean;
      /** Republicar manual: sempre cria evento novo na agenda de destino. */
      forceCreate?: boolean;
      /** Só serviço/obs/cliente: PATCH em várias agendas, sem criar duplicata. */
      metadataOnly?: boolean;
    },
  ): Promise<{
    event: ConsultationEvent;
    error?: string;
    recreated?: boolean;
    transferred?: boolean;
  }> {
    if (!canUseGoogleCalendar) {
      return {
        event,
        error: "Conecte sua agenda Google ou peça às profissionais que autorizem pelo link de convite.",
      };
    }

    const profFromMedico = resolveGoogleProfissionalId(opts.medico || event.medico);
    const targetProfId = profFromMedico;
    const recoveredLink = recoverGoogleLinkFromEvents(event, eventsRef.current);
    const previousGoogleEventId = event.googleEventId
      ? String(event.googleEventId)
      : recoveredLink.googleEventId
        ? String(recoveredLink.googleEventId)
        : undefined;
    const previousGoogleProfId =
      event.googleProfissionalId ?? recoveredLink.googleProfissionalId;

    const serviceLabel = event.service || "Atendimento";
    const summary = `${serviceLabel} - ${opts.patient}`;
    const description = `Cliente: ${opts.patient}\nServiço: ${serviceLabel}\nProfissional: ${opts.medico || event.medico || ""}`.trim();
    const location = opts.location || event.location;

    function buildBody(extra?: { eventId?: string; profissionalId?: string }) {
      return {
        ...(extra?.eventId ? { eventId: extra.eventId } : {}),
        summary,
        description,
        start: opts.start.toISOString(),
        end: opts.end.toISOString(),
        location: location || undefined,
        clienteDriveId: event.clienteDriveId ?? undefined,
        nomeCliente: opts.patient,
        ...(extra?.profissionalId ? { profissionalId: extra.profissionalId } : {}),
      };
    }

    function applyUpdated(
      googleEventId: string,
      googleProfissionalId?: string,
    ): ConsultationEvent {
      return {
        ...event,
        googleEventId,
        googleProfissionalId,
      };
    }

    /** @deprecated use shouldTransferGoogleCalendar — mantido só para leitura legada */
    function profissionalGoogleTargetChanged(): boolean {
      return shouldTransferGoogleCalendar({
        previousGoogleProfId,
        targetProfId,
        previousMedicoProfId,
        previousMedico: opts.previousMedico ?? event.medico,
        nextMedico: opts.medico,
      });
    }

    async function transferGoogleEventToNewProfissional(): Promise<
      | { ok: true; event: ConsultationEvent; transferred: true }
      | { ok: false; error: string }
    > {
      const created = await postGoogleEvent(targetProfId);
      if (!created.ok) return { ok: false, error: created.error };

      const adopted = await adoptNewGoogleEventSafely(
        previousGoogleEventId!,
        created.id,
        targetProfId,
      );
      if (!adopted.ok) return { ok: false, error: adopted.error };
      return { ok: true, event: adopted.event, transferred: true };
    }

    function persistUpdated(updated: ConsultationEvent) {
      setEvents((current) =>
        current.map((ev) =>
          String(ev.id) === String(event.id) ? updated : ev,
        ),
      );
    }

    function notifySuccess(flags: { recreated?: boolean; transferred?: boolean }) {
      if (opts.silent) return;
      const msg = flags.transferred
        ? "Evento transferido para a agenda Google da nova profissional."
        : flags.recreated
          ? "Evento recriado no Google Calendar (o anterior não foi encontrado)."
          : "Agendamento sincronizado com o Google Calendar.";
      setSyncMessage(msg);
      setSyncStatus("success");
    }

    function notifyError(msg: string) {
      if (!opts.silent) {
        setSyncMessage(msg);
        setSyncStatus("error");
      }
      return { event, error: msg } as const;
    }

    async function deleteGoogleEventRobust(
      eventId: string,
      profIds: (string | undefined)[],
    ): Promise<boolean> {
      return deleteGoogleCalendarEventAcrossAgendas(eventId, profIds);
    }

    const previousMedicoProfId = opts.previousMedico
      ? resolveGoogleProfissionalId(opts.previousMedico)
      : undefined;
    const previousMedicoIdByNome = opts.previousMedico
      ? resolveProfissionalIdByNome(opts.previousMedico)
      : undefined;
    const connectedProfissionalIds = profissionais
      .filter((p) => p.agenda_google_status === "connected")
      .map((p) => p.id);

    function deleteCandidates(excludeOrLastProfId?: string): (string | undefined)[] {
      return buildPreviousEventDeleteCandidates({
        previousGoogleProfId,
        previousMedicoProfId,
        previousMedicoIdByNome,
        connectedProfissionalIds,
        excludeOrLastProfId,
      });
    }

    async function postGoogleEvent(
      profissionalId?: string,
    ): Promise<{ ok: true; id: string } | { ok: false; error: string; status: number }> {
      const res = await fetchWithTimeout("/api/google-calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody({ profissionalId })),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg =
          (err as { error?: string }).error ||
          "Não foi possível criar evento no Google Calendar.";
        return { ok: false, error: msg, status: res.status };
      }
      const data = (await res.json()) as { id?: string };
      if (!data.id) {
        return {
          ok: false,
          error: "Resposta do Google Calendar sem identificador do evento.",
          status: res.status,
        };
      }
      return { ok: true, id: data.id };
    }

    async function patchGoogleEvent(
      eventId: string,
      profissionalId?: string,
    ): Promise<{ ok: true; id: string } | { ok: false; error: string; status: number }> {
      const res = await fetchWithTimeout("/api/google-calendar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody({ eventId, profissionalId })),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg =
          (err as { error?: string }).error ||
          "Não foi possível atualizar evento no Google Calendar.";
        return { ok: false, error: msg, status: res.status };
      }
      const data = (await res.json()) as { id?: string };
      return { ok: true, id: data.id || eventId };
    }

    function isNotFoundOnGoogle(status: number, message: string): boolean {
      if (status === 404 || status === 410) return true;
      return /not found|não encontrado|404/i.test(message);
    }

    async function tryPatchExistingEvent(
      eventId: string,
    ): Promise<{ ok: true; id: string; profId?: string } | { ok: false }> {
      const resolved = await resolveGoogleCalendarEvent(eventId);
      if (!resolved.found) return { ok: false };
      const profId = resolved.profissionalId ?? undefined;
      try {
        const patched = await patchGoogleEvent(eventId, profId);
        if (patched.ok) return { ok: true, id: patched.id, profId };
      } catch {
        /* timeout / rede — tratado no catch externo */
      }
      return { ok: false };
    }

    async function adoptNewGoogleEventSafely(
      previousId: string,
      newId: string,
      profId?: string,
    ): Promise<{ ok: true; event: ConsultationEvent } | { ok: false; error: string }> {
      if (previousId === newId) {
        return { ok: true, event: applyUpdated(newId, profId) };
      }
      const deleted = await deleteGoogleEventRobust(
        previousId,
        deleteCandidates(profId),
      );
      if (!deleted) {
        // Compensa: sem órfão na agenda nova se a antiga não saiu.
        await deleteGoogleEventRobust(newId, [profId, undefined]);
        return {
          ok: false,
          error:
            "Não foi possível remover o evento da agenda Google da profissional anterior. Nada foi transferido — tente de novo.",
        };
      }
      return { ok: true, event: applyUpdated(newId, profId) };
    }

    function finishPatchSuccess(
      patchedId: string,
      profId?: string,
    ): { event: ConsultationEvent } {
      const updated = applyUpdated(patchedId, profId);
      persistUpdated(updated);
      notifySuccess({});
      return { event: updated };
    }

    try {
      if (!previousGoogleEventId) {
        // Edição só de serviço/obs sem vínculo Google: não criar evento novo (evita duplicata).
        if (opts.metadataOnly) {
          return {
            event,
            error:
              "Agendamento salvo no Turquesa. Sem vínculo Google para atualizar — use «Enviar ao Google» se precisar republicar.",
          };
        }
        const created = await postGoogleEvent(targetProfId);
        if (!created.ok) return notifyError(created.error);
        const updated = applyUpdated(created.id, targetProfId);
        persistUpdated(updated);
        notifySuccess({});
        return { event: updated };
      }

      // Republicar manual: PATCH se ainda existe; senão POST + remove antigo com confirmação.
      if (opts.forceCreate) {
        const existing = await tryPatchExistingEvent(previousGoogleEventId);
        if (existing.ok) {
          return finishPatchSuccess(existing.id, existing.profId);
        }

        const created = await postGoogleEvent(targetProfId);
        if (!created.ok) return notifyError(created.error);

        const adopted = await adoptNewGoogleEventSafely(
          previousGoogleEventId,
          created.id,
          targetProfId,
        );
        if (!adopted.ok) return notifyError(adopted.error);

        persistUpdated(adopted.event);
        notifySuccess({ recreated: true });
        return { event: adopted.event, recreated: true };
      }

      if (
        !opts.metadataOnly &&
        profissionalGoogleTargetChanged()
      ) {
        const transferred = await transferGoogleEventToNewProfissional();
        if (!transferred.ok) return notifyError(transferred.error);
        persistUpdated(transferred.event);
        notifySuccess({ transferred: true });
        return { event: transferred.event, transferred: true };
      }

      const patchCandidates = uniqueGooglePatchProfCandidates(
        previousGoogleProfId,
        previousMedicoProfId,
        targetProfId,
        undefined,
      );

      let lastPatchError = "";
      let lastPatchStatus = 0;
      for (const profId of patchCandidates) {
        let patched: Awaited<ReturnType<typeof patchGoogleEvent>>;
        try {
          patched = await patchGoogleEvent(previousGoogleEventId, profId);
        } catch (patchErr) {
          if (isFetchTimeoutError(patchErr)) {
            const recovered = await tryPatchExistingEvent(previousGoogleEventId);
            if (recovered.ok) {
              return finishPatchSuccess(recovered.id, recovered.profId);
            }
          }
          throw patchErr;
        }
        if (patched.ok) {
          return finishPatchSuccess(patched.id, profId);
        }
        lastPatchError = patched.error;
        lastPatchStatus = patched.status;
        if (!isNotFoundOnGoogle(patched.status, patched.error)) {
          const recovered = await tryPatchExistingEvent(previousGoogleEventId);
          if (recovered.ok) {
            return finishPatchSuccess(recovered.id, recovered.profId);
          }
          return notifyError(patched.error);
        }
      }

      if (opts.metadataOnly) {
        const msg =
          "Agendamento salvo no Turquesa. Não foi possível atualizar o Google Calendar" +
          (lastPatchError ? ` (${lastPatchError})` : "") +
          " — use «Enviar ao Google» no modal se precisar republicar.";
        if (opts.silent) {
          setSyncMessage(msg);
          setSyncStatus("error");
        }
        return { event, error: msg };
      }

      if (!isNotFoundOnGoogle(lastPatchStatus, lastPatchError)) {
        const recovered = await tryPatchExistingEvent(previousGoogleEventId);
        if (recovered.ok) {
          return finishPatchSuccess(recovered.id, recovered.profId);
        }
        return notifyError(lastPatchError);
      }

      const resolvedBeforeCreate = await tryPatchExistingEvent(previousGoogleEventId);
      if (resolvedBeforeCreate.ok) {
        return finishPatchSuccess(resolvedBeforeCreate.id, resolvedBeforeCreate.profId);
      }

      const created = await postGoogleEvent(targetProfId);
      if (!created.ok) return notifyError(created.error);

      const adopted = await adoptNewGoogleEventSafely(
        previousGoogleEventId,
        created.id,
        targetProfId,
      );
      if (!adopted.ok) return notifyError(adopted.error);

      persistUpdated(adopted.event);
      notifySuccess({ recreated: true });
      return { event: adopted.event, recreated: true };
    } catch (err) {
      if (previousGoogleEventId && isFetchTimeoutError(err)) {
        const recovered = await tryPatchExistingEvent(previousGoogleEventId);
        if (recovered.ok) {
          return finishPatchSuccess(recovered.id, recovered.profId);
        }
      }
      console.warn("Erro ao sincronizar com Google Calendar:", err);
      const msg = isFetchTimeoutError(err)
        ? "Google Calendar demorou demais. O agendamento foi salvo; tente enviar ao Google depois."
        : err instanceof Error
          ? err.message
          : "Falha ao sincronizar com o Google Calendar.";
      return notifyError(msg);
    }
  }

  async function handleManualPushToGoogle(
    event: ConsultationEvent,
    snapshot: AgendaGooglePushSnapshot,
  ) {
    setGooglePushMessage(null);
    setGooglePushIsError(false);

    if (!canUseGoogleCalendar) {
      setGooglePushMessage(
        "Conecte sua agenda Google ou peça às profissionais que autorizem pelo link de convite.",
      );
      setGooglePushIsError(true);
      return;
    }

    const start = new Date(`${snapshot.data}T${snapshot.horaInicio}`);
    const end = new Date(`${snapshot.data}T${snapshot.horaFim}`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      setGooglePushMessage("Horário inválido — ajuste início e fim antes de enviar ao Google.");
      setGooglePushIsError(true);
      return;
    }

    const medicoNome = snapshot.medico.trim() || undefined;
    const eventForPush: ConsultationEvent = {
      ...event,
      patient: snapshot.patient.trim() || event.patient,
      service: snapshot.service.trim() || event.service,
      location: snapshot.location.trim() || event.location,
      medico: medicoNome,
      observacoes: snapshot.observacoes.trim() || event.observacoes,
      start: start.toISOString(),
      end: end.toISOString(),
    };

    const eventId = String(event.id);
    setPushingEventId(eventId);

    try {
      const pushOpts = {
        patient: eventForPush.patient ?? "Cliente",
        start,
        end,
        location: eventForPush.location,
        medico: medicoNome,
        silent: true as const,
      };

      let pushResult = await pushEventToGoogleCalendar(eventForPush, pushOpts);

      if (pushResult.error && eventForPush.googleEventId) {
        const located = await resolveGoogleCalendarEvent(
          String(eventForPush.googleEventId),
        );
        if (!located.found) {
          pushResult = await pushEventToGoogleCalendar(eventForPush, {
            ...pushOpts,
            forceCreate: true,
          });
        }
      }

      const { event: synced, error, recreated, transferred } = pushResult;

      if (error) {
        setGooglePushMessage(error);
        setGooglePushIsError(true);
        return;
      }

      if (!synced.googleEventId) {
        setGooglePushMessage("Não foi possível enviar ao Google Calendar.");
        setGooglePushIsError(true);
        return;
      }

      const syncResult = await syncConsultaToServerImmediately(synced);
      if (!syncResult.ok) {
        setGooglePushMessage(
          `Enviado ao Google Calendar, mas falha ao salvar no sistema: ${syncResult.error}`,
        );
        setGooglePushIsError(true);
        setAgendaModal((prev) =>
          prev?.editing && String(prev.editing.id) === eventId
            ? { ...prev, editing: synced }
            : prev,
        );
        return;
      }

      setGooglePushMessage(
        transferred
          ? "Evento transferido para a agenda Google da profissional selecionada."
          : recreated || event.googleEventId
            ? "Sessão enviada ao Google Calendar com os dados do formulário."
            : "Sessão enviada ao Google Calendar.",
      );
      setGooglePushIsError(false);

      setAgendaModal((prev) =>
        prev?.editing && String(prev.editing.id) === eventId
          ? { ...prev, editing: synced }
          : prev,
      );
    } finally {
      setPushingEventId(null);
    }
  }

  const [clientesAgenda, setClientesAgenda] = useState<PacienteOpcao[]>([]);
  const [initialClienteId, setInitialClienteId] = useState<string | null>(null);
  const searchParams = useSearchParams();

  // Perfil / endereço do salão ou estúdio
  const [profile, setProfile] = useState<PerfilAgendaFields | null>(() =>
    userEmail ? readPerfilCacheStale(userEmail) : null,
  );
  const [profileLoading, setProfileLoading] = useState(
    () => !(userEmail && readPerfilCacheStale(userEmail)),
  );
  const [profileError, setProfileError] = useState(false);

  useEffect(() => {
    if (!userEmail) return;

    const cached = readClientesListCache(userEmail);
    if (cached?.length) {
      setClientesAgenda(clientesApiToOpcoes(cached));
    }

    void fetchClientesListAll(userEmail).then((clientes) => {
      if (clientes.length) {
        setClientesAgenda(clientesApiToOpcoes(clientes));
      }
    });
  }, [userEmail]);

  useEffect(() => {
    void fetch("/api/config/agenda")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        const raw = data.duracao_padrao_minutos;
        if (raw === null || raw === undefined || raw === "") {
          setDuracaoPadraoMin(null);
          return;
        }
        const n = Number(raw);
        setDuracaoPadraoMin(Number.isFinite(n) ? n : null);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (searchParams.get("agendar") !== "1") return;
    const clienteId = searchParams.get("clienteId");
    if (clienteId && !clienteId.startsWith("g:")) setInitialClienteId(clienteId);
    const start = new Date();
    start.setSeconds(0, 0);
    const m = start.getMinutes();
    if (m > 0 && m <= 30) start.setMinutes(30);
    else if (m > 30) {
      start.setHours(start.getHours() + 1);
      start.setMinutes(0);
    }
    const end = new Date(start);
    const slotMins = duracaoPadraoMin ?? 30;
    end.setMinutes(end.getMinutes() + slotMins);
    setAgendaModal({ start, end, editing: null });
    window.history.replaceState({}, "", "/agenda");
  }, [searchParams, duracaoPadraoMin]);

  // Buscar perfil do usuário para exibir endereço (cache + revalidação)
  useEffect(() => {
    if (!userEmail) return;

    const cached = readPerfilCacheStale(userEmail);
    if (cached) {
      setProfile(cached);
      setProfileLoading(false);
    }

    void fetchPerfilAgenda(userEmail).then((p) => {
      if (p) {
        setProfile(p);
        setProfileError(false);
      } else if (!cached) {
        setProfileError(true);
      }
      setProfileLoading(false);
    });
  }, [userEmail]);

  /** Monta endereço formatado a partir dos campos estruturados do perfil */
  const enderecoFormatado = useMemo(() => {
    if (!profile) return "";
    const partes: string[] = [];
    if (profile.street) {
      let rua = profile.street;
      if (profile.address_number) rua += `, ${profile.address_number}`;
      partes.push(rua);
    }
    if (profile.complement) partes.push(profile.complement);
    if (profile.neighborhood) partes.push(profile.neighborhood);
    const cidadeEstado: string[] = [];
    if (profile.city) cidadeEstado.push(profile.city);
    if (profile.state) cidadeEstado.push(profile.state);
    if (cidadeEstado.length > 0) partes.push(cidadeEstado.join("/"));
    if (profile.cep) partes.push(`CEP: ${profile.cep}`);
    // Fallback para o campo address antigo
    if (partes.length === 0 && profile.address) partes.push(profile.address);
    return partes.join(", ");
  }, [profile]);

  /** Gera link do Google Maps para o endereço */
  const googleMapsLink = useMemo(() => {
    const addr = enderecoFormatado;
    if (!addr) return "";
    return `https://www.google.com/maps/search/${encodeURIComponent(addr)}`;
  }, [enderecoFormatado]);

  /** Nome do profissional/clínica para exibir */
  const nomeProfissional = useMemo(() => {
    if (!profile) return "";
    return profile.clinic_name || profile.full_name || "";
  }, [profile]);

  /** Especialidade do profissional */
  const especialidade = useMemo(() => {
    if (!profile) return "";
    return profile.specialty || "";
  }, [profile]);

  // Conectar Google Calendar via autorização incremental
  function handleConnectCalendar() {
    setIsAuthorizing(true);
    const redirect = encodeURIComponent(window.location.pathname);
    window.location.href = `/api/auth/google-authorize?scope=calendar&redirect=${redirect}`;
  }

  // Verificar se autorização foi concluída (via URL param)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('google_connected') === 'calendar') {
      setIsGoogleConnected(true);
      // Limpar param da URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, []);

  // Verificar conexão com Google Calendar (adiado — não bloqueia render inicial)
  useEffect(() => {
    if (isGoogleConnected) {
      setGoogleCheckDone(true);
      return;
    }

    const cancelDefer = deferNonCriticalWork(() => {
      void (async () => {
        try {
          const res = await fetch("/api/google-calendar?maxResults=1");
          if (res.ok) {
            setIsGoogleConnected(true);
            return;
          }
          const allRes = await fetch(
            "/api/google-calendar?allConnected=true&maxResults=1",
          );
          if (allRes.ok) setIsGoogleConnected(true);
        } catch {
          /* silencioso */
        } finally {
          setGoogleCheckDone(true);
        }
      })();
    });

    return cancelDefer;
  }, [isGoogleConnected]);


  useEffect(() => {
    setConsultationsStorageOwner(userEmail);
  }, [userEmail]);

  useEffect(() => {
    let cancelled = false;

    const cancelDefer = deferNonCriticalWork(() => {
      void (async () => {
        try {
          await backfillObservacoesToServerIfNeeded();
          const merged = dedupeConsultations(await loadAgendaViewFromServer(userEmail));
          if (!cancelled) {
            skipNextSave.current = true;
            setEvents(merged);
            saveConsultations(merged, { broadcast: false, ownerEmail: userEmail });
            skipNextSave.current = false;
            setLastAgendaPullAt(new Date());
            setAgendaPullError(null);
            setServerPullDone(true);
          }
        } catch (err) {
          if (!cancelled) {
            setAgendaPullError(formatAgendaPullError(err));
          }
        } finally {
          if (!cancelled) {
            skipNextSave.current = false;
            setServerPullDone(true);
          }
        }
      })();
    });

    const handler = () => {
      if (savingFromSelf.current) return;
      /* Fase 1: localStorage é write-only na leitura da grade; revision poll atualiza do servidor. */
    };

    window.addEventListener("medsupapp-consultations-updated", handler);
    return () => {
      cancelled = true;
      cancelDefer();
      window.removeEventListener("medsupapp-consultations-updated", handler);
    };
  }, [userEmail]);

  /** Atualiza lista de clientes (força revalidação). */
  const reloadClientesAgenda = useCallback(async () => {
    if (!userEmail) return;
    try {
      const clientes = await fetchClientesListAll(userEmail, { force: true });
      if (clientes.length) setClientesAgenda(clientesApiToOpcoes(clientes));
    } catch {
      /* ignore */
    }
  }, [userEmail]);

  useEffect(() => {
    if (skipNextSave.current) return;
    savingFromSelf.current = true;
    const deduped = dedupeConsultations(events);
    if (deduped.length !== events.length) {
      skipNextSave.current = true;
      setEvents(deduped);
      skipNextSave.current = false;
      savingFromSelf.current = false;
      return;
    }
    saveConsultations(deduped, { ownerEmail: userEmail });
    scheduleSyncConsultasToServer(deduped);
    savingFromSelf.current = false;
  }, [events]);

  const handleSlotSelect = useCallback((start: Date, end: Date) => {
    setAgendaModal({ start, end, editing: null });
  }, []);

  const handleCalendarEventClick = useCallback((ev: ConsultationEvent) => {
    const startDate = parseEventDate(ev.start) ?? new Date();
    const endDate =
      parseEventDate(ev.end) ??
      (() => {
        const f = new Date(startDate);
        f.setMinutes(f.getMinutes() + (duracaoPadraoMin ?? 30));
        return f;
      })();
    setAgendaModal({ start: startDate, end: endDate, editing: ev });
  }, [duracaoPadraoMin]);

  const handleCalendarEventsChange = useCallback(
    (nextFromCalendar: ConsultationEvent[]) => {
      const merged = showProfFilter
        ? dedupeConsultations(
            events.map((item) => {
              const updated = nextFromCalendar.find(
                (ev) => String(ev.id) === String(item.id),
              );
              return updated ?? item;
            }),
          )
        : dedupeConsultations(nextFromCalendar);

      const pendingReschedules: {
        ev: ConsultationEvent;
        old: ConsultationEvent;
      }[] = [];

      for (const ev of merged) {
        const old = events.find((e) => String(e.id) === String(ev.id));
        if (!old) continue;
        const oldStart = parseEventDate(old.start)?.getTime();
        const oldEnd = parseEventDate(old.end)?.getTime();
        const newStart = parseEventDate(ev.start)?.getTime();
        const newEnd = parseEventDate(ev.end)?.getTime();
        if (oldStart === newStart && oldEnd === newEnd) continue;
        const start = parseEventDate(ev.start);
        const end = parseEventDate(ev.end);
        if (!start || !end) continue;
        pendingReschedules.push({ ev, old });
      }

      eventsRef.current = merged;
      setEvents(merged);

      for (const { ev, old } of pendingReschedules) {
        rescheduleConsultaInBackground(ev, old);
      }
    },
    [events, showProfFilter],
  );

  const handleResolveTimeConflict = useCallback(
    async (keep: "google" | "turquesa") => {
      if (!timeConflictEvent) return;
      setResolvingTimeConflict(true);
      const ev = timeConflictEvent;
      const turquesaStart = String(ev.start);
      const turquesaEnd = ev.end ? String(ev.end) : null;

      const result = await resolveConsultaTimeConflictOnServer({
        id: String(ev.id),
        keep,
        googleInicio: ev.conflictGoogleInicio ?? turquesaStart,
        googleFim: ev.conflictGoogleFim ?? turquesaEnd,
        turquesaInicio: turquesaStart,
        turquesaFim: turquesaEnd,
      });

      if (!result.ok) {
        window.alert(result.error);
        setResolvingTimeConflict(false);
        return;
      }

      const nextEvents = events.map((item) =>
        String(item.id) === String(ev.id)
          ? {
              ...item,
              start: result.inicio,
              end: result.fim ?? item.end,
              syncHealth: undefined,
              conflictGoogleInicio: undefined,
              conflictGoogleFim: undefined,
            }
          : item,
      );
      skipNextSave.current = true;
      setEvents(nextEvents);
      saveConsultations(nextEvents, { broadcast: false, ownerEmail: userEmail });
      skipNextSave.current = false;
      setTimeConflictEvent(pickTimeConflictEvent(nextEvents));
      setResolvingTimeConflict(false);
      setSyncMessage(
        keep === "google"
          ? "Horário do Google mantido."
          : "Horário do Turquesa mantido e enviado ao Google.",
      );
      setSyncStatus("success");
    },
    [timeConflictEvent, events, userEmail],
  );

  useEffect(() => {
    if (timeConflictEvent) return;
    const conflict = pickTimeConflictEvent(events);
    if (conflict) setTimeConflictEvent(conflict);
  }, [events, timeConflictEvent]);

  async function confirmAgendaConsulta(payload: AgendaConsultaPayload): Promise<string | void> {
    const prev = payload.editingId
      ? events.find((e) => String(e.id) === String(payload.editingId))
      : null;

    const medicoNome = payload.medico || undefined;
    const medicoProfId = medicoNome
      ? profissionalIdByNome(profissionais, medicoNome)
      : undefined;
    const googleProfId = medicoNome
      ? resolveGoogleProfissionalId(medicoNome)
      : undefined;

    const localEvent: ConsultationEvent = {
      ...createConsultationEvent({
        id: payload.editingId ?? undefined,
        patient: payload.patient,
        service: payload.service,
        value: payload.value,
        start: payload.start,
        end: payload.end,
        location: payload.location || enderecoFormatado || undefined,
        telefone: payload.telefone || undefined,
        lembretesWhatsapp: payload.lembretesWhatsapp,
        medico: medicoNome,
        medicoProfissionalId: medicoProfId,
        convenio: undefined,
        observacoes: payload.observacoes || undefined,
        isDraft: false,
        clienteDriveId: payload.clienteDriveId ?? null,
      }),
      ...(prev
        ? {
            googleEventId: prev.googleEventId,
            googleProfissionalId: prev.googleProfissionalId,
            medicoProfissionalId: medicoProfId,
            status: prev.status,
            payment: prev.payment,
            tipoConsulta: prev.tipoConsulta,
          }
        : {
            medicoProfissionalId: medicoProfId,
            googleProfissionalId: googleProfId,
          }),
    };

    if (!prev) {
      trackImmediateConsultaSync(String(localEvent.id));
    } else if (!isMetadataOnlyAgendaEdit(prev, payload)) {
      markConsultaPendingScheduleChange(localEvent);
    } else {
      markConsultaPendingMetadata(localEvent);
    }

    const merged = dedupeConsultations(
      payload.editingId
        ? [localEvent, ...events.filter((e) => String(e.id) !== String(payload.editingId))]
        : [localEvent, ...events],
    );
    eventsRef.current = merged;
    skipNextSave.current = true;
    setEvents(merged);
    skipNextSave.current = false;

    const syncResult = await backgroundSyncConsulta(
      localEvent,
      {
        patient: payload.patient,
        start: payload.start,
        end: payload.end,
        location: payload.location,
        medico: payload.medico || localEvent.medico,
        previousMedico: prev?.medico,
      },
      {
        metadataOnly: isMetadataOnlyAgendaEdit(prev, payload),
        revertOnFailure: prev ?? undefined,
      },
    );

    if (!syncResult.ok) {
      throw new Error(syncResult.error);
    }

    if (!payload.editingId) {
      return String(localEvent.id);
    }

    setAgendaModal(null);
  }

  const applyRefreshAgendaLight = useCallback(async () => {
    if (!userEmail) return;

    setRefreshingServer(true);
    setSyncStatus("loading");
    setSyncMessage(null);
    setAgendaPullError(null);

    try {
      const serverEvents = await fetchAgendaViewFromServer();
      const prev = eventsRef.current;
      const merged = dedupeConsultations(
        mergeAgendaPollWithLocal(prev, serverEvents),
      );

      skipNextSave.current = true;
      setEvents(merged);
      saveConsultations(merged, { broadcast: false, ownerEmail: userEmail });
      skipNextSave.current = false;
      setLastAgendaPullAt(new Date());

      const conflict = pickTimeConflictEvent(merged);
      if (conflict) setTimeConflictEvent(conflict);

      if (consultationsListsEqual(prev, merged)) {
        setSyncMessage("Agenda já está atualizada.");
      } else {
        setSyncMessage("Agenda atualizada.");
      }
      setSyncStatus("success");
    } catch (err: unknown) {
      const msg = formatAgendaPullError(err);
      setAgendaPullError(msg);
      setSyncMessage(msg);
      setSyncStatus("error");
    } finally {
      setRefreshingServer(false);
    }
  }, [userEmail]);

  const googlePullInFlightRef = useRef(false);
  const lastGooglePullAtRef = useRef(0);

  const applyAgendaGooglePull = useCallback(async (opts?: { quiet?: boolean }) => {
    if (!userEmail) return;
    const quiet = opts?.quiet === true;

    if (!quiet) {
      setIsSyncing(true);
      setSyncStatus("loading");
      setSyncMessage(null);
    }

    try {
      const pendingDrafts = eventsRef.current.filter(isPendingLocalConsulta);
      const { events: serverEvents, meta } = await syncAgendaGooglePullFromServer();
      lastGooglePullAtRef.current = Date.now();
      const merged = dedupeConsultations(
        mergeAgendaSyncFullWithPendingDrafts(pendingDrafts, serverEvents),
      );

      skipNextSave.current = true;
      setEvents(merged);
      saveConsultations(merged, { broadcast: false, ownerEmail: userEmail });
      skipNextSave.current = false;

      const conflict = pickTimeConflictEvent(merged);
      if (conflict) setTimeConflictEvent(conflict);

      invalidatePacientesOpcoesClientCache();
      await reloadClientesAgenda();

      if (quiet) {
        if (meta.googleImported > 0) {
          setSyncMessage(
            `Agenda atualizada com o Google (${meta.googleImported} evento(s)).`,
          );
          setSyncStatus("success");
        } else if (meta.googlePullErrors.length > 0) {
          setSyncMessage(
            `Google: ${meta.googlePullErrors.slice(0, 2).join(" · ")}`,
          );
          setSyncStatus("error");
        }
        return;
      }

      const parts: string[] = ["Google importado."];
      if (meta.googleImported > 0) {
        parts.push(`${meta.googleImported} evento(s) do Google.`);
      }
      if (meta.googlePullErrors.length > 0) {
        parts.push(
          `Avisos: ${meta.googlePullErrors.slice(0, 2).join(" · ")}`,
        );
      }

      setSyncMessage(parts.join(" "));
      setSyncStatus(
        meta.googlePullErrors.length > 0 && meta.googleImported === 0
          ? "error"
          : "success",
      );
    } catch (err: unknown) {
      if (quiet) {
        console.warn("[agenda] google pull silencioso:", err);
        return;
      }
      setSyncMessage(
        formatAgendaFetchError(err, SYNC_GOOGLE_PULL_TIMEOUT_MS),
      );
      setSyncStatus("error");
    } finally {
      if (!quiet) setIsSyncing(false);
    }
  }, [userEmail, reloadClientesAgenda]);

  const runQuietGooglePullIfDue = useCallback(
    async (force?: boolean) => {
      if (!userEmail || !canUseGoogleCalendar) return;
      if (document.visibilityState !== "visible") return;
      if (googlePullInFlightRef.current || isSyncing) return;
      if (shouldDeferServerPull()) return;
      const now = Date.now();
      if (
        !force &&
        now - lastGooglePullAtRef.current < AGENDA_GOOGLE_PULL_MIN_GAP_MS
      ) {
        return;
      }

      googlePullInFlightRef.current = true;
      lastGooglePullAtRef.current = now;
      try {
        await applyAgendaGooglePull({ quiet: true });
      } finally {
        googlePullInFlightRef.current = false;
      }
    },
    [userEmail, canUseGoogleCalendar, isSyncing, applyAgendaGooglePull],
  );

  const applyAgendaSyncFull = useCallback(async () => {
    if (!userEmail) return;

    setIsSyncing(true);
    setRefreshingServer(true);
    setSyncStatus("loading");
    setSyncMessage(null);

    try {
      const pendingDrafts = events.filter(isPendingLocalConsulta);
      const { events: serverEvents, meta } = await syncAgendaFullFromServer();
      lastGooglePullAtRef.current = Date.now();
      const merged = dedupeConsultations(
        mergeAgendaSyncFullWithPendingDrafts(pendingDrafts, serverEvents),
      );

      skipNextSave.current = true;
      setEvents(merged);
      saveConsultations(merged, { broadcast: false, ownerEmail: userEmail });
      skipNextSave.current = false;

      const conflict = pickTimeConflictEvent(merged);
      if (conflict) setTimeConflictEvent(conflict);

      invalidatePacientesOpcoesClientCache();
      await reloadClientesAgenda();

      const parts: string[] = ["Agenda sincronizada."];
      if (meta.googleImported > 0) {
        parts.push(`${meta.googleImported} importado(s) do Google.`);
      }
      if (meta.googlePushed > 0) {
        parts.push(`${meta.googlePushed} enviado(s) ao Google.`);
      }
      if (meta.repaired.deleted > 0) {
        parts.push(`${meta.repaired.deleted} duplicata(s) removida(s).`);
      }
      if (meta.googlePushErrors.length > 0) {
        parts.push(
          `Avisos push: ${meta.googlePushErrors.slice(0, 2).join(" · ")}`,
        );
      }
      if (meta.googlePullErrors.length > 0) {
        parts.push(
          `Avisos importação: ${meta.googlePullErrors.slice(0, 2).join(" · ")}`,
        );
      }

      const hasWarnings =
        meta.googlePushErrors.length > 0 || meta.googlePullErrors.length > 0;
      setSyncMessage(parts.join(" "));
      setSyncStatus(
        hasWarnings && meta.googleImported === 0 && meta.googlePushed === 0
          ? "error"
          : "success",
      );
    } catch (err: unknown) {
      if (isFetchTimeoutError(err)) {
        try {
          const pendingDrafts = events.filter(isPendingLocalConsulta);
          const { events: serverEvents, meta } = await syncAgendaGooglePullFromServer();
          const merged = dedupeConsultations(
            mergeAgendaSyncFullWithPendingDrafts(pendingDrafts, serverEvents),
          );

          skipNextSave.current = true;
          setEvents(merged);
          saveConsultations(merged, { broadcast: false, ownerEmail: userEmail });
          skipNextSave.current = false;

          const conflict = pickTimeConflictEvent(merged);
          if (conflict) setTimeConflictEvent(conflict);

          invalidatePacientesOpcoesClientCache();
          await reloadClientesAgenda();

          const parts: string[] = [
            "Sync completo demorou; importamos o que estava no Google.",
          ];
          if (meta.googleImported > 0) {
            parts.push(`${meta.googleImported} importado(s) do Google.`);
          }
          if (meta.googlePullErrors.length > 0) {
            parts.push(
              `Avisos importação: ${meta.googlePullErrors.slice(0, 2).join(" · ")}`,
            );
          }

          setSyncMessage(parts.join(" "));
          setSyncStatus(
            meta.googlePullErrors.length > 0 && meta.googleImported === 0
              ? "error"
              : "success",
          );
          return;
        } catch {
          /* fallback falhou */
        }
      }

      setSyncMessage(formatAgendaFetchError(err, SYNC_FULL_TIMEOUT_MS));
      setSyncStatus("error");
    } finally {
      setIsSyncing(false);
      setRefreshingServer(false);
    }
  }, [userEmail, events, reloadClientesAgenda]);

  async function handleGoogleSync() {
    if (!canUseGoogleCalendar) {
      setSyncMessage(
        "Conecte sua agenda Google ou peça às profissionais que autorizem pelo link de convite.",
      );
      setSyncStatus("error");
      return;
    }
    if (isMobileAgendaClient()) {
      await applyAgendaGooglePull();
    } else {
      await applyAgendaSyncFull();
    }
  }

  const refreshAgendaData = useCallback(async () => {
    await applyRefreshAgendaLight();
  }, [applyRefreshAgendaLight]);
  // Atribui nome da profissional em eventos Google importados antes da equipe carregar
  useEffect(() => {
    if (!profissionais.length) return;
    setEvents((current) => {
      let changed = false;
      const next = current.map((ev) => {
        if (!ev.googleProfissionalId || ev.medico) return ev;
        const nome = profissionais.find((p) => p.id === ev.googleProfissionalId)?.nome;
        if (!nome) return ev;
        changed = true;
        return {
          ...ev,
          medico: nome,
          medicoProfissionalId: ev.medicoProfissionalId ?? ev.googleProfissionalId,
        };
      });
      return changed ? next : current;
    });
  }, [profissionais]);

  const sessoesPendentes = useMemo(
    () =>
      displayEvents
        .filter(consultaPodeFinalizar)
        .sort((a, b) => {
          const da = parseEventDate(a.start)?.getTime() ?? 0;
          const db = parseEventDate(b.start)?.getTime() ?? 0;
          return da - db;
        })
        .slice(0, 6),
    [displayEvents],
  );

  const googleEventsCount = useMemo(
    () => events.filter((e) => e.googleEventId).length,
    [events],
  );

  const connectedLabel = canUseGoogleCalendar
    ? hasProfissionalAgendas && !isGoogleConnected
      ? "Equipe conectada"
      : "Conectado"
    : "Não conectado";

  const lastVisibilityRefreshRef = useRef(0);
  const lastHiddenAtRef = useRef<number | null>(null);
  const visibilityDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const softRefreshSeqRef = useRef(0);

  const softRefreshOnVisible = useCallback(async () => {
    if (!userEmail) return;
    const now = Date.now();
    const hiddenAt = lastHiddenAtRef.current;
    const backgroundMs = hiddenAt != null ? now - hiddenAt : AGENDA_BACKGROUND_REFRESH_MS;
    const mobile = isMobileAgendaClient();
    if (
      !mobile &&
      backgroundMs < AGENDA_BACKGROUND_REFRESH_MS &&
      now - lastVisibilityRefreshRef.current < AGENDA_VISIBILITY_COOLDOWN_MS
    ) {
      return;
    }

    const seq = ++softRefreshSeqRef.current;
    try {
      const serverEvents = await fetchAgendaViewFromServer();
      if (seq !== softRefreshSeqRef.current) return;
      applyServerEventsToAgenda(serverEvents);
      lastVisibilityRefreshRef.current = Date.now();
      lastHiddenAtRef.current = null;

      // Aba voltou após um tempo: atualiza também as agendas Google (novos / X vermelho).
      if (
        canUseGoogleCalendar &&
        backgroundMs >= AGENDA_GOOGLE_PULL_ON_FOCUS_AFTER_MS
      ) {
        void runQuietGooglePullIfDue(true);
      }
    } catch (err) {
      if (seq !== softRefreshSeqRef.current) return;
      const msg = formatAgendaPullError(err);
      setAgendaPullError(msg);
    }
  }, [
    userEmail,
    applyServerEventsToAgenda,
    canUseGoogleCalendar,
    runQuietGooglePullIfDue,
  ]);

  useEffect(() => {
    if (!serverPullDone) return;

    const onHidden = () => {
      if (document.visibilityState === 'hidden') {
        lastHiddenAtRef.current = Date.now();
      }
    };

    const scheduleSoftRefresh = () => {
      if (document.visibilityState !== "visible") return;
      if (isMobileAgendaClient()) {
        void softRefreshOnVisible();
        return;
      }
      if (visibilityDebounceRef.current) clearTimeout(visibilityDebounceRef.current);
      visibilityDebounceRef.current = setTimeout(() => {
        visibilityDebounceRef.current = null;
        void softRefreshOnVisible();
      }, AGENDA_VISIBILITY_DEBOUNCE_MS);
    };

    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) scheduleSoftRefresh();
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key?.includes('consultations')) scheduleSoftRefresh();
    };

    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener("focus", scheduleSoftRefresh);
    document.addEventListener("visibilitychange", scheduleSoftRefresh);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('storage', onStorage);
    return () => {
      if (visibilityDebounceRef.current) clearTimeout(visibilityDebounceRef.current);
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener("focus", scheduleSoftRefresh);
      document.removeEventListener("visibilitychange", scheduleSoftRefresh);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('storage', onStorage);
    };
  }, [serverPullDone, softRefreshOnVisible]);

  useEffect(() => {
    if (!serverPullDone || !userEmail) return;
    const mobile = isMobileAgendaClient();
    return startConsultasRevisionPolling({
      ownerEmail: userEmail,
      intervalMs: mobile ? 15_000 : 25_000,
      onApply: ({ serverEvents }) => applyServerEventsToAgenda(serverEvents),
      onError: (err) => setAgendaPullError(formatAgendaPullError(err)),
    });
  }, [serverPullDone, userEmail, applyServerEventsToAgenda]);

  /** Retry contínuo do outbox Google: no load + a cada 25s enquanto a aba está visível. */
  useEffect(() => {
    if (!serverPullDone || !userEmail) return;
    triggerGoogleOutboxProcessing(0);
    const id = window.setInterval(() => triggerGoogleOutboxProcessing(), 25_000);
    return () => window.clearInterval(id);
  }, [serverPullDone, userEmail]);

  const hasGoogleOutboxError = useMemo(
    () => events.some((ev) => ev.googleOutbox === "error"),
    [events],
  );

  const handleRetryGoogleOutbox = useCallback(async () => {
    setRetryingGoogleOutbox(true);
    try {
      await retryGoogleOutboxOnServer();
      const serverEvents = await fetchAgendaViewFromServer();
      applyServerEventsToAgenda(serverEvents);
    } catch (err) {
      setAgendaPullError(formatAgendaPullError(err));
    } finally {
      setRetryingGoogleOutbox(false);
    }
  }, [applyServerEventsToAgenda]);

  useEffect(() => {
    if (!serverPullDone || !userEmail) return;

    const pullWhileOpen = () => {
      if (document.visibilityState !== 'visible') return;
      void (async () => {
        try {
          const serverEvents = await fetchAgendaViewFromServer();
          applyServerEventsToAgenda(serverEvents);
        } catch (err) {
          setAgendaPullError(formatAgendaPullError(err));
        }
      })();
    };

    const intervalMs = isMobileAgendaClient()
      ? AGENDA_MOBILE_PULL_INTERVAL_MS
      : 60_000;
    const id = window.setInterval(pullWhileOpen, intervalMs);
    return () => window.clearInterval(id);
  }, [serverPullDone, userEmail, applyServerEventsToAgenda]);

  /** A cada 5 min: importa Google (incluindo eventos só no Calendar / X vermelho). */
  useEffect(() => {
    if (!serverPullDone || !userEmail || !canUseGoogleCalendar) return;

    const tick = () => {
      void runQuietGooglePullIfDue(false);
    };

    // Primeiro pull após 45s (deixa a grade montar / não disputa o load inicial).
    const warmup = window.setTimeout(tick, 45_000);
    const id = window.setInterval(tick, AGENDA_GOOGLE_PULL_INTERVAL_MS);
    return () => {
      window.clearTimeout(warmup);
      window.clearInterval(id);
    };
  }, [
    serverPullDone,
    userEmail,
    canUseGoogleCalendar,
    runQuietGooglePullIfDue,
  ]);

  /** Só cria evento local + sync — formulário isolado em AgendaNovaSessaoForm. */
  async function handleNovaSessaoSubmit(data: AgendaNovaSessaoSubmitData) {
    const medicoNome = data.medicoNome;
    const medicoProfId = medicoNome
      ? profissionalIdByNome(profissionais, medicoNome)
      : undefined;
    const googleProfId = medicoNome
      ? resolveGoogleProfissionalId(medicoNome)
      : undefined;

    const localEvent: ConsultationEvent = {
      ...createConsultationEvent({
        patient: data.patientName,
        service: data.service,
        value: 0,
        start: data.start,
        end: data.end,
        location: data.location || enderecoFormatado || undefined,
        telefone: data.telefone || undefined,
        lembretesWhatsapp: data.lembretesWhatsapp,
        medico: medicoNome || undefined,
        medicoProfissionalId: medicoProfId,
        observacoes: data.observacoes || undefined,
        clienteDriveId: data.clienteDriveId,
        isDraft: false,
      }),
      googleProfissionalId: googleProfId,
    };

    trackImmediateConsultaSync(String(localEvent.id));
    setEvents((current) => dedupeConsultations([localEvent, ...current]));

    await backgroundSyncConsulta(localEvent, {
      patient: data.patientName,
      start: data.start,
      end: data.end,
      location: data.location || enderecoFormatado || undefined,
      medico: medicoNome,
    });
  }

  async function handleDeleteAgendaModal() {
    if (!agendaModal?.editing) return;
    const ok = await confirm({
      title: "Excluir agendamento",
      message: "Excluir este agendamento da agenda?",
      confirmLabel: "Excluir",
      variant: "danger",
    });
    if (!ok) return;
    setDeletingAgendaModal(true);
    try {
      // Otimista: fecha modal na hora; rede/Google não bloqueiam a UI.
      const removed = await handleRemoveConsultation(agendaModal.editing);
      if (!removed) return;
      toast.success("Agendamento excluído.");
      setAgendaModal(null);
      setInitialClienteId(null);
    } finally {
      setDeletingAgendaModal(false);
    }
  }

  /**
   * Remover consulta de forma otimista:
   * 1) tira da UI / localStorage
   * 2) Supabase + Google em background (com timeout)
   * Assim "Excluindo..." nunca fica preso em API lenta.
   */
  async function handleRemoveConsultation(event: ConsultationEvent): Promise<boolean> {
    const plan = planConsultaRemoval(event, events);
    const idSet = new Set(plan.idsToDelete);
    const previousEvents = events;

    const next = dedupeConsultations(
      events.filter((item) => !idSet.has(String(item.id))),
    );
    skipNextSave.current = true;
    setEvents(next);
    saveConsultations(next, { broadcast: false, ownerEmail: userEmail });
    skipNextSave.current = false;

    void (async () => {
      const delResult = await deleteConsultasFromServer({
        ids: plan.idsToDelete,
        googleEventIds: plan.googleEventId ? [plan.googleEventId] : undefined,
        tombstoneGoogleEventIds: plan.tombstoneGoogleEventId
          ? [plan.tombstoneGoogleEventId]
          : undefined,
      });
      if (!delResult.ok) {
        skipNextSave.current = true;
        setEvents(previousEvents);
        saveConsultations(previousEvents, {
          broadcast: false,
          ownerEmail: userEmail,
        });
        skipNextSave.current = false;
        toast.error(
          delResult.error?.trim() ||
            "Não foi possível excluir o agendamento. Ele foi restaurado na agenda.",
        );
        return;
      }

      if (plan.googleEventId && canUseGoogleCalendar) {
        try {
          const qs = new URLSearchParams({ eventId: plan.googleEventId });
          if (plan.googleProfissionalId) {
            qs.set("profissionalId", plan.googleProfissionalId);
          }
          const googleRes = await fetchWithTimeout(
            `/api/google-calendar?${qs}`,
            { method: "DELETE" },
            20_000,
          );
          if (
            !googleRes.ok &&
            googleRes.status !== 404 &&
            googleRes.status !== 410
          ) {
            console.warn(
              "Google Calendar: exclusão incompleta",
              googleRes.status,
            );
          }
        } catch (err) {
          console.warn("Erro ao remover evento do Google Calendar:", err);
        }
      }
    })();

    return true;
  }

  async function handleFinalizarConsulta(payload: {
    valorPago: number;
    valorOriginal: number;
    formaPagamento: FormaPagamentoConsulta;
    descontoPercent: number;
    descontoValor: number;
    parcelas: number;
    tipoConsulta: "nova_consulta";
    medico: string;
    percentualProfissional: number;
    observacoes: string;
    catalogoItens: AtendimentoItemLinha[];
  }) {
    if (!finalizando?.id) return;
    setSavingFinalizar(true);

    const formaLabel =
      FORMAS_PAGAMENTO_CONSULTA.find((f) => f.id === payload.formaPagamento)?.label ??
      payload.formaPagamento;
    const tipoLabel = "Atendimento";
    const paciente = finalizando.patient ?? "Cliente";

    const updated = applyFinalizarConsulta(events, finalizando.id, payload);
    const finalizedEvent = updated.find(
      (e) => String(e.id) === String(finalizando.id),
    );
    setEvents(updated);
    setFinalizando(null);

    const dataConsulta = parseEventDate(finalizando.start);
    const dataFinanceiro = dataConsulta
      ? format(dataConsulta, "yyyy-MM-dd")
      : format(new Date(), "yyyy-MM-dd");
    const horaConsulta = dataConsulta ? format(dataConsulta, "HH:mm") : null;

    if (finalizedEvent) {
      void syncConsultaToServerImmediately(finalizedEvent);
    }

    try {
      const itensResumo = formatItensResumo(payload.catalogoItens);
      const descParts = [
        tipoLabel,
        itensResumo || null,
        paciente,
        formaLabel,
        payload.parcelas > 1 ? `${payload.parcelas}x` : null,
      ].filter(Boolean);
      const financeiroObs = formatObservacaoAtendimento(
        payload.observacoes,
        payload.catalogoItens,
      );
      const pagamentoObs = `Pagamento: ${formaLabel}${payload.parcelas > 1 ? ` (${payload.parcelas}x)` : ""}`;

      const financeiroRes = await postFinanceiroEntradaFromAgenda({
        descricao: descParts.join(" - "),
        data: dataFinanceiro,
        valor: payload.valorPago,
        medico: payload.medico,
        forma_pagamento: payload.formaPagamento,
        parcelas: payload.parcelas,
        percentual_profissional: payload.percentualProfissional,
        observacao: [financeiroObs, pagamentoObs].filter(Boolean).join(" · "),
        catalogo_itens: payload.catalogoItens.filter((i) => i.catalogoId),
      });
      if (financeiroRes.ok) {
        if (userEmail) invalidateFinanceiroCache(userEmail);
      } else {
        window.alert(`${MSG_FINANCEIRO_FALHOU}\n\n${financeiroRes.error}`);
      }
    } catch {
      window.alert(MSG_FINANCEIRO_FALHOU);
    }

    const clienteDriveId =
      finalizedEvent?.clienteDriveId ?? finalizando.clienteDriveId ?? null;
    if (clienteDriveId) {
      const clienteRes = await postFinalizarClienteFromAgenda(clienteDriveId, {
        data: dataFinanceiro,
        hora: horaConsulta,
        valor: payload.valorOriginal,
        valorOriginal: payload.valorOriginal,
        descontoPercent: payload.descontoPercent,
        descontoValor: payload.descontoValor,
        forma_pagamento: payload.formaPagamento,
        medico: payload.medico,
        parcelas: payload.parcelas,
        observacoes: payload.observacoes || null,
        catalogo_itens: payload.catalogoItens,
      });
      if (!clienteRes.ok) {
        window.alert(`${MSG_FINALIZAR_CLIENTE_FALHOU}\n\n${clienteRes.error}`);
      }
    } else {
      window.alert(MSG_FINALIZAR_SEM_CLIENTE_DRIVE);
    }

    setSavingFinalizar(false);
  }

  const overlayOpen = !!agendaModal || !!finalizando;

  return (
    <AgendaPageGate
      userEmail={userEmail}
      medicosLoading={medicosLoading}
      profissionais={profissionais}
      isClinica={isClinica}
    >
    <main className="min-h-screen bg-[#f8f9fa] pb-20 md:pb-12">
      {/* Esconde calendário/lista no mobile enquanto modal está aberto */}
      <div
        className={`mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-8 lg:px-8 min-w-0 ${
          overlayOpen ? "pointer-events-none select-none" : ""
        }`}
      >
        {/* Cabeçalho */}
        <div className="mb-4 sm:mb-8 rounded-2xl sm:rounded-4xl border border-slate-200 bg-white p-4 sm:p-8 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="inline-flex rounded-full bg-[#D9F0F2] px-3 py-1 text-xs sm:text-sm font-semibold uppercase tracking-wide text-[#047482]">
                Agenda
              </p>
              <h1 className="mt-3 max-w-3xl text-2xl font-semibold tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">
                Sua agenda profissional conectada ao Google.
              </h1>
              <p className="mt-3 max-w-2xl text-sm sm:text-lg leading-relaxed text-slate-600 break-words">
                <span className="block sm:inline">
                  <span className="font-semibold text-slate-900">{userEmail}</span>
                </span>
                <span className="hidden sm:inline"> · </span>
                <span className="block sm:inline mt-1 sm:mt-0">
                  Google Calendar:{" "}
                  <span
                    className={`font-semibold ${
                      isGoogleConnected ? "text-[#047482]" : "text-slate-400"
                    }`}
                  >
                    {connectedLabel}
                  </span>
                </span>
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:gap-3 sm:items-end shrink-0">
              <Link
                href="/dashboard"
                className="inline-flex rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Dashboard
              </Link>
              <span className="inline-flex rounded-2xl bg-[var(--brand-primary)] px-5 py-3 text-sm font-semibold text-white shadow-sm">
                {googleEventsCount} no Google · {displayEvents.length} total
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,380px)_1fr] min-w-0">
          {/* Calendário primeiro no celular — content-visibility alivia scroll/paint no mobile */}
          <section className="order-1 xl:order-2 min-w-0 [content-visibility:auto] [contain-intrinsic-size:auto_28rem]">
            <div className="mb-3 sm:mb-4 px-0.5 flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-xl sm:text-2xl font-semibold text-slate-950">Grade da agenda</h2>
                <p className="mt-1 text-xs sm:text-sm text-slate-600">
                  Toque em um horário para agendar · no celular use a vista &quot;Dia&quot;
                </p>
                {isBackgroundSyncing && (
                  <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-slate-500">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Sincronizando...
                  </p>
                )}
                {lastAgendaPullAt && !agendaPullError && (
                  <p className="mt-1 text-xs text-slate-400">
                    Última atualização:{" "}
                    {format(lastAgendaPullAt, "dd/MM HH:mm")}
                  </p>
                )}
                {agendaPullError && !syncMessage && (
                  <p className="mt-1 text-xs text-red-600">
                    Falha ao atualizar: {agendaPullError}
                  </p>
                )}
                {hasGoogleOutboxError && (
                  <p className="mt-1 flex items-center gap-2 text-xs text-red-600">
                    <span>Alguma sessão não sincronizou com o Google.</span>
                    <button
                      type="button"
                      onClick={handleRetryGoogleOutbox}
                      disabled={retryingGoogleOutbox}
                      className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
                    >
                      {retryingGoogleOutbox ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : null}
                      Reenviar ao Google
                    </button>
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <button
                  type="button"
                  data-tour="agenda-atualizar"
                  onClick={() => void applyRefreshAgendaLight()}
                  disabled={refreshingServer || isSyncing || !serverPullDone}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 touch-manipulation"
                >
                  {refreshingServer && !isSyncing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : null}
                  Atualizar
                </button>
                {canUseGoogleCalendar ? (
                  <button
                    type="button"
                    data-tour="agenda-sincronizar"
                    onClick={() => void handleGoogleSync()}
                    disabled={refreshingServer || isSyncing || !serverPullDone}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#047482]/30 bg-white px-3 py-2 text-xs font-semibold text-[#047482] shadow-sm transition hover:bg-[#eef4f5] disabled:opacity-50 touch-manipulation"
                  >
                    {isSyncing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : null}
                    Sincronizar com Google
                  </button>
                ) : null}
              </div>
            </div>
            {syncMessage && (
              <p
                className={`mb-3 rounded-xl px-3 py-2.5 text-sm ${
                  syncStatus === "error"
                    ? "bg-red-50 text-red-700 border border-red-200"
                    : syncStatus === "success"
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : "bg-slate-50 text-slate-700 border border-slate-200"
                }`}
              >
                {syncMessage}
              </p>
            )}
            <div
              className="mb-3 flex flex-wrap gap-2"
              role="group"
              aria-label="Filtrar por vínculo Turquesa e Google"
            >
              {SYNC_HEALTH_FILTER_CHIPS.map((chip) => {
                const active = syncHealthFilter === chip.id;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setSyncHealthFilter(chip.id)}
                    aria-pressed={active}
                    className={`rounded-full border px-3 py-2 text-xs font-semibold touch-manipulation min-h-[36px] transition ${
                      active
                        ? "border-[#047482] bg-[#D9F0F2] text-[#047482]"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
            {canUseGoogleCalendar && !isSyncing && googleEventsCount === 0 && (
              <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 md:hidden">
                Nenhum evento do Google na grade — use Atualizar ou Sincronizar com Google.
              </p>
            )}
            <AgendaCalendar
              events={calendarEvents}
              onEventsChange={handleCalendarEventsChange}
              onSlotSelect={handleSlotSelect}
              onEventClick={handleCalendarEventClick}
              profissionais={profissionais}
              titularNome={nomeProfissional}
              defaultSlotMinutes={duracaoPadraoMin}
            />
          </section>

          {/* Formulários e cards — abaixo do calendário no mobile */}
          <aside className="order-2 xl:order-1 space-y-4 min-w-0">
            {showProfFilter && (
              <AgendaProfissionalFilter
                entries={profFilterEntries.map((entry) => {
                  const isTitular =
                    nomeProfissional &&
                    entry.nome.trim().toLowerCase() ===
                      nomeProfissional.trim().toLowerCase();
                  if (!isTitular || entry.googleAgendaConnected) return entry;
                  return {
                    ...entry,
                    googleAgendaConnected: isGoogleConnected,
                  };
                })}
                visibleKeys={visibleProfKeys}
                onChange={handleVisibleProfChange}
                showUnassigned={showUnassignedFilter}
                accent="turquesa"
              />
            )}
            <AgendaNovaSessaoForm
              clientesIniciais={clientesAgenda}
              medicosOptions={medicosOptions}
              isClinica={isClinica}
              duracaoPadraoMin={duracaoPadraoMin}
              defaultLocation={enderecoFormatado}
              isGoogleConnected={isGoogleConnected}
              onReloadClientes={reloadClientesAgenda}
              onSubmitSession={handleNovaSessaoSubmit}
            />

            {/* Card endereço do salão / estúdio */}
            <div className="rounded-2xl sm:rounded-4xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-[#047482]">
                    {profileLoading ? "Carregando..." : "Salão / Studio"}
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    {profileLoading
                      ? "Buscando endereço..."
                      : profileError
                        ? "Endereço não configurado."
                        : "Endereço profissional cadastrado."}
                  </p>
                </div>
                <Building2 className="h-6 w-6 text-slate-400" />
              </div>

              {profileLoading ? (
                <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando dados do perfil...
                </div>
              ) : profile && enderecoFormatado ? (
                <div className="mt-4 space-y-3">
                  {nomeProfissional && (
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{nomeProfissional}</p>
                      {especialidade && (
                        <p className="text-xs text-slate-500">{especialidade}</p>
                      )}
                    </div>
                  )}
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <p className="text-sm text-slate-700">{enderecoFormatado}</p>
                  </div>
                  <a
                    href={googleMapsLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-2xl bg-[#D9F0F2] px-4 py-2 text-xs font-semibold text-[#035e6b] transition hover:bg-[#eef4f5]"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Abrir no Google Maps
                  </a>
                </div>
              ) : (
                <div className="mt-4">
                  <Link
                    href="/dashboard/perfil"
                    className="inline-flex items-center gap-1.5 rounded-2xl bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
                  >
                    Configurar endereço
                  </Link>
                </div>
              )}
            </div>

            {/* Card Google Calendar */}
            <div className="rounded-2xl sm:rounded-4xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-[#047482]">
                    Google Calendar
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    {canUseGoogleCalendar
                      ? hasProfissionalAgendas && !isGoogleConnected
                        ? "Agendas da equipe conectadas. «Atualizar» puxa o Turquesa; «Sincronizar com Google» importa e envia pendências."
                        : "«Atualizar» mostra mudanças do sistema em segundos. «Sincronizar com Google» alinha com o Calendar."
                      : "Conecte sua agenda ou envie o convite às profissionais em Configurações → Equipe."}
                  </p>
                </div>
                <span
                  className={`self-start shrink-0 rounded-full px-3 py-1 text-[10px] sm:text-xs font-semibold uppercase tracking-wide ${
                    canUseGoogleCalendar
                      ? "bg-[#eef4f5] text-[#047482]"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {connectedLabel}
                </span>
              </div>

              <button
                type="button"
                onClick={
                  canUseGoogleCalendar
                    ? handleGoogleSync
                    : handleConnectCalendar
                }
                disabled={isSyncing || isAuthorizing}
                className="mt-4 sm:mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#4285F4] px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-[#3367d6] disabled:cursor-not-allowed disabled:opacity-60 touch-manipulation"
              >
                {isSyncing || isAuthorizing ? (
                  <>
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    {isSyncing ? "Sincronizando..." : "Redirecionando..."}
                  </>
                ) : canUseGoogleCalendar ? (
                  <>
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#fff" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Sincronizar com Google
                  </>
                ) : (
                  "Conectar Google Calendar"
                )}
              </button>

              {canUseGoogleCalendar && !isGoogleConnected && (
                <button
                  type="button"
                  onClick={handleConnectCalendar}
                  disabled={isAuthorizing}
                  className="mt-3 inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 touch-manipulation"
                >
                  {isAuthorizing ? "Redirecionando..." : "Conectar minha agenda Google"}
                </button>
              )}

              {syncMessage && (
                <p
                  className={`mt-4 rounded-xl p-3 text-sm ${
                    syncStatus === "error"
                      ? "bg-red-50 text-red-600"
                      : syncStatus === "success"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-50 text-slate-600"
                  }`}
                >
                  {syncMessage}
                </p>
              )}

              {canUseGoogleCalendar && (
                <div className="mt-4 rounded-2xl bg-[#eef4f5] p-4">
                  <p className="text-xs font-medium text-[#047482]">
                    🔔 Lembretes automáticos
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-[#3795a1]">
                    <li>• 7 dias antes do evento</li>
                    <li>• 1 dia antes do evento</li>
                    <li>• 1 hora antes do evento</li>
                  </ul>
                </div>
              )}
            </div>

            {/* Sessões pendentes de finalização */}
            <div className="rounded-2xl sm:rounded-4xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-[#047482]">
                    Sessões pendentes
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    Toque no calendário ou finalize aqui com serviços, produtos e pagamento.
                  </p>
                </div>
                <span className="self-start shrink-0 rounded-full bg-[#eef4f5] px-3 py-1 text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-[#047482]">
                  {sessoesPendentes.length} pendente
                  {sessoesPendentes.length !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="mt-6 space-y-3 max-h-[400px] overflow-y-auto">
                {sessoesPendentes.length === 0 ? (
                  <p className="text-sm text-slate-400">
                    Nenhuma sessão aguardando finalização. Agende na grade ou em Nova sessão.
                  </p>
                ) : (
                  sessoesPendentes.map((item) => {
                    const st = statusConsultaBadge(item.status);

                    return (
                      <div
                        key={String(item.id)}
                        className="rounded-2xl border border-slate-200 bg-white p-4 hover:border-[#3795a1]/40 transition"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-[#047482] tabular-nums">
                              {formatHorario(item)}
                            </p>
                            <p className="truncate text-sm font-semibold text-slate-950 mt-0.5">
                              {item.patient ?? "Cliente"}
                            </p>
                            <p className="truncate text-xs text-slate-500 mt-0.5">
                              {item.service || "Atendimento"}
                              {item.medico ? ` · ${item.medico}` : ""}
                            </p>
                            {st && (
                              <span
                                className={`inline-block mt-2 text-[10px] font-semibold px-2 py-0.5 rounded-full ${st.color}`}
                              >
                                {st.label}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            disabled={savingFinalizar}
                            onClick={() => setFinalizando(item)}
                            className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-[#047482] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#035e6b] disabled:opacity-50 touch-manipulation"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Finalizar
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>

      {agendaModal && (
        <AgendaConsultaModal
          open
          slotStart={agendaModal.start}
          slotEnd={agendaModal.end}
          editingEvent={agendaModal.editing}
          isClinica={isClinica}
          medicos={medicosOptions}
          profissionais={profissionais}
          titularNome={nomeProfissional}
          defaultLocation={enderecoFormatado}
          duracaoPadraoMin={duracaoPadraoMin}
          clientesIniciais={clientesAgenda}
          initialClienteId={initialClienteId}
          onClose={() => {
            setAgendaModal(null);
            setInitialClienteId(null);
            setGooglePushMessage(null);
            setGooglePushIsError(false);
          }}
          onConfirm={confirmAgendaConsulta}
          onDelete={
            agendaModal.editing
              ? () => void handleDeleteAgendaModal()
              : undefined
          }
          onFinalizar={
            agendaModal.editing && consultaPodeFinalizar(agendaModal.editing)
              ? () => {
                  const ev = agendaModal.editing!;
                  setAgendaModal(null);
                  setInitialClienteId(null);
                  setFinalizando(ev);
                }
              : undefined
          }
          deleting={deletingAgendaModal}
          onClienteSaved={async () => {
            invalidatePacientesOpcoesClientCache();
            await reloadClientesAgenda();
          }}
          onClienteMerged={async (primaryId, secondaryId) => {
            invalidatePacientesOpcoesClientCache();
            await reloadClientesAgenda();

            const editing = agendaModal?.editing;
            const linkedId = editing?.clienteDriveId ?? null;
            if (editing && linkedId && secondaryId && linkedId === secondaryId) {
              setAgendaModal((prev) =>
                prev?.editing
                  ? {
                      ...prev,
                      editing: { ...prev.editing, clienteDriveId: primaryId },
                    }
                  : prev,
              );
              const editingId = editing.id;
              setEvents((current) =>
                current.map((ev) =>
                  String(ev.id) === String(editingId)
                    ? { ...ev, clienteDriveId: primaryId }
                    : ev,
                ),
              );
            }
          }}
          canPushToGoogle={canUseGoogleCalendar && !!agendaModal.editing}
          onPushToGoogle={
            agendaModal.editing
              ? (snapshot) => handleManualPushToGoogle(agendaModal.editing!, snapshot)
              : undefined
          }
          pushingToGoogle={
            agendaModal.editing
              ? pushingEventId === String(agendaModal.editing.id)
              : false
          }
          googlePushMessage={googlePushMessage}
          googlePushIsError={googlePushIsError}
        />
      )}

      {finalizando && (
        <FinalizarConsultaModal
          consulta={finalizando}
          medicos={medicosOptions}
          isClinica={isClinica}
          saving={savingFinalizar}
          onClose={() => setFinalizando(null)}
          onConfirm={handleFinalizarConsulta}
        />
      )}

      {timeConflictEvent && (
        <AgendaTimeConflictModal
          event={timeConflictEvent}
          resolving={resolvingTimeConflict}
          onResolve={handleResolveTimeConflict}
          onDismiss={() => setTimeConflictEvent(null)}
        />
      )}
    </main>
    </AgendaPageGate>
  );
}
