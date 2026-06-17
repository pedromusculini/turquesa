"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import type { FormEvent } from "react";
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
} from "@/components/AgendaConsultaModal";
import { invalidatePacientesOpcoesClientCache } from "@/lib/pacientesOpcoesClient";
import { clientesApiToOpcoes } from "@/lib/pacienteOpcoesUi";
import type { PacienteOpcao } from "@/lib/types";
import PacienteSearchField from "@/components/PacienteSearchField";
import { aplicarMascaraWhatsapp } from "@/lib/constants";
import { ensurePacienteCliente } from "@/lib/ensurePacienteClienteClient";
import { isValidPhone } from "@/lib/phoneMatch";
import MedicoSelect from "@/components/MedicoSelect";
import { useMedicosOptions } from "@/lib/useMedicosOptions";
import {
  profissionalHasAgendaConnected,
  profissionalIdByNome,
  resolveMedicoValue,
  validateMedicoSelection,
} from "@/lib/loadMedicosOptions";
import {
  type ConsultationRecord,
  type FormaPagamentoConsulta,
  loadConsultations,
  saveConsultations,
  applyFinalizarConsulta,
  FORMAS_PAGAMENTO_CONSULTA,
  STATUS_CONSULTA_UI,
  parseEventDate,
  formatHorario,
  createConsultationEvent,
  datetimeLocalMaisMinutos,
  shiftEndPreservingDuration,
  toDatetimeLocalValue,
  agendaWindowTimeMin,
  agendaWindowTimeMax,
} from "@/lib/consultations";
import {
  loadAndMergeConsultasFromServer,
  scheduleSyncConsultasToServer,
  syncAllConsultasToServer,
  syncConsultaToServerImmediately,
  deleteConsultasFromServer,
  dedupeConsultations,
  mergeGoogleCalendarEvents,
  findDuplicatePartner,
  consultationRichness,
} from "@/lib/syncConsultasClient";
import { syncAgendaAuthoritative } from "@/lib/syncAllModulesClient";
import { googleCalendarItemToConsultation } from "@/lib/googleCalendarEventParse";
import { useLegacyServicoCatalog } from "@/lib/useLegacyServicoCatalog";
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
import {
  formatItensResumo,
  formatObservacaoAtendimento,
  type AtendimentoItemLinha,
} from "@/lib/atendimentoItens";

type ConsultationEvent = ConsultationRecord;

