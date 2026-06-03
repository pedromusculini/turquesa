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
import { clientesApiToOpcoes } from "@/lib/pacienteOpcoesUi";
import type { PacienteOpcao } from "@/lib/types";
import PacienteSearchField from "@/components/PacienteSearchField";
import { aplicarMascaraWhatsapp } from "@/lib/constants";
import { ensurePacienteCliente } from "@/lib/ensurePacienteClienteClient";
import { brPhoneLocalDigits } from "@/lib/phoneMatch";
import ConvenioSelect from "@/components/ConvenioSelect";
import MedicoSelect from "@/components/MedicoSelect";
import { useMedicosOptions } from "@/lib/useMedicosOptions";
import {
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
  TIPO_CONSULTA_UI,
  parseEventDate,
  createConsultationEvent,
  datetimeLocalMaisMinutos,
  DURACAO_CONSULTA_MIN,
} from "@/lib/consultations";
import { scheduleSyncConsultasToServer } from "@/lib/syncConsultasClient";
import { format } from "date-fns";

type ConsultationEvent = ConsultationRecord;

type AgendaPageClientProps = {
  userEmail: string;
  provider?: string | null;
};

export default function AgendaPageClient({
  userEmail,
  provider,
}: AgendaPageClientProps) {
  const [events, setEvents] = useState<ConsultationEvent[]>([]);
  const [patient, setPatient] = useState("");
  const [service, setService] = useState("Consulta médica");
  const [value, setValue] = useState(200);
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
  const [agendaModal, setAgendaModal] = useState<{
    start: Date;
    end: Date;
    editing: ConsultationEvent | null;
  } | null>(null);
  const [savingAgendaModal, setSavingAgendaModal] = useState(false);
  const [deletingAgendaModal, setDeletingAgendaModal] = useState(false);
  const [formPacienteSel, setFormPacienteSel] = useState("");
  const [formTelefone, setFormTelefone] = useState("");
  const [formConvenio, setFormConvenio] = useState("");
  const [formLembretes, setFormLembretes] = useState(true);
  const [formErro, setFormErro] = useState<string | null>(null);
  const [formMedico, setFormMedico] = useState("");
  const { medicos: medicosOptions, isClinica } = useMedicosOptions();
  const [clientesAgenda, setClientesAgenda] = useState<PacienteOpcao[]>([]);
  const [initialClienteId, setInitialClienteId] = useState<string | null>(null);
  const searchParams = useSearchParams();

  // Perfil / endereço do consultório
  const [profile, setProfile] = useState<{
    full_name?: string;
    clinic_name?: string;
    specialty?: string;
    address?: string;
    street?: string;
    address_number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    cep?: string;
  } | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState(false);

  useEffect(() => {
    fetch("/api/clientes")
      .then((r) => r.json())
      .then((data) => {
        if (data.clientes) {
          setClientesAgenda(clientesApiToOpcoes(data.clientes));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (searchParams.get("agendar") !== "1") return;
    const clienteId = searchParams.get("clienteId");
    if (clienteId) setInitialClienteId(clienteId);
    const start = new Date();
    start.setSeconds(0, 0);
    const m = start.getMinutes();
    if (m > 0 && m <= 30) start.setMinutes(30);
    else if (m > 30) {
      start.setHours(start.getHours() + 1);
      start.setMinutes(0);
    }
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + DURACAO_CONSULTA_MIN);
    setAgendaModal({ start, end, editing: null });
    window.history.replaceState({}, "", "/agenda");
  }, [searchParams]);

  // Buscar perfil do usuário para exibir endereço
  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch("/api/perfil");
        if (res.ok) {
          const data = await res.json();
          const p = data.profile || data;
          setProfile(p);
          setProfileError(false);
        } else {
          setProfileError(true);
        }
      } catch {
        setProfileError(true);
      } finally {
        setProfileLoading(false);
      }
    }
    fetchProfile();
  }, []);

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

  // Verificar conexão com Google Calendar via sessão (token já pode estar na sessão)
  useEffect(() => {
    async function checkSessionConnection() {
      // Se já está conectado via URL param, não precisa verificar
      if (isGoogleConnected) return;
      try {
        // Tentar chamada leve para ver se o token já está disponível na sessão
        const res = await fetch("/api/google-calendar?maxResults=1");
        if (res.ok) {
          setIsGoogleConnected(true);
        }
      } catch {
        // Silencioso - não conectado ainda
      }
    }
    checkSessionConnection();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps


  // Inicializar datas padrão (amanhã 08:00-08:40)
  useEffect(() => {
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);
    amanha.setHours(8, 0, 0, 0);
    const fim = new Date(amanha);
    fim.setMinutes(fim.getMinutes() + DURACAO_CONSULTA_MIN);

    setStart(amanha.toISOString().slice(0, 16));
    setEnd(fim.toISOString().slice(0, 16));
  }, []);

  useEffect(() => {
    setEvents(loadConsultations());
    skipNextSave.current = false;

    fetch('/api/consultas')
      .then((r) => r.json())
      .then((data) => {
        const rows = data.consultas as { id: string; status: string }[] | undefined;
        if (!rows?.length) return;
        const statusById = new Map(rows.map((r) => [String(r.id), r.status]));
        setEvents((prev) => {
          let changed = false;
          const next = prev.map((ev) => {
            const st = statusById.get(String(ev.id));
            if (st && st !== ev.status) {
              changed = true;
              return { ...ev, status: st as ConsultationRecord['status'] };
            }
            return ev;
          });
          return changed ? next : prev;
        });
      })
      .catch(() => {});

    const handler = () => {
      if (savingFromSelf.current) return;
      const next = loadConsultations();
      setEvents((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
        return next;
      });
    };

    window.addEventListener("medsupapp-consultations-updated", handler);
    return () => window.removeEventListener("medsupapp-consultations-updated", handler);
  }, []);

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
        f.setMinutes(f.getMinutes() + 40);
        return f;
      })();
    setAgendaModal({ start: startDate, end: endDate, editing: ev });
  }, []);

  async function confirmAgendaConsulta(payload: AgendaConsultaPayload) {
    setSavingAgendaModal(true);
    const others = payload.editingId
      ? events.filter((e) => String(e.id) !== String(payload.editingId))
      : events;

    const localEvent = createConsultationEvent({
      id: payload.editingId ?? undefined,
      patient: payload.patient,
      service: payload.service,
      value: payload.value,
      start: payload.start,
      end: payload.end,
      location: payload.location || enderecoFormatado || undefined,
      telefone: payload.telefone || undefined,
      lembretesWhatsapp: payload.lembretesWhatsapp,
      medico: payload.medico || undefined,
      convenio: payload.convenio || undefined,
      observacoes: payload.observacoes || undefined,
      isDraft: false,
      allEvents: others,
    });

    setEvents((current) => {
      const base = payload.editingId
        ? current.filter((e) => String(e.id) !== String(payload.editingId))
        : current;
      return [localEvent, ...base];
    });

    if (isGoogleConnected && !localEvent.googleEventId) {
      try {
        const res = await fetch("/api/google-calendar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            summary: `${localEvent.service} - ${payload.patient}`,
            description: `Paciente: ${payload.patient}\nServiço: ${localEvent.service}`,
            start: payload.start.toISOString(),
            end: payload.end.toISOString(),
            location: payload.location || undefined,
          }),
        });
        if (res.ok) {
          const googleEvent = await res.json();
          setEvents((current) =>
            current.map((ev) =>
              ev.id === localEvent.id
                ? {
                    ...ev,
                    googleEventId: googleEvent.id,
                    id: `google-${googleEvent.id}`,
                  }
                : ev,
            ),
          );
        }
      } catch {
        /* mantém só local */
      }
    }

    scheduleSyncConsultasToServer([
      localEvent,
      ...events.filter((e) => String(e.id) !== String(localEvent.id)),
    ]);

    setAgendaModal(null);
    setSavingAgendaModal(false);
  }

  // Sincronizar com Google Calendar ao montar (se conectado)
  useEffect(() => {
    if (isGoogleConnected) {
      handleGoogleSync();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Totalizadores
  const totalRevenue = useMemo(
    () => events.reduce((sum, item) => sum + Number(item.value ?? 0), 0),
    [events],
  );
  const googleEventsCount = useMemo(
    () => events.filter((e) => e.googleEventId).length,
    [events],
  );

  const connectedLabel = isGoogleConnected ? "Conectado" : "Não conectado";

  /** Sincronizar: puxa eventos do Google Calendar e mescla com locais */
  async function handleGoogleSync() {
    if (!isGoogleConnected) {
      setSyncMessage(
        "Faça login com Google para conectar a agenda do Google Calendar.",
      );
      setSyncStatus("error");
      return;
    }

    setIsSyncing(true);
    setSyncStatus("loading");
    setSyncMessage(null);

    try {
      const res = await fetch("/api/google-calendar");
      if (!res.ok) {
        const err = await res.json();
        throw new Error(
          err.error || "Falha ao sincronizar com Google Calendar.",
        );
      }

      const data = await res.json();
      const googleEvents: ConsultationEvent[] = (data.items || []).map(
        (item: any) => ({
          id: `google-${item.id}`,
          googleEventId: item.id,
          title: item.summary || "Evento Google",
          patient: item.attendees?.[0]?.email || item.creator?.email || "Google",
          service: item.summary || "Evento de agenda",
          value: 0,
          location: item.location || undefined,
          start: item.start?.dateTime || item.start?.date || "",
          end: item.end?.dateTime || item.end?.date || "",
          backgroundColor: "#4285F4",
          borderColor: "#1a73e8",
        }),
      );

      // Mesclar: mantém eventos locais e adiciona os do Google (evita duplicatas por googleEventId)
      setEvents((current) => {
        const googleIds = new Set(googleEvents.map((e) => e.googleEventId));
        const localOnly = current.filter(
          (e) => !e.googleEventId || !googleIds.has(e.googleEventId),
        );
        return [...googleEvents, ...localOnly];
      });

      setSyncMessage(
        `${googleEvents.length} eventos sincronizados do Google Calendar.`,
      );
      setSyncStatus("success");
    } catch (err: any) {
      setSyncMessage(err.message);
      setSyncStatus("error");
    } finally {
      setIsSyncing(false);
    }
  }

  /** Criar consulta local + enviar para Google Calendar */
  const reloadClientesAgenda = useCallback(async () => {
    try {
      const res = await fetch("/api/clientes");
      const data = await res.json();
      if (data.clientes) setClientesAgenda(clientesApiToOpcoes(data.clientes));
    } catch {
      /* ignore */
    }
  }, []);

  async function handleAddConsultation(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormErro(null);

    if (!patient.trim() && !formPacienteSel) {
      setFormErro("Selecione um paciente na lista ou informe o nome.");
      return;
    }
    if (!start || !end) {
      setFormErro("Informe início e fim da consulta.");
      return;
    }
    if (brPhoneLocalDigits(formTelefone).length < 10) {
      setFormErro("Informe o WhatsApp com DDD para lembretes e cadastro.");
      return;
    }
    const medicoErr = validateMedicoSelection(medicosOptions, formMedico, isClinica);
    if (medicoErr) {
      setFormErro(medicoErr);
      return;
    }

    let patientName = patient.trim();
    try {
      const resolved = await ensurePacienteCliente({
        nome: patientName,
        telefone: formTelefone.trim(),
        paciente_sel: formPacienteSel,
      });
      patientName = resolved.nome;
      await reloadClientesAgenda();
    } catch (err) {
      setFormErro(err instanceof Error ? err.message : "Erro ao cadastrar paciente");
      return;
    }

    const dataInicio = new Date(start);
    const dataFim = new Date(end);

    const localEvent = createConsultationEvent({
      patient: patientName,
      service,
      value,
      start: dataInicio,
      end: dataFim,
      location: location || enderecoFormatado || undefined,
      telefone: formTelefone.trim() || undefined,
      lembretesWhatsapp: formLembretes,
      medico: resolveMedicoValue(medicosOptions, formMedico) || undefined,
      convenio: formConvenio || undefined,
      observacoes: observacoes || undefined,
      isDraft: false,
      allEvents: events,
    });

    setEvents((current) => [localEvent, ...current]);
    scheduleSyncConsultasToServer([localEvent, ...events]);

    // Se conectado ao Google, cria o evento lá também
    if (isGoogleConnected) {
      try {
        const res = await fetch("/api/google-calendar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            summary: `${service} - ${patient}`,
            description: `Paciente: ${patient}\nServiço: ${service}\nValor: R$ ${value.toFixed(2)}\n${observacoes ? `Obs: ${observacoes}` : ""}`,
            start: new Date(start).toISOString(),
            end: new Date(end).toISOString(),
            location: location || undefined,
          }),
        });

        if (res.ok) {
          const googleEvent = await res.json();
          // Atualiza o evento local com o ID do Google
          setEvents((current) =>
            current.map((ev) =>
              ev.id === localEvent.id
                ? { ...ev, googleEventId: googleEvent.id, id: `google-${googleEvent.id}` }
                : ev,
            ),
          );
          setSyncMessage("Evento criado no Google Calendar com lembretes!");
          setSyncStatus("success");
        } else {
          console.warn("Falha ao criar evento no Google Calendar");
        }
      } catch (err) {
        console.warn("Erro ao criar evento no Google:", err);
      }
    }

    setPatient("");
    setFormPacienteSel("");
    setFormTelefone("");
    setFormConvenio("");
    setObservacoes("");
    setLocation("");
    setService("Consulta médica");
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

  /** Remover consulta local + Google Calendar */
  async function handleRemoveConsultation(event: ConsultationEvent) {
    const id = String(event.id);

    // Se tem googleEventId, remove também do Google Calendar
    if (event.googleEventId && isGoogleConnected) {
      try {
        await fetch(
          `/api/google-calendar?eventId=${encodeURIComponent(event.googleEventId)}`,
          { method: "DELETE" },
        );
      } catch (err) {
        console.warn("Erro ao remover evento do Google Calendar:", err);
      }
    }

    setEvents((current) => current.filter((item) => item.id !== id));
  }

  /** Formatar moeda */
  const fmt = (val: number) => `R$ ${val.toFixed(2).replace(".", ",")}`;

  async function handleFinalizarConsulta(payload: {
    valorPago: number;
    valorOriginal: number;
    formaPagamento: FormaPagamentoConsulta;
    convenio: string;
    descontoPercent: number;
    descontoValor: number;
    parcelas: number;
    tipoConsulta: "nova_consulta" | "retorno";
    medico: string;
  }) {
    if (!finalizando?.id) return;
    setSavingFinalizar(true);

    const formaLabel =
      FORMAS_PAGAMENTO_CONSULTA.find((f) => f.id === payload.formaPagamento)?.label ??
      payload.formaPagamento;
    const tipoLabel = payload.tipoConsulta === "retorno" ? "Retorno" : "Nova consulta";
    const paciente = finalizando.patient ?? "Paciente";

    const updated = applyFinalizarConsulta(events, finalizando.id, payload);
    setEvents(updated);
    setFinalizando(null);

    try {
      const descParts = [
        tipoLabel,
        paciente,
        formaLabel,
        payload.convenio ? `Convênio: ${payload.convenio}` : null,
        payload.parcelas > 1 ? `${payload.parcelas}x` : null,
      ].filter(Boolean);

      await fetch("/api/financeiro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "entrada",
          descricao: descParts.join(" - "),
          data: format(new Date(), "yyyy-MM-dd"),
          valor: payload.valorPago,
          categoria: "consulta",
          observacao: `Pagamento: ${formaLabel}${payload.parcelas > 1 ? ` (${payload.parcelas}x)` : ""}`,
        }),
      });
    } catch {
      /* financeiro opcional */
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
              <p className="inline-flex rounded-full bg-[#d4f5d4] px-3 py-1 text-xs sm:text-sm font-semibold uppercase tracking-wide text-[#2d652d]">
                Agenda
              </p>
              <h1 className="mt-3 max-w-3xl text-2xl font-semibold tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">
                Sua agenda clínica conectada ao Google.
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
                      isGoogleConnected ? "text-emerald-600" : "text-slate-400"
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
              <span className="inline-flex rounded-2xl bg-[#90EE90] px-5 py-3 text-sm font-semibold text-slate-950 shadow-sm">
                {googleEventsCount} no Google · {events.length} total
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,380px)_1fr] min-w-0">
          {/* Calendário primeiro no celular */}
          <section className="order-1 xl:order-2 min-w-0">
            <div className="mb-3 sm:mb-4 px-0.5">
              <h2 className="text-xl sm:text-2xl font-semibold text-slate-950">Grade da agenda</h2>
              <p className="mt-1 text-xs sm:text-sm text-slate-600">
                Toque em um horário para agendar · no celular use a vista &quot;Dia&quot;
              </p>
            </div>
            <AgendaCalendar
              events={events}
              onEventsChange={setEvents}
              onSlotSelect={handleSlotSelect}
              onEventClick={handleCalendarEventClick}
            />
          </section>

          {/* Formulários e cards — abaixo do calendário no mobile */}
          <aside className="order-2 xl:order-1 space-y-4 min-w-0">
            {/* Card Nova Consulta */}
            <div
              id="nova-consulta-form"
              className="rounded-2xl sm:rounded-4xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm scroll-mt-6"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-[#2d652d]">
                    Nova consulta
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
                    if (opt) {
                      setPatient(opt.nome);
                      if (opt.telefone) setFormTelefone(aplicarMascaraWhatsapp(opt.telefone));
                      if (opt.convenio) setFormConvenio(opt.convenio);
                    } else setPatient("");
                  }}
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
                    className="w-full min-w-0 rounded-2xl sm:rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-base sm:text-sm text-slate-900 outline-none focus:border-[#90EE90]"
                    placeholder="(11) 99999-9999"
                  />
                </label>
                <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formLembretes}
                    onChange={(e) => setFormLembretes(e.target.checked)}
                    className="mt-1 rounded border-slate-300 text-[#228B22]"
                  />
                  <span>Incluir nos lembretes WhatsApp do Dashboard</span>
                </label>
                <label className="space-y-2 text-sm text-slate-700 min-w-0 block">
                  Serviço *
                  <input
                    required
                    value={service}
                    onChange={(e) => setService(e.target.value)}
                    className="w-full min-w-0 rounded-2xl sm:rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-base sm:text-sm text-slate-900 outline-none focus:border-[#90EE90]"
                    placeholder="Ex: Consulta, Retorno"
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
                        if (v) setEnd(datetimeLocalMaisMinutos(v));
                      }}
                      className="w-full min-w-0 max-w-full rounded-2xl sm:rounded-3xl border border-slate-200 bg-slate-50 px-3 py-3 text-base sm:text-sm text-slate-900 outline-none focus:border-[#90EE90]"
                    />
                  </label>
                  <label className="space-y-2 text-sm text-slate-700 min-w-0">
                    Fim *
                    <input
                      required
                      type="datetime-local"
                      value={end}
                      onChange={(e) => setEnd(e.target.value)}
                      className="w-full min-w-0 max-w-full rounded-2xl sm:rounded-3xl border border-slate-200 bg-slate-50 px-3 py-3 text-base sm:text-sm text-slate-900 outline-none focus:border-[#90EE90]"
                    />
                  </label>
                </div>
                <label className="space-y-2 text-sm text-slate-700 min-w-0">
                  Valor (R$)
                  <input
                    type="number"
                    min="0"
                    value={value}
                    onChange={(e) => setValue(Number(e.target.value))}
                    className="w-full min-w-0 rounded-2xl sm:rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-base sm:text-sm text-slate-900 outline-none focus:border-[#90EE90]"
                  />
                </label>
                <MedicoSelect
                  medicos={medicosOptions}
                  isClinica={isClinica}
                  value={formMedico}
                  onChange={setFormMedico}
                  label="Médico"
                  className="w-full min-w-0 rounded-2xl sm:rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-base sm:text-sm text-slate-900"
                />
                <ConvenioSelect
                  value={formConvenio}
                  onChange={setFormConvenio}
                  label="Plano / convênio"
                  allowEmpty
                  emptyLabel="Particular ou não informado"
                  className="w-full min-w-0 rounded-2xl sm:rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-base sm:text-sm text-slate-900"
                />
                <label className="space-y-2 text-sm text-slate-700 min-w-0">
                  Endereço
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Rua, número, bairro - Cidade/UF"
                    className="w-full min-w-0 rounded-2xl sm:rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-base sm:text-sm text-slate-900 outline-none focus:border-[#90EE90]"
                  />
                  {location && isGoogleConnected && (
                    <p className="text-xs text-blue-500">
                      🗺️ O endereço será incluído como link do Google Maps no
                      evento.
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
                    className="w-full min-w-0 rounded-2xl sm:rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-base sm:text-sm text-slate-900 outline-none focus:border-[#90EE90]"
                  />
                </label>
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#90EE90] px-4 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-[#7ad47a] touch-manipulation"
                >
                  {isGoogleConnected ? (
                    <>
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="#4285F4">
                        <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z" />
                      </svg>
                      Salvar no Google Calendar
                    </>
                  ) : (
                    "Salvar consulta"
                  )}
                </button>
              </form>
            </div>

            {/* Card Endereço do Consultório */}
            <div className="rounded-2xl sm:rounded-4xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-[#2d652d]">
                    {profileLoading ? "Carregando..." : "Consultório"}
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
                    className="inline-flex items-center gap-1.5 rounded-2xl bg-green-50 px-4 py-2 text-xs font-semibold text-green-700 transition hover:bg-green-100"
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
                  <p className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-[#2d652d]">
                    Google Calendar
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    {isGoogleConnected
                      ? "Eventos sincronizados bidirecionalmente com lembretes automáticos."
                      : "Faça login com Google para ativar a sincronização."}
                  </p>
                </div>
                <span
                  className={`self-start shrink-0 rounded-full px-3 py-1 text-[10px] sm:text-xs font-semibold uppercase tracking-wide ${
                    isGoogleConnected
                      ? "bg-[#f4fff4] text-[#2d652d]"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {connectedLabel}
                </span>
              </div>

              <button
                type="button"
                onClick={
                  isGoogleConnected
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
                ) : isGoogleConnected ? (
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

              {isGoogleConnected && (
                <div className="mt-4 rounded-2xl bg-blue-50 p-4">
                  <p className="text-xs font-medium text-blue-700">
                    🔔 Lembretes automáticos
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-blue-600">
                    <li>• 7 dias antes do evento</li>
                    <li>• 1 dia antes do evento</li>
                    <li>• 1 hora antes do evento</li>
                  </ul>
                </div>
              )}
            </div>

            {/* Card Consultas salvas */}
            <div className="rounded-2xl sm:rounded-4xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-[#2d652d]">
                    Consultas salvas
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    Receita total: {fmt(totalRevenue)}
                  </p>
                </div>
                <span className="self-start shrink-0 rounded-full bg-[#f4fff4] px-3 py-1 text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-[#2d652d]">
                  {events.length} itens
                </span>
              </div>

              <div className="mt-6 space-y-3 max-h-[400px] overflow-y-auto">
                {events.length === 0 ? (
                  <p className="text-sm text-slate-400">
                    Nenhuma consulta registrada.
                  </p>
                ) : (
                  events.slice(0, 6).map((item) => {
                    const st =
                      STATUS_CONSULTA_UI[item.status ?? "confirmado"] ??
                      STATUS_CONSULTA_UI.confirmado;
                    const tipo =
                      item.tipoConsulta && TIPO_CONSULTA_UI[item.tipoConsulta];
                    const podeFinalizar =
                      item.status !== "realizado" &&
                      item.status !== "cancelado" &&
                      item.status !== "faltou";

                    return (
                    <div
                      key={String(item.id)}
                      className="rounded-3xl border border-slate-200 bg-[#f8fff8] p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-950">
                            {item.patient ?? "Paciente"}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            {tipo && (
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${tipo.color}`}
                              >
                                {tipo.label}
                              </span>
                            )}
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${st.color}`}
                            >
                              {st.label}
                            </span>
                          </div>
                          <p className="truncate text-sm text-slate-600 mt-0.5">
                            {item.service ?? "Consulta médica"}
                          </p>
                          {item.googleEventId && (
                            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600">
                              <svg
                                className="h-3 w-3"
                                viewBox="0 0 24 24"
                                fill="#4285F4"
                              >
                                <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z" />
                              </svg>
                              Google
                            </span>
                          )}
                        </div>
                        <div className="flex flex-row flex-wrap gap-2 sm:shrink-0 sm:flex-col sm:items-end">
                          {podeFinalizar && (
                            <button
                              type="button"
                              disabled={savingFinalizar}
                              onClick={() => setFinalizando(item)}
                              className="inline-flex flex-1 sm:flex-none items-center justify-center gap-1 rounded-full bg-[#013a01] px-3 py-2 sm:py-1 text-xs font-semibold text-white transition hover:bg-[#025201] disabled:opacity-50 touch-manipulation"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              Finalizar
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveConsultation(item)}
                            className="inline-flex flex-1 sm:flex-none items-center justify-center rounded-full bg-red-50 px-3 py-2 sm:py-1 text-xs font-semibold text-red-600 transition hover:bg-red-100 touch-manipulation"
                          >
                            Excluir
                          </button>
                        </div>
                      </div>
                      <p className="mt-3 text-sm text-slate-600">
                        {item.start?.toString().replace("T", " ").slice(0, 16)}
                      </p>
                      {item.location && (
                        <p className="mt-1 truncate text-xs text-blue-500">
                          📍 {item.location}
                        </p>
                      )}
                      <p className="mt-2 text-lg font-semibold text-slate-950">
                        {item.status === "realizado" && item.payment
                          ? fmt(item.payment.valorPago)
                          : fmt(item.value ?? 0)}
                      </p>
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
          allEvents={events}
          isClinica={isClinica}
          medicos={medicosOptions}
          defaultLocation={enderecoFormatado}
          saving={savingAgendaModal}
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
          deleting={deletingAgendaModal}
        />
      )}

      {finalizando && (
        <FinalizarConsultaModal
          consulta={finalizando}
          allEvents={events}
          medicos={medicosOptions}
          isClinica={isClinica}
          onClose={() => setFinalizando(null)}
          onConfirm={handleFinalizarConsulta}
        />
      )}
    </main>
  );
}