const AGENDA_DEFER_MS = 1500;

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
  const { catalog: legacyCatalog } = useLegacyServicoCatalog(userEmail);
  const [events, setEvents] = useState<ConsultationEvent[]>([]);
  const [duracaoPadraoMin, setDuracaoPadraoMin] = useState<number | null>(null);
  const [patient, setPatient] = useState("");
  const [service, setService] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [location, setLocation] = useState("");
  const [observacoes, setObservacoes] = useState("");

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
  const didAutoGoogleSync = useRef(false);
  const googleSyncAfterProfissionais = useRef(false);
  const [serverPullDone, setServerPullDone] = useState(false);
  const [refreshingServer, setRefreshingServer] = useState(false);
  const [googleCheckDone, setGoogleCheckDone] = useState(false);
  const [agendaModal, setAgendaModal] = useState<{
    start: Date;
    end: Date;
    editing: ConsultationEvent | null;
  } | null>(null);
  const [deletingAgendaModal, setDeletingAgendaModal] = useState(false);
  const backgroundSyncCountRef = useRef(0);
  const [isBackgroundSyncing, setIsBackgroundSyncing] = useState(false);
  const [formPacienteSel, setFormPacienteSel] = useState("");
  const [formTelefone, setFormTelefone] = useState("");
  const [formLembretes, setFormLembretes] = useState(true);
  const [formErro, setFormErro] = useState<string | null>(null);
  const [formMedico, setFormMedico] = useState("");
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

  const canUseGoogleCalendar = isGoogleConnected || hasProfissionalAgendas;

  function resolveGoogleProfissionalId(medicoNome?: string): string | undefined {
    if (!medicoNome || !isClinica) return undefined;
    if (!profissionalHasAgendaConnected(profissionais, medicoNome)) return undefined;
    return profissionalIdByNome(profissionais, medicoNome);
  }

  function bumpBackgroundSync(delta: number) {
    backgroundSyncCountRef.current = Math.max(
      0,
      backgroundSyncCountRef.current + delta,
    );
    setIsBackgroundSyncing(backgroundSyncCountRef.current > 0);
  }

  /** Supabase + Google em background (UI já atualizada). */
  function backgroundSyncConsulta(
    localEvent: ConsultationEvent,
    opts: {
      patient: string;
      start: Date;
      end: Date;
      location?: string;
      medico?: string;
    },
  ) {
    bumpBackgroundSync(1);
    setSyncMessage("Sincronizando agendamento...");
    setSyncStatus("loading");

    void (async () => {
      try {
        const supabaseInitial = syncConsultaToServerImmediately(localEvent);
        const googleSync = pushEventToGoogleCalendar(localEvent, {
          ...opts,
          silent: true,
        });
        const [, syncedEvent] = await Promise.all([supabaseInitial, googleSync]);

        if (
          syncedEvent.googleEventId &&
          syncedEvent.googleEventId !== localEvent.googleEventId
        ) {
          await syncConsultaToServerImmediately(syncedEvent);
        }

        setSyncMessage((msg) =>
          msg === "Sincronizando agendamento..." ? null : msg,
        );
        setSyncStatus((st) => (st === "loading" ? "idle" : st));
        void reloadClientesAgenda();
      } catch (err) {
        setSyncMessage(
          err instanceof Error
            ? err.message
            : "Falha ao sincronizar agendamento.",
        );
        setSyncStatus("error");
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
      silent?: boolean;
    },
  ): Promise<ConsultationEvent> {
    if (!canUseGoogleCalendar) return event;

    const profId = resolveGoogleProfissionalId(opts.medico || event.medico);
    const summary = `${event.service || "Atendimento"} - ${opts.patient}`;
    const description = `Cliente: ${opts.patient}\nServiço: ${event.service || "Atendimento"}\nProfissional: ${opts.medico || event.medico || ""}`.trim();

    try {
      const method = event.googleEventId ? "PATCH" : "POST";
      const res = await fetch("/api/google-calendar", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(event.googleEventId
            ? { eventId: event.googleEventId }
            : {}),
          summary,
          description,
          start: opts.start.toISOString(),
          end: opts.end.toISOString(),
          clienteDriveId: event.clienteDriveId ?? undefined,
          nomeCliente: opts.patient,
          ...(profId ? { profissionalId: profId } : {}),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg =
          (err as { error?: string }).error ||
          "Não foi possível sincronizar com o Google Calendar.";
        setSyncMessage(msg);
        setSyncStatus("error");
        return event;
      }

      const googleEvent = (await res.json()) as { id?: string };
      const googleEventId = googleEvent.id || event.googleEventId;
      if (!googleEventId) return event;

      const updated: ConsultationEvent = {
        ...event,
        googleEventId,
        googleProfissionalId: profId ?? event.googleProfissionalId,
      };

      setEvents((current) =>
        current.map((ev) =>
          String(ev.id) === String(event.id) ? updated : ev,
        ),
      );
      if (!opts.silent) {
        setSyncMessage("Agendamento sincronizado com o Google Calendar.");
        setSyncStatus("success");
      }
      return updated;
    } catch (err) {
      console.warn("Erro ao sincronizar com Google Calendar:", err);
      setSyncMessage(
        err instanceof Error
          ? err.message
          : "Falha ao sincronizar com o Google Calendar.",
      );
      setSyncStatus("error");
      return event;
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

  useEffect(() => {
    if (medicosOptions.length === 1 && !formMedico) {
      setFormMedico(medicosOptions[0]);
    }
  }, [medicosOptions, formMedico]);

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


  // Inicializar datas padrão (amanhã 08:00; fim só com duração padrão configurada)
  useEffect(() => {
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);
    amanha.setHours(8, 0, 0, 0);
    setStart(toDatetimeLocalValue(amanha));
    if (duracaoPadraoMin) {
      const fim = new Date(amanha);
      fim.setMinutes(fim.getMinutes() + duracaoPadraoMin);
      setEnd(toDatetimeLocalValue(fim));
    } else {
      setEnd("");
    }
  }, [duracaoPadraoMin]);

  useEffect(() => {
    let cancelled = false;

    const local = loadConsultations();
    setEvents(local);

    const cancelDefer = deferNonCriticalWork(() => {
      void (async () => {
        try {
          const merged = await loadAndMergeConsultasFromServer(local);
          if (!cancelled) {
            skipNextSave.current = true;
            setEvents(merged);
            saveConsultations(merged, { broadcast: false });
            skipNextSave.current = false;
            scheduleSyncConsultasToServer(merged);
          }
        } catch {
          /* best-effort */
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
      const next = loadConsultations();
      setEvents((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
        return next;
      });
    };

    window.addEventListener("medsupapp-consultations-updated", handler);
    return () => {
      cancelled = true;
      cancelDefer();
      window.removeEventListener("medsupapp-consultations-updated", handler);
    };
  }, []);

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

  const pullFromServer = useCallback(async () => {
    setRefreshingServer(true);
    try {
      if (!userEmail) return;
      const { events: merged } = await syncAgendaAuthoritative(userEmail);
      skipNextSave.current = true;
      setEvents(merged);
      saveConsultations(merged, { broadcast: false });
      skipNextSave.current = false;
      await reloadClientesAgenda();
    } catch {
      /* best-effort */
    } finally {
      setRefreshingServer(false);
    }
  }, [userEmail, reloadClientesAgenda]);

  useEffect(() => {
    if (skipNextSave.current) return;
    savingFromSelf.current = true;
    saveConsultations(events);
    scheduleSyncConsultasToServer(events);
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
    (nextEvents: ConsultationEvent[]) => {
      const merged = dedupeConsultations(nextEvents);
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
        backgroundSyncConsulta(ev, {
          patient: ev.patient ?? "Cliente",
          start,
          end,
          location: ev.location,
          medico: ev.medico,
        });
      }
      setEvents(merged);
    },
    [events],
  );

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
            googleProfissionalId: googleProfId ?? prev.googleProfissionalId,
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

    setEvents((current) => {
      const base = payload.editingId
        ? current.filter((e) => String(e.id) !== String(payload.editingId))
        : current;
      return dedupeConsultations([localEvent, ...base]);
    });

    backgroundSyncConsulta(localEvent, {
      patient: payload.patient,
      start: payload.start,
      end: payload.end,
      location: payload.location,
      medico: payload.medico || localEvent.medico,
    });

    if (!payload.editingId) {
      return String(localEvent.id);
    }

    setAgendaModal(null);
  }

  function buildGoogleSyncUrl(): string {
    const params = new URLSearchParams();
    if (isClinica || hasProfissionalAgendas) {
      params.set("allConnected", "true");
    }
    params.set("timeMin", agendaWindowTimeMin());
    params.set("timeMax", agendaWindowTimeMax());
    return `/api/google-calendar?${params}`;
  }

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

  // Sincronizar Google após pull do servidor, verificação de conexão e lista de profissionais
  useEffect(() => {
    if (!serverPullDone || !googleCheckDone || medicosLoading) return;
    if (!canUseGoogleCalendar) return;

    if (!didAutoGoogleSync.current) {
      didAutoGoogleSync.current = true;
      void handleGoogleSync();
      return;
    }

    if (
      hasProfissionalAgendas &&
      !googleSyncAfterProfissionais.current &&
      profissionais.length > 0
    ) {
      googleSyncAfterProfissionais.current = true;
      void handleGoogleSync();
    }
  }, [
    serverPullDone,
    googleCheckDone,
    medicosLoading,
    canUseGoogleCalendar,
    hasProfissionalAgendas,
    profissionais.length,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

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

  /** Sincronizar: puxa eventos do Google Calendar e mescla com locais */
  async function handleGoogleSync() {
    if (!canUseGoogleCalendar) {
      setSyncMessage(
        "Conecte sua agenda Google ou peça às profissionais que autorizem pelo link de convite.",
      );
      setSyncStatus("error");
      return;
    }

    setIsSyncing(true);
    setSyncStatus("loading");
    setSyncMessage(null);

    try {
      const res = await fetch(buildGoogleSyncUrl());
      if (!res.ok) {
        const err = await res.json();
        throw new Error(
          err.error || "Falha ao sincronizar com Google Calendar.",
        );
      }

      const data = await res.json();
      const googleEvents: ConsultationEvent[] = (data.items || []).map(
        (item: Parameters<typeof googleCalendarItemToConsultation>[0]) =>
          googleCalendarItemToConsultation(item, profissionais, {
            legacyCatalog: legacyCatalog ?? undefined,
          }),
      );

      const warnings = (data.warnings ?? []) as {
        profissionalId: string;
        nome?: string;
        error: string;
      }[];

      // Mesclar: anexa googleEventId ao registro local rico (sem duplicar)
      setEvents((current) => {
        const merged = mergeGoogleCalendarEvents(current, googleEvents);
        void syncAllConsultasToServer(merged);
        return merged;
      });

      // Eventos importados do Google (ex.: titular antes do OAuth da owner) podem faltar anamnese
      const backfillRes = await fetch("/api/google-calendar/backfill-anamnese", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }).catch(() => null);
      const backfillData = backfillRes?.ok
        ? ((await backfillRes.json()) as { patched?: number })
        : null;

      const warningText = warnings
        .map((w) => `${w.nome || w.profissionalId}: ${w.error}`)
        .join(" · ");

      if (warnings.length && googleEvents.length === 0) {
        setSyncMessage(
          warningText ||
            "Não foi possível importar eventos das agendas conectadas.",
        );
        setSyncStatus("error");
      } else if (warnings.length) {
        setSyncMessage(
          `${googleEvents.length} eventos sincronizados. Avisos: ${warningText}`,
        );
        setSyncStatus("success");
      } else {
        const backfillNote =
          backfillData?.patched
            ? ` ${backfillData.patched} evento(s) atualizado(s) com link de anamnese.`
            : "";
        setSyncMessage(
          `${googleEvents.length} eventos sincronizados do Google Calendar.${backfillNote}`,
        );
        setSyncStatus("success");
      }
    } catch (err: unknown) {
      setSyncMessage(
        err instanceof Error
          ? err.message
          : "Falha ao sincronizar com Google Calendar.",
      );
      setSyncStatus("error");
    } finally {
      setIsSyncing(false);
    }
  }

  const refreshAgendaData = useCallback(async () => {
    setSyncMessage(null);
    try {
      await pullFromServer();
      if (canUseGoogleCalendar) {
        await handleGoogleSync();
      }
      invalidatePacientesOpcoesClientCache();
      setSyncMessage("Agenda sincronizada com os outros dispositivos.");
      setSyncStatus("success");
    } catch {
      setSyncMessage("Não foi possível sincronizar. Tente novamente.");
      setSyncStatus("error");
    }
  }, [pullFromServer, canUseGoogleCalendar]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!serverPullDone) return;

    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshAgendaData();
    };

    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [serverPullDone, refreshAgendaData]);

  async function handleAddConsultation(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormErro(null);

    if (!patient.trim() && !formPacienteSel) {
      setFormErro("Selecione um cliente na lista ou informe o nome.");
      return;
    }
    if (!start || !end) {
      setFormErro("Informe início e fim do atendimento.");
      return;
    }
    if (!isValidPhone(formTelefone)) {
      setFormErro("Informe o WhatsApp com DDD ou internacional (+código do país).");
      return;
    }
    const medicoErr = validateMedicoSelection(medicosOptions, formMedico, isClinica);
    if (medicoErr) {
      setFormErro(medicoErr);
      return;
    }

    let patientName = patient.trim();
    let clienteDriveId: string | undefined;
    try {
      const resolved = await ensurePacienteCliente({
        nome: patientName,
        telefone: formTelefone.trim(),
        paciente_sel: formPacienteSel,
      });
      patientName = resolved.nome;
      clienteDriveId = resolved.id;
      await reloadClientesAgenda();
    } catch (err) {
      setFormErro(err instanceof Error ? err.message : "Erro ao cadastrar cliente");
      return;
    }

    const dataInicio = new Date(start);
    const dataFim = new Date(end);
    const medicoNome = resolveMedicoValue(medicosOptions, formMedico);
    const medicoProfId = medicoNome
      ? profissionalIdByNome(profissionais, medicoNome)
      : undefined;
    const googleProfId = medicoNome
      ? resolveGoogleProfissionalId(medicoNome)
      : undefined;

    const localEvent: ConsultationEvent = {
      ...createConsultationEvent({
        patient: patientName,
        service,
        value: 0,
        start: dataInicio,
        end: dataFim,
        location: location || enderecoFormatado || undefined,
        telefone: formTelefone.trim() || undefined,
        lembretesWhatsapp: formLembretes,
        medico: medicoNome || undefined,
        medicoProfissionalId: medicoProfId,
        observacoes: observacoes || undefined,
        clienteDriveId,
        isDraft: false,
      }),
      googleProfissionalId: googleProfId,
    };

    setEvents((current) => dedupeConsultations([localEvent, ...current]));

    backgroundSyncConsulta(localEvent, {
      patient: patientName,
      start: dataInicio,
      end: dataFim,
      location: location || enderecoFormatado || undefined,
      medico: medicoNome,
    });

    setPatient("");
    setFormPacienteSel("");
    setFormTelefone("");
    setObservacoes("");
    setLocation("");
    setService("");
  }

  async function handleDeleteAgendaModal() {
    if (!agendaModal?.editing) return;
    if (!confirm("Excluir este agendamento da agenda?")) return;
    setDeletingAgendaModal(true);
    await handleRemoveConsultation(agendaModal.editing);
    setDeletingAgendaModal(false);
    setAgendaModal(null);
    setInitialClienteId(null);
  }

  /** Remover consulta: duplicata esparsa só sai da lista/Supabase; cópia rica remove tudo. */
  async function handleRemoveConsultation(event: ConsultationEvent) {
    const id = String(event.id);
    const googleEventId = event.googleEventId ? String(event.googleEventId) : undefined;
    const partner = findDuplicatePartner(event, events);
    const isSparseDuplicate =
      partner != null && consultationRichness(event) < consultationRichness(partner);

    if (isSparseDuplicate) {
      await deleteConsultasFromServer({ ids: [id] });
      setEvents((current) =>
        dedupeConsultations(current.filter((item) => String(item.id) !== id)),
      );
      return;
    }

    if (googleEventId && canUseGoogleCalendar) {
      try {
        const qs = new URLSearchParams({
          eventId: googleEventId,
        });
        if (event.googleProfissionalId) {
          qs.set("profissionalId", event.googleProfissionalId);
        }
        await fetch(`/api/google-calendar?${qs}`, { method: "DELETE" });
      } catch (err) {
        console.warn("Erro ao remover evento do Google Calendar:", err);
      }
    }

    const idsToDelete = [id];
    if (partner && consultationRichness(partner) < consultationRichness(event)) {
      idsToDelete.push(String(partner.id));
    }

    await deleteConsultasFromServer({
      ids: idsToDelete,
      googleEventIds: googleEventId ? [googleEventId] : undefined,
    });

    setEvents((current) =>
      dedupeConsultations(
        current.filter((item) => {
          if (idsToDelete.includes(String(item.id))) return false;
          if (googleEventId && item.googleEventId === googleEventId) return false;
          return true;
        }),
      ),
    );
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

      await fetch("/api/financeiro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "entrada",
          descricao: descParts.join(" - "),
          data: dataFinanceiro,
          valor: payload.valorPago,
          categoria: "consulta",
          medico: payload.medico,
          forma_pagamento: payload.formaPagamento,
          parcelas: payload.parcelas,
          percentual_profissional: payload.percentualProfissional,
          observacao: [financeiroObs, pagamentoObs].filter(Boolean).join(" · "),
          catalogo_itens: payload.catalogoItens.filter((i) => i.catalogoId),
        }),
      });
    } catch {
      /* financeiro opcional */
    }

    if (finalizando.clienteDriveId) {
      try {
        await fetch(`/api/clientes/${finalizando.clienteDriveId}/finalizar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data: dataFinanceiro,
            hora: horaConsulta,
            valor: payload.valorOriginal,
            valorOriginal: payload.valorOriginal,
            descontoPercent: payload.descontoPercent,
            descontoValor: payload.descontoValor,
            forma_pagamento: payload.formaPagamento,
            medico: payload.medico,
            parcelas: payload.parcelas,
            tipo: "consulta",
            observacoes: payload.observacoes || null,
            catalogo_itens: payload.catalogoItens,
          }),
        });
      } catch {
        /* histórico do cliente opcional */
      }
    }

    setSavingFinalizar(false);
  }

  return (
    <main className="min-h-screen bg-[#f8f9fa] pb-20 md:pb-12">
      <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-8 lg:px-8 min-w-0">
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
          {/* Calendário primeiro no celular */}
          <section className="order-1 xl:order-2 min-w-0">
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
              </div>
              <button
                type="button"
                onClick={() => void refreshAgendaData()}
                disabled={refreshingServer || isSyncing || !serverPullDone}
                className="inline-flex items-center gap-2 rounded-xl border border-[#047482]/30 bg-white px-3 py-2 text-xs font-semibold text-[#047482] shadow-sm transition hover:bg-[#eef4f5] disabled:opacity-50 touch-manipulation"
              >
                {refreshingServer || isSyncing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : null}
                Sincronizar
              </button>
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
            {canUseGoogleCalendar && !isSyncing && googleEventsCount === 0 && (
              <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 md:hidden">
                {hasProfissionalAgendas && !isGoogleConnected
                  ? "Agendas da equipe conectadas — toque em Sincronizar para importar os eventos na grade."
                  : "Nenhum evento do Google na grade — toque em Sincronizar."}
              </p>
            )}
            <AgendaCalendar
              events={displayEvents}
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
            {/* Card Nova Consulta */}
            <div
              id="nova-consulta-form"
              data-tour="agenda-nova-sessao"
              className="rounded-2xl sm:rounded-4xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm scroll-mt-6"
            >
              <PrimeirosPassosHint
                hintId="hint-agenda-nova-sessao"
                title="Nova sessão"
                message='Clique em um horário vazio na grade ou use o botão "Nova sessão" no topo.'
              />
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-[#047482]">
                    Nova sessão
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    Ou clique na grade do calendário para abrir o formulário de agendamento.
                  </p>
                </div>
              </div>

              <form onSubmit={handleAddConsultation} className="mt-6 space-y-4">
                {formErro && (
                  <p className="text-sm text-red-700 bg-red-50 rounded-xl px-3 py-2">{formErro}</p>
                )}
                <PacienteSearchField
                  value={formPacienteSel}
                  onChange={(sel, opt) => {
                    setFormPacienteSel(sel);
                    if (opt) setPatient(opt.nome);
                    else setPatient("");
                  }}
                  onTelefoneChange={(tel) => setFormTelefone(aplicarMascaraWhatsapp(tel))}
                  telefoneAtual={formTelefone}
                  clientesIniciais={clientesAgenda}
                  manualName={patient}
                  onManualNameChange={setPatient}
                />
                <label className="space-y-2 text-sm text-slate-700 min-w-0 block">
                  WhatsApp (DDD) *
                  <input
                    type="tel"
                    value={formTelefone}
                    onChange={(e) => setFormTelefone(aplicarMascaraWhatsapp(e.target.value))}
                    className="w-full min-w-0 rounded-2xl sm:rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-base sm:text-sm text-slate-900 outline-none focus:border-[#3795a1]"
                    placeholder="(11) 99999-9999"
                  />
                </label>
                <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formLembretes}
                    onChange={(e) => setFormLembretes(e.target.checked)}
                    className="mt-1 rounded border-slate-300 text-[#047482]"
                  />
                  <span>Incluir nos lembretes WhatsApp do Dashboard</span>
                </label>
                <label className="space-y-2 text-sm text-slate-700 min-w-0 block">
                  Serviço <span className="text-slate-400 font-normal">(opcional)</span>
                  <input
                    value={service}
                    onChange={(e) => setService(e.target.value)}
                    className="w-full min-w-0 rounded-2xl sm:rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-base sm:text-sm text-slate-900 outline-none focus:border-[#3795a1]"
                    placeholder="Ex: Corte, coloração"
                  />
                </label>
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                  <label className="space-y-2 text-sm text-slate-700 min-w-0">
                    Início *
                    <input
                      required
                      type="datetime-local"
                      value={start}
                      onChange={(e) => {
                        const v = e.target.value;
                        setStart(v);
                        if (!v) return;
                        if (end) {
                          const shifted = shiftEndPreservingDuration(start, v, end);
                          if (shifted) {
                            setEnd(toDatetimeLocalValue(shifted));
                            return;
                          }
                        }
                        if (duracaoPadraoMin) {
                          setEnd(datetimeLocalMaisMinutos(v, duracaoPadraoMin));
                        }
                      }}
                      className="w-full min-w-0 max-w-full rounded-2xl sm:rounded-3xl border border-slate-200 bg-slate-50 px-3 py-3 text-base sm:text-sm text-slate-900 outline-none focus:border-[#3795a1]"
                    />
                  </label>
                  <label className="space-y-2 text-sm text-slate-700 min-w-0">
                    Fim *
                    <input
                      required
                      type="datetime-local"
                      value={end}
                      onChange={(e) => setEnd(e.target.value)}
                      className="w-full min-w-0 max-w-full rounded-2xl sm:rounded-3xl border border-slate-200 bg-slate-50 px-3 py-3 text-base sm:text-sm text-slate-900 outline-none focus:border-[#3795a1]"
                    />
                  </label>
                </div>
                <MedicoSelect
                  medicos={medicosOptions}
                  isClinica={isClinica}
                  value={formMedico}
                  onChange={setFormMedico}
                  className="w-full min-w-0 rounded-2xl sm:rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-base sm:text-sm text-slate-900"
                />
                <label className="space-y-2 text-sm text-slate-700 min-w-0">
                  Endereço
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Rua, número, bairro - Cidade/UF"
                    className="w-full min-w-0 rounded-2xl sm:rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-base sm:text-sm text-slate-900 outline-none focus:border-[#3795a1]"
                  />
                  {location && isGoogleConnected && (
                    <p className="text-xs text-blue-500">
                      O endereço será incluído no evento da agenda Google.
                    </p>
                  )}
                </label>
                <label className="space-y-2 text-sm text-slate-700">
                  Observações
                  <textarea
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    rows={2}
                    placeholder="Notas adicionais para o evento..."
                    className="w-full min-w-0 rounded-2xl sm:rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-base sm:text-sm text-slate-900 outline-none focus:border-[#3795a1]"
                  />
                </label>
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--brand-primary)] px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-primary-dark)] touch-manipulation"
                >
                  {isGoogleConnected ? (
                    <>
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="#4285F4">
                        <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z" />
                      </svg>
                      Salvar no Google Calendar
                    </>
                  ) : (
                    "Salvar atendimento"
                  )}
                </button>
              </form>
            </div>

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
                        ? "Agendas da equipe conectadas. Use Sincronizar para importar os eventos na grade."
                        : "Eventos sincronizados bidirecionalmente com lembretes automáticos."
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
                    Sincronizar Google Calendar
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
                    const st =
                      STATUS_CONSULTA_UI[item.status ?? "confirmado"] ??
                      STATUS_CONSULTA_UI.confirmado;

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
                            <span
                              className={`inline-block mt-2 text-[10px] font-semibold px-2 py-0.5 rounded-full ${st.color}`}
                            >
                              {st.label}
                            </span>
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
    </main>
  );
}
