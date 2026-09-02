"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useCustomSession } from "@/lib/useSession";
import { isTestProfileOwner } from "@/lib/constants";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Users,
  Plus,
  Search,
  Phone,
  Mail,
  FileText,
  Calendar,
  MessageSquare,
  Wallet,
  Trash2,
  Pencil,
  Loader2,
  Link2,
  Cloud,
  MessageCircle,
  RefreshCw,
  CheckCircle2,
  Contact,
  CalendarPlus,
  BarChart3,
  Merge,
} from "lucide-react";
import UnificarClientesModal from "@/components/UnificarClientesModal";
import ClienteFormModal, {
  type ClienteFormSeed,
} from "@/components/ClienteFormModal";
import AgendaConsultaModal, {
  type AgendaConsultaPayload,
} from "@/components/AgendaConsultaModal";
import PrimeirosPassosHint from "@/components/PrimeirosPassosHint";
import GoogleConnectionAlert from "@/components/GoogleConnectionAlert";
import { useGoogleConnectionHealth } from "@/lib/useGoogleConnectionHealth";
import { useToast } from "@/components/ToastProvider";
import { useConfirm } from "@/components/ConfirmProvider";
import {
  fetchGoogleContatos,
  invalidatePacientesOpcoesClientCache,
  warmGoogleContactsCache,
} from "@/lib/pacientesOpcoesClient";
import { invalidateClientesListCache } from "@/lib/clientesListCache";
import FinalizarAtendimentoModal, {
  type FinalizarAtendimentoPayload,
} from "@/components/FinalizarAtendimentoModal";
import EditarAtendimentoModal, {
  type EditarAtendimentoPayload,
} from "@/components/EditarAtendimentoModal";
import AtendimentoItensEditor from "@/components/AtendimentoItensEditor";
import type { AtendimentoItemLinha } from "@/lib/atendimentoItens";
import { calcularTotalItens } from "@/lib/atendimentoItens";
import type {
  Cliente,
  ClienteAtendimento,
  PacienteOpcao,
  ClienteObservacao,
  ClientePagamento,
} from "@/lib/types";
import type { ClienteDetalheEnriquecido } from "@/lib/clienteFicha";
import {
  allAtendimentosOrdenados,
  formatAnamneseValor,
} from "@/lib/clienteFicha";
import {
  ATENDIMENTO_LABEL,
  FORMAS_PAGAMENTO,
  STATUS_ATENDIMENTO,
  STATUS_PAGAMENTO,
  formatCurrency,
} from "@/lib/constants";
import MedicoSelect from "@/components/MedicoSelect";
import CurrencyInput from "@/components/CurrencyInput";
import { formatValorBRLInput, parseValorBRL } from "@/lib/moeda";
import type { AnamneseCampo } from "@/lib/anamnese";
import { clientesApiToOpcoes, fetchPacienteOpcaoByDriveId, mergeOpcoesLista, selFromDriveId } from "@/lib/pacienteOpcoesUi";
import {
  createConsultationEvent,
  loadConsultations,
  saveConsultations,
  isSessaoAberta,
  labelStatusConsulta,
  type ConsultaStatus,
} from "@/lib/consultations";
import {
  dedupeConsultations,
  syncConsultaToServerImmediately,
} from "@/lib/syncConsultasClient";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";
import type { ConsultationRecord } from "@/lib/consultations";
import {
  fetchPerfilAgenda,
  readPerfilCacheStale,
  type PerfilAgendaFields,
} from "@/lib/perfilCache";
import {
  profissionalIdByNome,
  profissionalHasAgendaConnected,
} from "@/lib/loadMedicosOptions";
import { useMedicosOptions } from "@/lib/useMedicosOptions";
import {
  resolveMedicoValue,
  validateMedicoSelection,
} from "@/lib/loadMedicosOptions";
import { isFormularioImportRecente } from "@/lib/clienteFormularioImport";

type Tab = "resumo" | "atendimentos" | "observacoes" | "pagamentos";

const CLIENTES_PAGE_SIZE = 50;

export default function ClientesPageClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session } = useCustomSession();
  const toast = useToast();
  const { confirm } = useConfirm();
  const userEmail = session?.user?.email ?? null;
  const isTestProfile = isTestProfileOwner(session?.user?.email);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [duplicatas, setDuplicatas] = useState<
    Array<{
      primaryId: string;
      primaryNome: string;
      secondaryId: string;
      secondaryNome: string;
      motivo: string;
    }>
  >([]);
  const [busca, setBusca] = useState("");
  const [somenteComAtendimentos, setSomenteComAtendimentos] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [totalClientes, setTotalClientes] = useState(0);
  const [listError, setListError] = useState<string | null>(null);
  const [cleaningPlanilhaImport, setCleaningPlanilhaImport] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<ClienteDetalheEnriquecido | null>(null);
  const [loadingDetalhe, setLoadingDetalhe] = useState(false);
  const [tab, setTab] = useState<Tab>("resumo");

  const { medicos: medicosOptions, profissionais, isClinica } = useMedicosOptions();
  const [atendMedicoErro, setAtendMedicoErro] = useState<string | undefined>();
  const [showFinalizarModal, setShowFinalizarModal] = useState(false);
  const [finalizandoAtendimento, setFinalizandoAtendimento] = useState(false);
  const [finalizarErro, setFinalizarErro] = useState<string | null>(null);

  const [showClienteModal, setShowClienteModal] = useState(false);
  const [editingClienteId, setEditingClienteId] = useState<string | null>(null);
  const [googleImportResourceName, setGoogleImportResourceName] = useState<string | null>(null);
  const [clienteModalSeed, setClienteModalSeed] = useState<ClienteFormSeed | null>(null);
  const [anamneseCampos, setAnamneseCampos] = useState<AnamneseCampo[]>([]);

  const [atendForm, setAtendForm] = useState({
    data: format(new Date(), "yyyy-MM-dd"),
    hora: "",
    medico: "",
    valor: "",
    status: "realizado",
    observacoes: "",
  });
  const [atendCatalogoItens, setAtendCatalogoItens] = useState<AtendimentoItemLinha[]>([]);
  const [atendValorManual, setAtendValorManual] = useState(false);
  const [editandoAtendimentoId, setEditandoAtendimentoId] = useState<string | null>(null);
  const [salvandoEdicaoAtendimento, setSalvandoEdicaoAtendimento] = useState(false);
  const [editarAtendimentoErro, setEditarAtendimentoErro] = useState<string | null>(null);
  const [obsForm, setObsForm] = useState({ texto: "" });
  const [pagForm, setPagForm] = useState({
    data: format(new Date(), "yyyy-MM-dd"),
    valor: "",
    status: "pago",
    forma_pagamento: "pix",
    atendimento_id: "",
    observacao: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [restoringAgenda, setRestoringAgenda] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const { data: googleHealth, showAlert: googleHealthAlert } =
    useGoogleConnectionHealth();
  const [syncingForms, setSyncingForms] = useState(false);
  const [googleImportMsg, setGoogleImportMsg] = useState<string | null>(null);
  const [formLink, setFormLink] = useState<string | null>(null);
  const [formWhatsApp, setFormWhatsApp] = useState<string | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [agendamentoLink, setAgendamentoLink] = useState<string | null>(null);
  const [agendamentoWhatsApp, setAgendamentoWhatsApp] = useState<string | null>(null);
  const [generatingAgendamento, setGeneratingAgendamento] = useState(false);
  const [showUnificarModal, setShowUnificarModal] = useState(false);
  const [buscarGoogleMode, setBuscarGoogleMode] = useState(false);
  const [googleBusca, setGoogleBusca] = useState("");
  const [googleContatosBusca, setGoogleContatosBusca] = useState<PacienteOpcao[]>([]);
  const [googleContatosSelecionados, setGoogleContatosSelecionados] = useState<Set<string>>(
    () => new Set(),
  );
  const [loadingGoogleContatos, setLoadingGoogleContatos] = useState(false);
  const [importandoGoogle, setImportandoGoogle] = useState(false);
  const [googleContatosAviso, setGoogleContatosAviso] = useState<string | null>(null);
  const buscaRef = useRef(busca);
  const googleBuscaRef = useRef(googleBusca);
  const skipBuscaDebounceRef = useRef(true);
  const listScrollRef = useRef<HTMLDivElement>(null);
  const [portalReady, setPortalReady] = useState(false);
  const [agendaModalOpen, setAgendaModalOpen] = useState(false);
  const [agendaModalClienteId, setAgendaModalClienteId] = useState<string | null>(null);
  const [agendaSlot, setAgendaSlot] = useState<{ start: Date; end: Date } | null>(null);
  const [savingAgenda, setSavingAgenda] = useState(false);
  const [agendaSavedMsg, setAgendaSavedMsg] = useState<string | null>(null);
  const [duracaoPadraoMin, setDuracaoPadraoMin] = useState<number | null>(null);
  const [profile, setProfile] = useState<PerfilAgendaFields | null>(() =>
    userEmail ? readPerfilCacheStale(userEmail) : null,
  );

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const clientesIniciais = useMemo<PacienteOpcao[]>(
    () => clientesApiToOpcoes(clientes),
    [clientes],
  );

  const clientesAgendaModal = useMemo(() => {
    if (!agendaModalClienteId) return clientesIniciais;
    const sel = selFromDriveId(agendaModalClienteId);
    if (clientesIniciais.some((c) => c.id === sel)) return clientesIniciais;
    // Garante o cliente aberto no detalhe (mesmo se a busca da lista o filtrou fora da página).
    if (detalhe && selFromDriveId(detalhe.id) === sel) {
      return mergeOpcoesLista(
        clientesIniciais,
        clientesApiToOpcoes([
          {
            ...detalhe,
            atendimentos_count: detalhe.atendimentos?.length,
          },
        ]),
      );
    }
    return clientesIniciais;
  }, [clientesIniciais, agendaModalClienteId, detalhe]);

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
    if (partes.length === 0 && profile.address) partes.push(profile.address);
    return partes.join(", ");
  }, [profile]);

  const titularNome = useMemo(() => {
    if (!profile) return "";
    return profile.clinic_name || profile.full_name || "";
  }, [profile]);

  useEffect(() => {
    buscaRef.current = busca;
  }, [busca]);

  useEffect(() => {
    googleBuscaRef.current = googleBusca;
  }, [googleBusca]);

  useEffect(() => {
    fetch("/api/config/anamnese")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.campos)) setAnamneseCampos(d.campos);
      })
      .catch(() => setAnamneseCampos([]));
  }, []);

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
    if (!userEmail) return;
    void fetchPerfilAgenda(userEmail).then((p) => {
      if (p) setProfile(p);
    });
  }, [userEmail]);

  function connectDrive() {
    const redirect = encodeURIComponent("/clientes");
    window.location.href = `/api/auth/google-authorize?scope=drive&redirect=${redirect}`;
  }

  const loadClientes = useCallback(async (q?: string, options?: { append?: boolean }) => {
    const append = options?.append === true;
    const savedScrollTop = !append ? (listScrollRef.current?.scrollTop ?? 0) : 0;
    if (append) {
      setLoadingMore(true);
    } else {
      setLoadingList(true);
    }
    setListError(null);
    try {
      const search = new URLSearchParams();
      if (q) search.set("q", q);
      if (isTestProfile && somenteComAtendimentos) search.set("com_atendimentos", "1");
      search.set("limit", String(CLIENTES_PAGE_SIZE));
      search.set("offset", append ? String(clientes.length) : "0");
      const res = await fetch(`/api/clientes?${search.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "DRIVE_NOT_CONNECTED") setDriveError(data.error);
        throw new Error(data.error || "Erro ao carregar clientes");
      }
      setDriveError(null);
      const next = (data.clientes ?? []) as Cliente[];
      setClientes((prev) => (append ? [...prev, ...next] : next));
      setHasMore(data.hasMore === true);
      setTotalClientes(typeof data.total === "number" ? data.total : next.length);
      if (!q) {
        setDuplicatas(Array.isArray(data.duplicatas) ? data.duplicatas : []);
      } else if (!append) {
        setDuplicatas([]);
      }
    } catch (e: unknown) {
      setListError(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      if (append) {
        setLoadingMore(false);
      } else {
        setLoadingList(false);
        requestAnimationFrame(() => {
          if (listScrollRef.current) listScrollRef.current.scrollTop = savedScrollTop;
        });
      }
    }
  }, [clientes.length, isTestProfile, somenteComAtendimentos]);

  const loadDetalhe = useCallback(async (id: string) => {
    setLoadingDetalhe(true);
    try {
      const res = await fetch(`/api/clientes/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao carregar cliente");
      setDetalhe(data.cliente);
      const count = data.cliente?.atendimentos?.length;
      if (typeof count === "number") {
        setClientes((prev) =>
          prev.map((c) =>
            c.id === data.cliente.id ? { ...c, atendimentos_count: count } : c,
          ),
        );
      }
    } catch {
      setDetalhe(null);
    } finally {
      setLoadingDetalhe(false);
    }
  }, []);

  async function restaurarAtendimentosDaAgenda() {
    if (!selectedId) return;
    setRestoringAgenda(true);
    try {
      const res = await fetch("/api/consultas/repair-cliente-atendimentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clienteId: selectedId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao restaurar da agenda");
      await loadDetalhe(selectedId);
      if (data.atendimentos_created > 0) {
        window.alert(
          `Restaurado(s) ${data.atendimentos_created} atendimento(s) da agenda na ficha (sem duplicar financeiro).`,
        );
      } else {
        window.alert(
          "Nenhum atendimento novo para restaurar. Se já finalizou na agenda, confira Financeiro em 08/06 antes de lançar de novo.",
        );
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Erro ao restaurar");
    } finally {
      setRestoringAgenda(false);
    }
  }

  const cleanupPlanilhaImport = useCallback(async () => {
    if (!isTestProfile) return;
    setCleaningPlanilhaImport(true);
    setListError(null);
    try {
      const dryRes = await fetch("/api/clientes/cleanup-import-planilha?dryRun=1", {
        method: "POST",
      });
      const preview = await dryRes.json();
      if (!dryRes.ok) throw new Error(preview.error || "Não foi possível analisar a lista");

      if (preview.removidos === 0) {
        window.alert("Nenhum cadastro lixo da importação planilha (sem atendimentos) para remover.");
        return;
      }

      const ok = window.confirm(
        `Remover ${preview.removidos} cadastro(s) da importação planilha?\n` +
          `Serão mantidos ${preview.mantidos} cadastro(s) (com atendimentos ou sem tag de import).`,
      );
      if (!ok) return;

      const res = await fetch("/api/clientes/cleanup-import-planilha", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao limpar cadastros");

      invalidateClientesListCache(userEmail ?? "");
      setSelectedId(null);
      setDetalhe(null);
      await loadClientes(buscaRef.current);
      window.alert(`Limpeza concluída: ${data.removidos} cadastro(s) removido(s).`);
    } catch (e: unknown) {
      setListError(e instanceof Error ? e.message : "Erro na limpeza");
    } finally {
      setCleaningPlanilhaImport(false);
    }
  }, [isTestProfile, loadClientes, userEmail]);

  const syncFormularios = useCallback(async () => {
    setSyncingForms(true);
    try {
      const res = await fetch("/api/clientes/sync-formularios", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.sincronizados > 0) {
        if (selectedId) await loadDetalhe(selectedId);
        await loadClientes(buscaRef.current);
        const importados = Array.isArray(data.importados) ? data.importados : [];
        const nomes = importados
          .map((c: { nome?: string }) => c?.nome?.trim())
          .filter(Boolean)
          .slice(0, 4);
        const extra =
          nomes.length > 0
            ? `: ${nomes.join(", ")}${importados.length > nomes.length ? "…" : ""}`
            : "";
        toast.success(
          `${data.sincronizados} cadastro(s) importado(s) do formulário${extra}. Aparecem no topo com “Nova”.`,
        );
      }
    } catch {
      /* ignore */
    } finally {
      setSyncingForms(false);
    }
  }, [selectedId, loadDetalhe, loadClientes, toast]);

  useEffect(() => {
    if (medicosOptions.length === 1 && !atendForm.medico) {
      setAtendForm((f) => ({ ...f, medico: medicosOptions[0] }));
    }
  }, [medicosOptions, atendForm.medico]);

  useEffect(() => {
    if (!googleHealthAlert || !googleHealth) return;
    if (
      googleHealth.needsConnect ||
      googleHealth.needsReconnect ||
      googleHealth.healthy === false ||
      googleHealth.driveHealthy === false
    ) {
      setDriveError(
        googleHealth.summary ||
          "Conexão com Google Drive necessária. Reconecte sua conta Google.",
      );
    }
  }, [googleHealthAlert, googleHealth]);

  useEffect(() => {
    loadClientes();
    void syncFormularios();
    void fetch('/api/clientes/sync-agendamentos', { method: 'POST' }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carga inicial única
  }, []);

  useEffect(() => {
    const connected = searchParams.get("google_connected");
    if (connected === "contacts" && !driveError) {
      void warmGoogleContactsCache().catch(() => {});
      router.replace("/clientes", { scroll: false });
    }
  }, [searchParams, driveError, router]);

  useEffect(() => {
    if (searchParams.get("finalizar") === "1") {
      setShowFinalizarModal(true);
      router.replace("/clientes", { scroll: false });
    }
  }, [searchParams, router]);

  /** Deep-link pós-importação do autocadastro: /clientes?cliente=<id> */
  useEffect(() => {
    const clienteId = searchParams.get("cliente")?.trim();
    if (!clienteId) return;
    setSelectedId(clienteId);
    setTab("resumo");
    router.replace("/clientes", { scroll: false });
  }, [searchParams, router]);

  useEffect(() => {
    if (skipBuscaDebounceRef.current) {
      skipBuscaDebounceRef.current = false;
      return;
    }
    const t = setTimeout(() => loadClientes(busca), 300);
    return () => clearTimeout(t);
  }, [busca, loadClientes]);

  useEffect(() => {
    void loadClientes(buscaRef.current);
  }, [somenteComAtendimentos, loadClientes]);

  useEffect(() => {
    if (selectedId) {
      loadDetalhe(selectedId);
      setFormLink(null);
      setFormWhatsApp(null);
      setAgendamentoLink(null);
      setAgendamentoWhatsApp(null);
    } else setDetalhe(null);
  }, [selectedId, loadDetalhe]);

  async function gerarLinkAgendamento() {
    if (!selectedId) return;
    setGeneratingAgendamento(true);
    try {
      const res = await fetch(`/api/clientes/${selectedId}/agendamento-link`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao gerar link');
      setAgendamentoLink(data.link);
      setAgendamentoWhatsApp(data.whatsapp_url);
      if (data.link) await navigator.clipboard.writeText(data.link);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erro');
    } finally {
      setGeneratingAgendamento(false);
    }
  }

  async function gerarLinkFormulario() {
    if (!selectedId) return;
    setGeneratingLink(true);
    try {
      const res = await fetch(`/api/clientes/${selectedId}/formulario-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao gerar link");
      setFormLink(data.link);
      setFormWhatsApp(data.whatsapp_url);
      if (data.link) await navigator.clipboard.writeText(data.link);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Erro");
    } finally {
      setGeneratingLink(false);
    }
  }

  useEffect(() => {
    if (!buscarGoogleMode) {
      setGoogleContatosBusca([]);
      setGoogleContatosAviso(null);
      setLoadingGoogleContatos(false);
      setGoogleContatosSelecionados(new Set());
      return;
    }
    const q = googleBusca.trim();
    if (q.length < 2) {
      setGoogleContatosBusca([]);
      setGoogleContatosAviso(null);
      setLoadingGoogleContatos(false);
      return;
    }
    setLoadingGoogleContatos(true);
    const t = setTimeout(() => {
      void fetchGoogleContatos({ q, limit: 25 })
        .then((d) => {
          if (googleBuscaRef.current.trim() !== q) return;
          setGoogleContatosBusca(d.contatos);
          setGoogleContatosAviso(d.aviso);
          setGoogleContatosSelecionados((prev) => {
            const valid = new Set(d.contatos.map((c) => c.id));
            const next = new Set<string>();
            for (const id of prev) {
              if (valid.has(id)) next.add(id);
            }
            return next;
          });
        })
        .catch((e: unknown) => {
          if (googleBuscaRef.current.trim() !== q) return;
          setGoogleContatosBusca([]);
          setGoogleContatosAviso(
            e instanceof Error ? e.message : "Erro ao buscar Contatos Google.",
          );
        })
        .finally(() => {
          if (googleBuscaRef.current.trim() === q) setLoadingGoogleContatos(false);
        });
    }, 300);
    return () => clearTimeout(t);
  }, [googleBusca, buscarGoogleMode]);

  const historicoAtendimentos = useMemo(() => {
    if (!detalhe) return [];
    return allAtendimentosOrdenados(detalhe);
  }, [detalhe]);

  const ultimosAtendimentos = useMemo(
    () => historicoAtendimentos.slice(0, 5),
    [historicoAtendimentos],
  );

  function irAgendarConsulta(clienteId?: string) {
    const raw = clienteId || selectedId;
    if (!raw) {
      alert("Selecione um cliente na lista para agendar.");
      return;
    }
    if (raw.startsWith("g:")) {
      alert(
        "Este contato é do Google Contatos (somente leitura). Use \"Salvar no sistema\" antes de agendar.",
      );
      return;
    }
    if (driveError) {
      alert("Conecte o Google Drive no Dashboard antes de agendar.");
      return;
    }
    const clienteParam = raw.startsWith("d:") ? raw : `d:${raw}`;
    invalidatePacientesOpcoesClientCache();

    const start = new Date();
    start.setSeconds(0, 0);
    const m = start.getMinutes();
    if (m > 0 && m <= 30) start.setMinutes(30);
    else if (m > 30) {
      start.setHours(start.getHours() + 1);
      start.setMinutes(0);
    }
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + (duracaoPadraoMin ?? 30));

    setAgendaModalClienteId(clienteParam);
    setAgendaSlot({ start, end });
    setAgendaModalOpen(true);
    setAgendaSavedMsg(null);
  }

  async function confirmAgendarFromClientes(payload: AgendaConsultaPayload) {
    setSavingAgenda(true);
    setAgendaSavedMsg(null);
    try {
      const medicoNome = payload.medico.trim() || undefined;
      const medicoProfId = medicoNome
        ? profissionalIdByNome(profissionais, medicoNome)
        : undefined;
      const googleProfId =
        medicoNome && profissionalHasAgendaConnected(profissionais, medicoNome)
          ? medicoProfId
          : undefined;

      const localEvent = {
        ...createConsultationEvent({
          patient: payload.patient,
          service: payload.service,
          value: payload.value,
          start: payload.start,
          end: payload.end,
          location: payload.location || enderecoFormatado || undefined,
          telefone: payload.telefone,
          lembretesWhatsapp: payload.lembretesWhatsapp,
          medico: medicoNome,
          medicoProfissionalId: medicoProfId,
          observacoes: payload.observacoes,
          clienteDriveId: payload.clienteDriveId ?? null,
          isDraft: false,
        }),
        googleProfissionalId: googleProfId,
      };

      const current = loadConsultations();
      const merged = dedupeConsultations([localEvent, ...current]);
      saveConsultations(merged);

      const syncResult = await syncConsultaToServerImmediately(localEvent);
      if (!syncResult.ok) {
        throw new Error(syncResult.error);
      }

      invalidatePacientesOpcoesClientCache();

      void pushClienteAgendaToGoogleInBackground(
        localEvent,
        merged,
        payload,
        medicoNome,
        googleProfId,
      );

      return String(localEvent.id);
    } finally {
      setSavingAgenda(false);
    }
  }

  function pushClienteAgendaToGoogleInBackground(
    localEvent: ConsultationRecord,
    merged: ConsultationRecord[],
    payload: AgendaConsultaPayload,
    medicoNome: string | undefined,
    googleProfId: string | undefined,
  ) {
    void (async () => {
      try {
        const res = await fetchWithTimeout("/api/google-calendar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            summary: `${localEvent.service || "Atendimento"} - ${payload.patient}`,
            description: `Cliente: ${payload.patient}\nServiço: ${localEvent.service}\nProfissional: ${medicoNome ?? ""}`,
            start: payload.start.toISOString(),
            end: payload.end.toISOString(),
            clienteDriveId: payload.clienteDriveId ?? undefined,
            nomeCliente: payload.patient,
            ...(googleProfId ? { profissionalId: googleProfId } : {}),
          }),
        });
        if (!res.ok) return;
        const googleEvent = (await res.json()) as { id?: string };
        if (!googleEvent.id) return;
        const withGoogle = { ...localEvent, googleEventId: googleEvent.id };
        saveConsultations(
          dedupeConsultations(
            merged.map((e) =>
              String(e.id) === String(localEvent.id) ? withGoogle : e,
            ),
          ),
        );
        await syncConsultaToServerImmediately(withGoogle);
      } catch {
        /* Google opcional — agenda e Supabase já salvos */
      }
    })();
  }

  function abrirSalvarGoogleContato(contato: PacienteOpcao) {
    setEditingClienteId(null);
    setClienteModalSeed({
      nome: contato.nome,
      email: contato.email ?? "",
      telefone: contato.telefone ?? "",
      data_nascimento: contato.data_nascimento ?? "",
    });
    setGoogleImportResourceName(contato.googleResourceName ?? null);
    setShowClienteModal(true);
  }

  function toggleGoogleContatoSelecionado(id: string) {
    setGoogleContatosSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function contatoParaImportPayload(contato: PacienteOpcao) {
    return {
      nome: contato.nome,
      email: contato.email,
      telefone: contato.telefone,
      data_nascimento: contato.data_nascimento,
      googleResourceName: contato.googleResourceName ?? "",
    };
  }

  async function importarContatosGoogle(contatos: PacienteOpcao[]) {
    if (driveError || contatos.length === 0) return;
    setImportandoGoogle(true);
    setGoogleImportMsg(null);
    try {
      const res = await fetch("/api/clientes/import-google-contatos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contatos: contatos.map(contatoParaImportPayload),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao importar contatos");
      setGoogleImportMsg(
        `${data.criados ?? 0} cliente(s) importado(s)${data.ignorados ? `, ${data.ignorados} ignorado(s)` : ""}.`,
      );
      setGoogleContatosSelecionados(new Set());
      invalidatePacientesOpcoesClientCache();
      invalidateClientesListCache();
      await loadClientes(buscaRef.current);
      if (googleBuscaRef.current.trim().length >= 2) {
        const d = await fetchGoogleContatos({
          q: googleBuscaRef.current.trim(),
          limit: 25,
        });
        setGoogleContatosBusca(d.contatos);
        setGoogleContatosAviso(d.aviso);
      }
      const primeiro = data.clientes?.[0];
      if (primeiro?.id) setSelectedId(primeiro.id);
    } catch (e: unknown) {
      setGoogleImportMsg(
        e instanceof Error ? e.message : "Erro ao importar contatos",
      );
    } finally {
      setImportandoGoogle(false);
    }
  }

  const resumoFinanceiro = useMemo(() => {
    if (!detalhe) return { pago: 0, pendente: 0, atendimentos: 0 };
    let pago = 0;
    let pendente = 0;
    for (const p of detalhe.pagamentos) {
      if (p.status === "pago") pago += Number(p.valor);
      else if (p.status === "pendente" || p.status === "parcial") pendente += Number(p.valor);
    }
    return { pago, pendente, atendimentos: detalhe.atendimentos.length };
  }, [detalhe]);

  function openNovoCliente() {
    setEditingClienteId(null);
    setGoogleImportResourceName(null);
    setClienteModalSeed(null);
    setShowClienteModal(true);
  }

  function openEditarCliente(c: Cliente | ClienteDetalheEnriquecido) {
    setEditingClienteId(c.id);
    setGoogleImportResourceName(null);
    const seed: ClienteFormSeed = {
      id: c.id,
      nome: c.nome,
      email: c.email,
      telefone: c.telefone,
      cpf: c.cpf,
      data_nascimento: c.data_nascimento,
    };
    if ("observacoes_gerais" in c) {
      seed.observacoes_gerais = c.observacoes_gerais ?? "";
    }
    if ("anamnese_respostas" in c) {
      seed.anamnese_respostas = (c as ClienteDetalheEnriquecido).anamnese_respostas ?? undefined;
    }
    if ("atendimentos" in c && detalhe?.id === c.id) {
      seed.atendimentos = (c as ClienteDetalheEnriquecido).atendimentos;
    }
    setClienteModalSeed(seed);
    setShowClienteModal(true);
  }

  function irRegistrarAtendimento() {
    setTab("atendimentos");
  }

  async function handleClienteSaved(result: {
    id: string;
    cliente?: ClienteDetalheEnriquecido;
    editing: boolean;
  }) {
    setGoogleImportResourceName(null);
    invalidateClientesListCache();
    invalidatePacientesOpcoesClientCache();
    await loadClientes(busca);
    setSelectedId(result.id);
    if (result.editing && result.cliente) {
      setDetalhe(result.cliente);
    } else if (result.editing) {
      await loadDetalhe(result.id);
    }
    toast.success(result.editing ? "Cliente atualizado." : "Cliente cadastrado.");
  }

  function closeClienteModal() {
    setShowClienteModal(false);
    setGoogleImportResourceName(null);
    setClienteModalSeed(null);
    setEditingClienteId(null);
  }

  function abrirFinalizarAtendimento() {
    setFinalizarErro(null);
    setShowFinalizarModal(true);
  }

  async function confirmarFinalizarAtendimento(payload: FinalizarAtendimentoPayload) {
    setFinalizandoAtendimento(true);
    setFinalizarErro(null);
    try {
      const res = await fetch("/api/clientes/atendimento-avulso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente_id: payload.clienteId || selectedId || null,
          paciente_sel: payload.pacienteSel || (payload.clienteId ? `d:${payload.clienteId}` : undefined),
          nome: payload.nome,
          telefone: payload.telefone,
          lembretes_whatsapp: payload.lembretesWhatsapp,
          data: payload.data,
          hora: payload.hora || null,
          valor: payload.valorOriginal,
          valorOriginal: payload.valorOriginal,
          descontoPercent: payload.descontoPercent,
          descontoValor: payload.descontoValor,
          forma_pagamento: payload.formaPagamento,
          medico: payload.medico || null,
          percentual_profissional: payload.percentualProfissional,
          parcelas: payload.parcelas,
          tipo: payload.tipo,
          observacoes: payload.observacoes || null,
          catalogo_itens: payload.catalogoItens,
          anamnese_respostas:
            Object.keys(payload.anamneseRespostas).length > 0
              ? payload.anamneseRespostas
              : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const errMsg =
          typeof data.error === "string"
            ? data.error
            : data.error?.message
              ? String(data.error.message)
              : "Erro ao finalizar atendimento";
        if (data.code === "DRIVE_NOT_CONNECTED") setDriveError(errMsg);
        setFinalizarErro(errMsg);
        return;
      }
      setShowFinalizarModal(false);
      setFinalizarErro(null);
      toast.success("Atendimento finalizado com sucesso.");
      await loadClientes(busca);
      if (data.cliente?.id) {
        setSelectedId(data.cliente.id);
        setTab("atendimentos");
        await loadDetalhe(data.cliente.id);
      }
    } catch (err: unknown) {
      setFinalizarErro(err instanceof Error ? err.message : "Erro ao finalizar atendimento");
    } finally {
      setFinalizandoAtendimento(false);
    }
  }

  async function excluirCliente(id: string) {
    const ok = await confirm({
      title: "Excluir cliente",
      message: "Excluir este cliente e todo o histórico? Esta ação não pode ser desfeita.",
      confirmLabel: "Excluir",
      variant: "danger",
    });
    if (!ok) return;
    const res = await fetch(`/api/clientes/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error || "Erro ao excluir");
      return;
    }
    toast.success("Cliente excluído.");
    if (selectedId === id) {
      setSelectedId(null);
      setDetalhe(null);
    }
    invalidateClientesListCache();
    loadClientes(busca);
  }

  const onAtendCatalogoTotalChange = useCallback((total: number) => {
    if (total > 0 && !atendValorManual) {
      setAtendForm((f) => ({ ...f, valor: formatValorBRLInput(total) }));
    }
  }, [atendValorManual]);

  async function confirmarEditarAtendimento(payload: EditarAtendimentoPayload) {
    if (!selectedId || !editandoAtendimentoId) return;
    setSalvandoEdicaoAtendimento(true);
    setEditarAtendimentoErro(null);
    try {
      const res = await fetch(
        `/api/clientes/${selectedId}/atendimentos/${editandoAtendimentoId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data: payload.data,
            hora: payload.hora,
            medico: payload.medico,
            valor: payload.valor,
            status: payload.status,
            observacoes: payload.observacoes,
            catalogo_itens: payload.catalogoItens,
            forma_pagamento: payload.formaPagamento,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao salvar atendimento");
      setEditandoAtendimentoId(null);
      await loadDetalhe(selectedId);
    } catch (err: unknown) {
      setEditarAtendimentoErro(err instanceof Error ? err.message : "Erro ao salvar atendimento");
    } finally {
      setSalvandoEdicaoAtendimento(false);
    }
  }

  async function adicionarAtendimento(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    const medicoErr = validateMedicoSelection(
      medicosOptions,
      atendForm.medico,
      isClinica,
    );
    if (medicoErr) {
      setAtendMedicoErro(medicoErr);
      return;
    }
    setAtendMedicoErro(undefined);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/clientes/${selectedId}/atendimentos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...atendForm,
          tipo: "consulta",
          medico: resolveMedicoValue(medicosOptions, atendForm.medico) || null,
          valor: atendForm.valor
            ? parseValorBRL(atendForm.valor)
            : atendCatalogoItens.some((i) => i.catalogoId)
              ? calcularTotalItens(atendCatalogoItens)
              : null,
          hora: atendForm.hora || null,
          catalogo_itens: atendCatalogoItens.filter((i) => i.catalogoId),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAtendForm((f) => ({ ...f, observacoes: "", valor: "" }));
      setAtendCatalogoItens([]);
      setAtendValorManual(false);
      await loadDetalhe(selectedId);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Erro");
    } finally {
      setSubmitting(false);
    }
  }

  async function adicionarObservacao(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/clientes/${selectedId}/observacoes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(obsForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setObsForm({ texto: "" });
      await loadDetalhe(selectedId);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Erro");
    } finally {
      setSubmitting(false);
    }
  }

  async function adicionarPagamento(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/clientes/${selectedId}/pagamentos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...pagForm,
          valor: parseValorBRL(pagForm.valor),
          atendimento_id: pagForm.atendimento_id || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPagForm((f) => ({ ...f, valor: "", observacao: "", atendimento_id: "" }));
      await loadDetalhe(selectedId);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Erro");
    } finally {
      setSubmitting(false);
    }
  }

  async function removerAtendimento(atendimentoId: string) {
    if (!selectedId) return;
    const ok = await confirm({
      title: "Remover atendimento",
      message: "Remover este atendimento do histórico do cliente?",
      confirmLabel: "Remover",
      variant: "danger",
    });
    if (!ok) return;
    const res = await fetch(`/api/clientes/${selectedId}/atendimentos/${atendimentoId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("Erro ao remover atendimento.");
      return;
    }
    toast.success("Atendimento removido.");
    loadDetalhe(selectedId);
  }

  async function removerObservacao(observacaoId: string) {
    if (!selectedId) return;
    const ok = await confirm({
      title: "Remover observação",
      message: "Remover esta observação?",
      confirmLabel: "Remover",
      variant: "danger",
    });
    if (!ok) return;
    const res = await fetch(`/api/clientes/${selectedId}/observacoes/${observacaoId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("Erro ao remover observação.");
      return;
    }
    toast.success("Observação removida.");
    loadDetalhe(selectedId);
  }

  async function removerPagamento(pagamentoId: string) {
    if (!selectedId) return;
    const ok = await confirm({
      title: "Remover pagamento",
      message: "Remover este pagamento?",
      confirmLabel: "Remover",
      variant: "danger",
    });
    if (!ok) return;
    const res = await fetch(`/api/clientes/${selectedId}/pagamentos/${pagamentoId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("Erro ao remover pagamento.");
      return;
    }
    toast.success("Pagamento removido.");
    loadDetalhe(selectedId);
  }

  function formatData(d: string) {
    try {
      return format(parseISO(d), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return d;
    }
  }

  const tabs: { id: Tab; label: string; icon: typeof Users }[] = [
    { id: "resumo", label: "Resumo", icon: FileText },
    { id: "atendimentos", label: "Atendimentos", icon: Calendar },
    { id: "observacoes", label: "Observações", icon: MessageSquare },
    { id: "pagamentos", label: "Pagamentos", icon: Wallet },
  ];

  const overlayOpen =
    showClienteModal ||
    showFinalizarModal ||
    showUnificarModal ||
    agendaModalOpen ||
    !!editandoAtendimentoId;

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
      <div className={overlayOpen ? "pointer-events-none select-none" : undefined}>
      <PrimeirosPassosHint
        hintId="hint-clientes-cadastro"
        title="Cadastro de clientes"
        message="Busque na lista, abra o cliente e use Agendar sessão — o nome já vem preenchido."
      />
      <GoogleConnectionAlert
        context="clientes"
        redirectPath="/clientes"
        className="mb-6"
      />
      {agendaSavedMsg && (
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-[#047482]/30 bg-[#eef4f5] px-4 py-3 text-sm text-[#035e6b]">
          <p className="flex-1">{agendaSavedMsg}</p>
          <Link
            href="/agenda"
            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-[#047482] px-4 py-2 text-xs font-semibold text-white hover:bg-[#035e6b]"
          >
            Abrir Agenda
          </Link>
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-7 h-7 text-[#047482]" />
            Clientes
          </h1>
          <p className="text-gray-500 mt-1">
            Dados no seu Google Drive · formulário por link · WhatsApp preparado
          </p>
          {!driveError && (
            <Link
              href="/clientes/relatorio"
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-[#047482] hover:text-[#035e6b] hover:underline"
            >
              <BarChart3 className="h-4 w-4" aria-hidden />
              Ver relatório de clientes
            </Link>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={abrirFinalizarAtendimento}
            disabled={!!driveError}
            className="inline-flex items-center justify-center gap-2 bg-[#047482] text-white px-5 py-2.5 rounded-xl font-medium hover:bg-[#035e6b] transition disabled:opacity-50"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span className="text-left">
              <span className="block">Atendimento avulso</span>
              <span className="block text-xs font-normal opacity-90">Lançar atendimento</span>
            </span>
          </button>
          <button
            type="button"
            onClick={openNovoCliente}
            className="inline-flex items-center justify-center gap-2 border-2 border-[#047482] text-[#047482] px-5 py-2.5 rounded-xl font-medium hover:bg-[var(--brand-bg-onboarding)] transition"
          >
            <Plus className="w-5 h-5" />
            Novo cliente
          </button>
          {!driveError && (
            <button
              type="button"
              onClick={() => setShowUnificarModal(true)}
              className="inline-flex items-center justify-center gap-2 border border-amber-300 text-amber-900 bg-amber-50 px-5 py-2.5 rounded-xl font-medium hover:bg-amber-100 transition"
              title="Mesclar cadastros duplicados"
            >
              <Merge className="w-5 h-5" />
              Unificar clientes
              {duplicatas.length > 0 && (
                <span className="ml-1 rounded-full bg-amber-600 text-white text-xs px-2 py-0.5">
                  {duplicatas.length}
                </span>
              )}
            </button>
          )}
          {!driveError && isTestProfile && (
            <button
              type="button"
              onClick={() => void cleanupPlanilhaImport()}
              disabled={cleaningPlanilhaImport}
              className="inline-flex items-center justify-center gap-2 border border-red-200 text-red-800 bg-red-50 px-5 py-2.5 rounded-xl font-medium hover:bg-red-100 transition disabled:opacity-50"
              title="Somente perfil de teste — remove importação planilha sem atendimentos"
            >
              {cleaningPlanilhaImport ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Trash2 className="w-5 h-5" />
              )}
              Limpar import. planilha
            </button>
          )}
        </div>
      </div>

      {!driveError && duplicatas.length > 0 && (
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex-1">
            <p className="font-medium text-amber-900">
              Possível duplicata — {duplicatas.length} par(es) detectado(s)
            </p>
            <p className="text-sm text-amber-800 mt-1">
              {duplicatas[0].primaryNome} e {duplicatas[0].secondaryNome}
              {duplicatas.length > 1 ? ` e mais ${duplicatas.length - 1}` : ""} ·{" "}
              {duplicatas[0].motivo}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowUnificarModal(true)}
            className="shrink-0 inline-flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700"
          >
            <Merge className="w-4 h-4" />
            Revisar e unificar
          </button>
        </div>
      )}

      {googleImportMsg && (
        <p
          className={`mb-4 text-sm rounded-xl px-4 py-2 ${
            googleImportMsg.includes("Erro") || googleImportMsg.includes("erro")
              ? "bg-red-50 text-red-700"
              : "bg-green-50 text-green-800"
          }`}
        >
          {googleImportMsg}
        </p>
      )}

      {driveError && (
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3 flex-1">
            <Cloud className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-900">Google Drive não conectado</p>
              <p className="text-sm text-amber-800 mt-1">{driveError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={connectDrive}
            className="shrink-0 bg-[#047482] text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            Conectar Drive
          </button>
        </div>
      )}

      <div className="grid lg:grid-cols-[320px_1fr] gap-6 min-h-[600px]">
        {/* Lista */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="search"
                placeholder="Buscar por nome, e-mail, telefone..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#3795a1]"
              />
            </div>
            {isTestProfile ? (
              <label className="mt-3 flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={somenteComAtendimentos}
                  onChange={(e) => setSomenteComAtendimentos(e.target.checked)}
                  className="rounded border-gray-300 text-[#047482] focus:ring-[#047482]"
                />
                <Calendar className="w-4 h-4 text-[#047482]" />
                Só clientes com atendimentos
              </label>
            ) : null}
            <label className="mt-2 flex items-center gap-2 cursor-pointer text-sm text-gray-700">
              <input
                type="checkbox"
                checked={buscarGoogleMode}
                onChange={(e) => {
                  const on = e.target.checked;
                  setBuscarGoogleMode(on);
                  if (!on) {
                    setGoogleBusca("");
                    setGoogleContatosBusca([]);
                    setGoogleContatosSelecionados(new Set());
                    setGoogleContatosAviso(null);
                  } else {
                    void warmGoogleContactsCache().catch(() => {});
                  }
                }}
                className="rounded border-gray-300 text-[#047482] focus:ring-[#047482]"
              />
              <Contact className="w-4 h-4 text-[#047482]" />
              Buscar no Google Contatos
            </label>
            {buscarGoogleMode && (
              <div className="mt-2 space-y-2 rounded-lg border border-[#3795a1]/30 bg-[#eef4f5] p-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="search"
                    placeholder="Buscar contatos Google (mín. 2 letras)..."
                    value={googleBusca}
                    onChange={(e) => setGoogleBusca(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#3795a1]"
                  />
                </div>
                {googleContatosAviso && (
                  <p className="text-xs text-amber-700">{googleContatosAviso}</p>
                )}
                {loadingGoogleContatos && googleBusca.trim().length >= 2 && (
                  <p className="text-xs text-gray-500 flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Buscando Contatos Google...
                  </p>
                )}
                {!loadingGoogleContatos &&
                  googleBusca.trim().length >= 2 &&
                  googleContatosBusca.length === 0 &&
                  !googleContatosAviso && (
                    <p className="text-xs text-gray-500">Nenhum contato encontrado.</p>
                  )}
                {googleContatosBusca.length > 0 && (
                  <ul className="max-h-48 overflow-y-auto space-y-1">
                    {googleContatosBusca.map((g) => (
                      <li
                        key={g.id}
                        className="flex items-start gap-2 rounded-lg bg-white border border-gray-100 p-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={googleContatosSelecionados.has(g.id)}
                          onChange={() => toggleGoogleContatoSelecionado(g.id)}
                          className="mt-1 rounded border-gray-300 text-[#047482] focus:ring-[#047482]"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-900 truncate">{g.nome}</p>
                          {g.telefone && (
                            <p className="text-xs text-gray-500 truncate">{g.telefone}</p>
                          )}
                          {g.email && (
                            <p className="text-xs text-gray-500 truncate">{g.email}</p>
                          )}
                          <button
                            type="button"
                            onClick={() => abrirSalvarGoogleContato(g)}
                            className="mt-1 text-xs font-medium text-[#047482] hover:underline"
                          >
                            Salvar no sistema
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {googleContatosSelecionados.size > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      void importarContatosGoogle(
                        googleContatosBusca.filter((g) => googleContatosSelecionados.has(g.id)),
                      )
                    }
                    disabled={importandoGoogle || !!driveError}
                    className="w-full py-2 rounded-lg bg-[#047482] text-white text-sm font-medium hover:bg-[#035e6b] disabled:opacity-50"
                  >
                    {importandoGoogle
                      ? "Importando..."
                      : `Importar selecionados (${googleContatosSelecionados.size})`}
                  </button>
                )}
              </div>
            )}
          </div>
          <div ref={listScrollRef} className="flex-1 overflow-y-auto overscroll-contain">
            {loadingList ? (
              <div className="p-8 text-center text-gray-500">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                Carregando...
              </div>
            ) : listError ? (
              <p className="p-4 text-sm text-red-600">{listError}</p>
            ) : clientes.length === 0 ? (
              <p className="p-6 text-sm text-gray-500 text-center">
                Nenhum cliente cadastrado.
                <br />
                Clique em &quot;Novo cliente&quot; para começar.
              </p>
            ) : (
              <ul>
                {clientes.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(c.id);
                        setTab("resumo");
                      }}
                      className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-[var(--brand-bg-onboarding)] transition ${
                        selectedId === c.id ? "bg-[var(--brand-bg-onboarding)] border-l-4 border-l-[#047482]" : ""
                      }`}
                    >
                      <p className="font-medium text-gray-900 truncate">{c.nome}</p>
                      {c.telefone && (
                        <p className="text-xs text-gray-500 mt-0.5">{c.telefone}</p>
                      )}
                      {typeof c.atendimentos_count === "number" && c.atendimentos_count > 0 && (
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          {c.atendimentos_count} atendimento{c.atendimentos_count === 1 ? "" : "s"}
                        </p>
                      )}
                      {isFormularioImportRecente(c) ? (
                        <p className="mt-0.5 inline-flex items-center rounded-md bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold text-[#047482]">
                          Nova
                        </p>
                      ) : (
                        <p className="text-[10px] text-gray-400 mt-0.5">Cliente cadastrado</p>
                      )}
                    </button>
                  </li>
                ))}
                {hasMore && (
                  <li className="p-3 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => void loadClientes(buscaRef.current, { append: true })}
                      disabled={loadingMore}
                      className="w-full py-2.5 rounded-lg border border-[#047482]/30 text-sm font-medium text-[#047482] hover:bg-[var(--brand-bg-onboarding)] disabled:opacity-50"
                    >
                      {loadingMore ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Carregando...
                        </span>
                      ) : (
                        `Carregar mais (${clientes.length} de ${totalClientes})`
                      )}
                    </button>
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>

        {/* Detalhe */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm min-h-[500px]">
          {!selectedId ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-gray-500 p-8 text-center">
              <Users className="w-16 h-16 mb-4 opacity-40 text-gray-300" />
              <p className="mb-2">Selecione um cliente ou lance um atendimento avulso</p>
              <p className="text-sm text-gray-400 max-w-sm mb-6">
                Não precisa cadastrar o cliente antes — basta o nome na hora de lançar o atendimento.
              </p>
              <button
                type="button"
                onClick={abrirFinalizarAtendimento}
                disabled={!!driveError}
                className="inline-flex items-center gap-2 bg-[#047482] text-white px-6 py-3 rounded-xl font-medium hover:bg-[#035e6b] disabled:opacity-50"
              >
                <CheckCircle2 className="w-5 h-5" />
                Atendimento avulso · Lançar
              </button>
            </div>
          ) : loadingDetalhe || !detalhe ? (
            <div className="flex items-center justify-center h-full min-h-[400px]">
              <Loader2 className="w-8 h-8 animate-spin text-[#047482]" />
            </div>
          ) : (
            <>
              <div className="p-6 border-b border-gray-100 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{detalhe.nome}</h2>
                  <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-600">
                    {detalhe.telefone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-4 h-4" /> {detalhe.telefone}
                      </span>
                    )}
                    {detalhe.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="w-4 h-4" /> {detalhe.email}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => irAgendarConsulta(detalhe.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#047482] text-white text-sm font-medium hover:bg-[#035e6b]"
                  >
                    <CalendarPlus className="w-4 h-4" />
                    Agendar sessão
                  </button>
                  <button
                    type="button"
                    onClick={abrirFinalizarAtendimento}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#047482] text-white text-sm font-medium hover:bg-[#035e6b]"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Lançar atendimento
                  </button>
                  {!driveError && (
                    <button
                      type="button"
                      onClick={() => setShowUnificarModal(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-amber-300 text-amber-900 bg-amber-50 text-sm font-medium hover:bg-amber-100"
                      title="Unificar com outro cadastro duplicado"
                    >
                      <Merge className="w-4 h-4" />
                      Unificar com...
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void openEditarCliente(detalhe)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium hover:bg-gray-50 touch-manipulation"
                    title="Editar cadastro"
                  >
                    <Pencil className="w-4 h-4" />
                    <span className="sm:inline">Editar cadastro</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => excluirCliente(detalhe.id)}
                    className="p-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 px-6 py-4 bg-gray-50 border-b border-gray-100">
                <div className="text-center">
                  <p className="text-xs text-gray-500">Atendimentos</p>
                  <p className="text-lg font-bold text-gray-900">{resumoFinanceiro.atendimentos}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Pago</p>
                  <p className="text-lg font-bold text-green-700">
                    {formatCurrency(resumoFinanceiro.pago)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Pendente</p>
                  <p className="text-lg font-bold text-amber-600">
                    {formatCurrency(resumoFinanceiro.pendente)}
                  </p>
                </div>
              </div>

              <div className="flex border-b border-gray-100 overflow-x-auto">
                {tabs.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTab(id)}
                    className={`flex items-center gap-2 px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition ${
                      tab === id
                        ? "border-[#047482] text-[#047482]"
                        : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>

              <div className="p-6">
                {tab === "resumo" && (
                  <div className="space-y-4 text-sm">
                    <div className="border border-gray-100 rounded-xl p-4 bg-white">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <p className="font-medium text-gray-900 flex items-center gap-2">
                          <Users className="w-4 h-4 text-[#047482]" />
                          Dados cadastrais
                        </p>
                        <button
                          type="button"
                          onClick={() => void openEditarCliente(detalhe)}
                          className="text-xs text-[#047482] font-medium hover:underline shrink-0 touch-manipulation"
                        >
                          Editar
                        </button>
                      </div>
                      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <div>
                          <dt className="text-gray-500 text-xs">Nome</dt>
                          <dd className="text-gray-900 font-medium">{detalhe.nome}</dd>
                        </div>
                        {detalhe.telefone && (
                          <div>
                            <dt className="text-gray-500 text-xs">WhatsApp</dt>
                            <dd className="text-gray-900">{detalhe.telefone}</dd>
                          </div>
                        )}
                        {detalhe.email && (
                          <div>
                            <dt className="text-gray-500 text-xs">E-mail</dt>
                            <dd className="text-gray-900 break-all">{detalhe.email}</dd>
                          </div>
                        )}
                        {detalhe.cpf && (
                          <div>
                            <dt className="text-gray-500 text-xs">CPF</dt>
                            <dd className="text-gray-900">{detalhe.cpf}</dd>
                          </div>
                        )}
                        {detalhe.data_nascimento && (
                          <div>
                            <dt className="text-gray-500 text-xs">Nascimento</dt>
                            <dd className="text-gray-900">{detalhe.data_nascimento}</dd>
                          </div>
                        )}
                      </dl>
                      {detalhe.observacoes_gerais && (
                        <p className="mt-3 pt-3 border-t border-gray-100 text-gray-700 whitespace-pre-wrap">
                          <span className="text-gray-500 text-xs block mb-1">Observações</span>
                          {detalhe.observacoes_gerais}
                        </p>
                      )}
                    </div>

                    {ultimosAtendimentos.length > 0 && (
                      <div className="border border-gray-100 rounded-xl p-4 bg-white">
                        <p className="font-medium text-gray-900 flex items-center gap-2 mb-3">
                          <Calendar className="w-4 h-4 text-[#047482]" />
                          Últimos 5 atendimentos
                        </p>
                        <ul className="space-y-3">
                          {ultimosAtendimentos.map((a) => (
                            <li
                              key={a.key}
                              className="rounded-lg border border-gray-100 bg-[#fafafa] p-3"
                            >
                              <p className="font-medium text-gray-900 text-sm">
                                {formatData(a.data)}
                                {a.hora ? ` às ${a.hora.slice(0, 5)}` : ""} —{" "}
                                {ATENDIMENTO_LABEL[a.tipo] ?? a.tipo}
                                {a.origem === "agenda" && (
                                  <span className="text-[#047482] font-normal"> · agenda</span>
                                )}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                {a.medico && `${a.medico} · `}
                                {a.servico && `${a.servico} · `}
                                {!isSessaoAberta(a.status as ConsultaStatus) && (
                                  <span
                                    className={
                                      a.status === "realizado"
                                        ? "text-green-600"
                                        : "text-red-600"
                                    }
                                  >
                                    {labelStatusConsulta(a.status as ConsultaStatus)}
                                  </span>
                                )}
                                {a.forma_pagamento && (
                                  <>
                                    {" · "}
                                    {ATENDIMENTO_LABEL[a.forma_pagamento] ?? a.forma_pagamento}
                                  </>
                                )}
                                {a.valor != null && ` · ${formatCurrency(Number(a.valor))}`}
                              </p>
                              {a.observacoes ? (
                                <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap border-t border-gray-100 pt-2">
                                  <span className="font-medium text-gray-500">Obs.: </span>
                                  {a.observacoes}
                                </p>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="bg-[#eef4f5] border border-[#3795a1]/40 rounded-xl p-4 space-y-3">
                      <p className="font-medium text-gray-900 flex items-center gap-2">
                        <Link2 className="w-4 h-4 text-[#047482]" />
                        Agendamento online (link pessoal)
                      </p>
                      <p className="text-gray-600 text-xs leading-relaxed">
                        O cliente agenda direto, sem redigitar cadastro. Configure horários em{' '}
                        <a href="/dashboard/configuracoes" className="text-[#047482] font-medium underline">
                          Configurações
                        </a>
                        .
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={gerarLinkAgendamento}
                          disabled={generatingAgendamento}
                          className="text-sm bg-[#047482] text-white px-3 py-2 rounded-lg disabled:opacity-60"
                        >
                          {generatingAgendamento ? 'Gerando...' : 'Gerar link de agendamento'}
                        </button>
                        {agendamentoWhatsApp && (
                          <a
                            href={agendamentoWhatsApp}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm bg-[#25D366] text-white px-3 py-2 rounded-lg flex items-center gap-1"
                          >
                            <MessageCircle className="w-4 h-4" />
                            WhatsApp
                          </a>
                        )}
                      </div>
                      {agendamentoLink && (
                        <p className="text-xs text-gray-600 break-all bg-white rounded-lg p-2 border">
                          {agendamentoLink}
                        </p>
                      )}
                    </div>

                    <div className="bg-green-50 border border-green-100 rounded-xl p-4 space-y-3">
                      <p className="font-medium text-gray-900 flex items-center gap-2">
                        <Link2 className="w-4 h-4 text-[#047482]" />
                        Formulário para o cliente preencher
                      </p>
                      <p className="text-gray-600 text-xs leading-relaxed">
                        Envie ao cliente que já está na sua lista. Para quem ainda não está
                        cadastrado, use o link &quot;Cadastro online&quot; no{' '}
                        <a href="/dashboard" className="text-[#047482] underline font-medium">
                          Dashboard
                        </a>
                        .
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={gerarLinkFormulario}
                          disabled={generatingLink}
                          className="text-sm bg-[#047482] text-white px-3 py-2 rounded-lg disabled:opacity-60"
                        >
                          {generatingLink ? "Gerando..." : "Gerar link (copia automaticamente)"}
                        </button>
                        <button
                          type="button"
                          onClick={syncFormularios}
                          disabled={syncingForms}
                          className="text-sm border border-gray-200 px-3 py-2 rounded-lg flex items-center gap-1"
                        >
                          <RefreshCw className={`w-3 h-3 ${syncingForms ? "animate-spin" : ""}`} />
                          Sincronizar respostas
                        </button>
                        {formWhatsApp && (
                          <a
                            href={formWhatsApp}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm bg-[#25D366] text-white px-3 py-2 rounded-lg flex items-center gap-1"
                          >
                            <MessageCircle className="w-4 h-4" />
                            Enviar no WhatsApp
                          </a>
                        )}
                      </div>
                      {formLink && (
                        <p className="text-xs text-gray-600 break-all bg-white rounded-lg p-2 border">
                          {formLink}
                        </p>
                      )}
                    </div>
                    {(detalhe.servico_interesse_nome || detalhe.servico_interesse_id) && (
                      <div className="bg-[var(--brand-bg-onboarding)] border border-[#3795a1]/30 rounded-xl p-4">
                        <p className="text-gray-500 text-xs mb-1">Serviço de interesse (formulário)</p>
                        <p className="font-medium text-gray-900">
                          {detalhe.servico_interesse_nome ?? detalhe.servico_interesse_id}
                        </p>
                      </div>
                    )}

                    {anamneseCampos.length > 0 &&
                      detalhe.anamnese_respostas &&
                      Object.keys(detalhe.anamnese_respostas).length > 0 && (
                        <div className="border border-gray-100 rounded-xl p-4 space-y-2">
                          <p className="font-medium text-gray-900">Anamnese (formulário / cadastro)</p>
                          <ul className="space-y-1.5 text-sm text-gray-800">
                            {anamneseCampos.map((campo) => {
                              const val = detalhe.anamnese_respostas?.[campo.id];
                              if (val === undefined) return null;
                              return (
                                <li key={campo.id}>
                                  <span className="text-gray-500">{campo.label}: </span>
                                  {formatAnamneseValor(campo, val)}
                                </li>
                              );
                            })}
                          </ul>
                          <button
                            type="button"
                            onClick={() => void openEditarCliente(detalhe)}
                            className="text-xs text-[#047482] font-medium hover:underline"
                          >
                            Editar na ficha
                          </button>
                        </div>
                      )}

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={irRegistrarAtendimento}
                        className="text-sm border border-[#047482] text-[#047482] px-3 py-2 rounded-lg font-medium hover:bg-[var(--brand-bg-onboarding)]"
                      >
                        Registrar atendimento
                      </button>
                    </div>
                  </div>
                )}

                {tab === "atendimentos" && (
                  <div className="space-y-6">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={restaurarAtendimentosDaAgenda}
                        disabled={restoringAgenda || !!driveError}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-amber-600 text-amber-800 text-sm font-medium hover:bg-amber-50 disabled:opacity-50"
                      >
                        <Calendar className="w-4 h-4" />
                        {restoringAgenda ? "Restaurando..." : "Restaurar da agenda"}
                      </button>
                      <button
                        type="button"
                        onClick={abrirFinalizarAtendimento}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#047482] text-white text-sm font-medium hover:bg-[#035e6b]"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Lançar atendimento avulso
                      </button>
                      <button
                        type="button"
                        onClick={() => irAgendarConsulta(detalhe.id)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#047482] text-[#047482] text-sm font-medium hover:bg-[var(--brand-bg-onboarding)]"
                      >
                        <CalendarPlus className="w-4 h-4" />
                        Agendar sessão
                      </button>
                    </div>

                    <form onSubmit={adicionarAtendimento} className="bg-gray-50 rounded-xl p-4 space-y-3">
                      <p className="font-medium text-gray-800">Registrar atendimento rápido</p>
                      <p className="text-xs text-gray-500">
                        Registro rápido na ficha — não lança no Financeiro. Para sessões já finalizadas na agenda, use &quot;Restaurar da agenda&quot;.
                      </p>
                      <AtendimentoItensEditor
                        itens={atendCatalogoItens}
                        onChange={setAtendCatalogoItens}
                        onTotalChange={onAtendCatalogoTotalChange}
                        disabled={submitting}
                      />
                      <div className="grid sm:grid-cols-2 gap-3">
                        <input
                          type="date"
                          required
                          value={atendForm.data}
                          onChange={(e) => setAtendForm({ ...atendForm, data: e.target.value })}
                          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        />
                        <input
                          type="time"
                          value={atendForm.hora}
                          onChange={(e) => setAtendForm({ ...atendForm, hora: e.target.value })}
                          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        />
                        <select
                          value={atendForm.status}
                          onChange={(e) => setAtendForm({ ...atendForm, status: e.target.value })}
                          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        >
                          {STATUS_ATENDIMENTO.map((s) => (
                            <option key={s} value={s}>
                              {ATENDIMENTO_LABEL[s]}
                            </option>
                          ))}
                        </select>
                        <div className="sm:col-span-2">
                          <MedicoSelect
                            medicos={medicosOptions}
                            isClinica={isClinica}
                            value={atendForm.medico}
                            onChange={(v) => {
                              setAtendForm({ ...atendForm, medico: v });
                              setAtendMedicoErro(undefined);
                            }}
                            error={atendMedicoErro}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white"
                          />
                        </div>
                        <CurrencyInput
                          placeholder="Valor (R$)"
                          value={atendForm.valor}
                          onChange={(v) => {
                            setAtendValorManual(true);
                            setAtendForm({ ...atendForm, valor: v });
                          }}
                          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        />
                      </div>
                      <textarea
                        placeholder="Observações do atendimento"
                        value={atendForm.observacoes}
                        onChange={(e) => setAtendForm({ ...atendForm, observacoes: e.target.value })}
                        rows={2}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      />
                      <button
                        type="submit"
                        disabled={submitting}
                        className="bg-[#047482] text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
                      >
                        {submitting ? "Salvando..." : "Adicionar atendimento"}
                      </button>
                    </form>
                    <ListaAtendimentos
                      linhas={historicoAtendimentos}
                      formatData={formatData}
                      onRemove={removerAtendimento}
                      onEdit={(id) => {
                        setEditarAtendimentoErro(null);
                        setEditandoAtendimentoId(id);
                      }}
                    />
                    {(detalhe.financeiro_entradas?.length ?? 0) > 0 && (
                      <div className="border border-gray-100 rounded-xl p-4 space-y-2">
                        <p className="font-medium text-gray-800 text-sm">Entradas no financeiro</p>
                        <ul className="space-y-2 text-sm text-gray-600">
                          {detalhe.financeiro_entradas!.map((t) => (
                            <li key={t.id}>
                              {formatData(t.data)} — {formatCurrency(t.valor)}
                              {t.medico && ` · ${t.medico}`}
                              {t.forma_pagamento && (
                                <> · {ATENDIMENTO_LABEL[t.forma_pagamento] ?? t.forma_pagamento}</>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {tab === "observacoes" && (
                  <div className="space-y-6">
                    <form onSubmit={adicionarObservacao} className="bg-gray-50 rounded-xl p-4 space-y-3">
                      <p className="font-medium text-gray-800">Nova observação</p>
                      <textarea
                        required
                        rows={3}
                        placeholder="Anotações do cliente, preferências, alertas..."
                        value={obsForm.texto}
                        onChange={(e) => setObsForm({ texto: e.target.value })}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      />
                      <button
                        type="submit"
                        disabled={submitting}
                        className="bg-[#047482] text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
                      >
                        Salvar observação
                      </button>
                    </form>
                    <ListaObservacoes
                      items={detalhe.observacoes}
                      onRemove={removerObservacao}
                    />
                  </div>
                )}

                {tab === "pagamentos" && (
                  <div className="space-y-6">
                    <form onSubmit={adicionarPagamento} className="bg-gray-50 rounded-xl p-4 space-y-3">
                      <p className="font-medium text-gray-800">Registrar pagamento</p>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <input
                          type="date"
                          required
                          value={pagForm.data}
                          onChange={(e) => setPagForm({ ...pagForm, data: e.target.value })}
                          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        />
                        <CurrencyInput
                          required
                          placeholder="Valor (R$)"
                          value={pagForm.valor}
                          onChange={(v) => setPagForm({ ...pagForm, valor: v })}
                          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        />
                        <select
                          value={pagForm.status}
                          onChange={(e) => setPagForm({ ...pagForm, status: e.target.value })}
                          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        >
                          {STATUS_PAGAMENTO.map((s) => (
                            <option key={s} value={s}>
                              {ATENDIMENTO_LABEL[s]}
                            </option>
                          ))}
                        </select>
                        <select
                          value={pagForm.forma_pagamento}
                          onChange={(e) =>
                            setPagForm({ ...pagForm, forma_pagamento: e.target.value })
                          }
                          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        >
                          {FORMAS_PAGAMENTO.map((f) => (
                            <option key={f} value={f}>
                              {ATENDIMENTO_LABEL[f] ?? f}
                            </option>
                          ))}
                        </select>
                        {detalhe.atendimentos.length > 0 && (
                          <select
                            value={pagForm.atendimento_id}
                            onChange={(e) =>
                              setPagForm({ ...pagForm, atendimento_id: e.target.value })
                            }
                            className="rounded-lg border border-gray-200 px-3 py-2 text-sm sm:col-span-2"
                          >
                            <option value="">Vincular a atendimento (opcional)</option>
                            {detalhe.atendimentos.map((a) => (
                              <option key={a.id} value={a.id}>
                                {formatData(a.data)} — {ATENDIMENTO_LABEL[a.tipo] ?? a.tipo}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                      <input
                        placeholder="Observação do pagamento"
                        value={pagForm.observacao}
                        onChange={(e) => setPagForm({ ...pagForm, observacao: e.target.value })}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      />
                      <button
                        type="submit"
                        disabled={submitting}
                        className="bg-[#047482] text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
                      >
                        Registrar pagamento
                      </button>
                    </form>
                    <ListaPagamentos
                      items={detalhe.pagamentos}
                      formatData={formatData}
                      onRemove={removerPagamento}
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      </div>

      <ClienteFormModal
        open={portalReady && showClienteModal}
        editingClienteId={editingClienteId}
        seed={clienteModalSeed}
        googleImportResourceName={googleImportResourceName}
        anamneseCampos={anamneseCampos}
        onClose={closeClienteModal}
        onSaved={handleClienteSaved}
      />

      {!driveError && (
        <UnificarClientesModal
          open={showUnificarModal}
          onClose={() => setShowUnificarModal(false)}
          clientes={clientes}
          selectedPrimaryId={selectedId}
          onMerged={async (primaryId) => {
            invalidatePacientesOpcoesClientCache();
            invalidateClientesListCache();
            await loadClientes(busca);
            setSelectedId(primaryId);
            await loadDetalhe(primaryId);
          }}
        />
      )}

      {showFinalizarModal && (
        <FinalizarAtendimentoModal
          onClose={() => {
            setShowFinalizarModal(false);
            setFinalizarErro(null);
          }}
          onConfirm={confirmarFinalizarAtendimento}
          clienteId={selectedId}
          clientesIniciais={clientesIniciais}
          nomeInicial={detalhe?.nome ?? ""}
          telefoneInicial={detalhe?.telefone ?? ""}
          medicoInicial=""
          isClinica={isClinica}
          medicos={medicosOptions}
          saving={finalizandoAtendimento}
          erroEnvio={finalizarErro}
          clienteFixo={!!selectedId && !!detalhe}
        />
      )}

      {editandoAtendimentoId && detalhe && (() => {
        const atendimentoEditando = detalhe.atendimentos.find(
          (a) => a.id === editandoAtendimentoId,
        );
        if (!atendimentoEditando) return null;
        return (
          <EditarAtendimentoModal
            atendimento={atendimentoEditando}
            formaPagamentoInicial={
              detalhe.pagamentos.find((p) => p.atendimento_id === editandoAtendimentoId)
                ?.forma_pagamento ?? null
            }
            medicos={medicosOptions}
            isClinica={isClinica}
            saving={salvandoEdicaoAtendimento}
            erroEnvio={editarAtendimentoErro}
            onClose={() => {
              setEditandoAtendimentoId(null);
              setEditarAtendimentoErro(null);
            }}
            onConfirm={confirmarEditarAtendimento}
          />
        );
      })()}

      {agendaModalOpen && agendaSlot && (
        <AgendaConsultaModal
          open
          slotStart={agendaSlot.start}
          slotEnd={agendaSlot.end}
          isClinica={isClinica}
          medicos={medicosOptions}
          profissionais={profissionais}
          titularNome={titularNome}
          defaultLocation={enderecoFormatado}
          duracaoPadraoMin={duracaoPadraoMin}
          saving={savingAgenda}
          clientesIniciais={clientesAgendaModal}
          initialClienteId={agendaModalClienteId}
          closeOnCreateSuccess
          onClose={() => {
            setAgendaModalOpen(false);
            setAgendaModalClienteId(null);
            setAgendaSlot(null);
          }}
          onConfirm={async (payload) => {
            const id = await confirmAgendarFromClientes(payload);
            setAgendaSavedMsg("Sessão agendada! Confira na Agenda.");
            return id;
          }}
          onClienteSaved={async () => {
            invalidatePacientesOpcoesClientCache();
            await loadClientes(buscaRef.current);
          }}
        />
      )}

    </div>
  );
}

function ListaAtendimentos({
  linhas,
  formatData,
  onRemove,
  onEdit,
}: {
  linhas: ReturnType<typeof allAtendimentosOrdenados>;
  formatData: (d: string) => string;
  onRemove: (id: string) => void;
  onEdit: (id: string) => void;
}) {
  if (linhas.length === 0) {
    return <p className="text-sm text-gray-400">Nenhum atendimento registrado.</p>;
  }
  return (
    <ul className="space-y-3">
      {linhas.map((a) => (
        <li key={a.key} className="border border-gray-100 rounded-xl p-4 flex justify-between gap-3">
          <div>
            <p className="font-medium text-gray-900">
              {formatData(a.data)}
              {a.hora ? ` às ${a.hora.slice(0, 5)}` : ""}
              {a.origem === "agenda" && (
                <span className="text-xs font-normal text-[#047482] ml-1">(agenda)</span>
              )}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {a.servico && (
                <>
                  <span className="text-gray-700">{a.servico}</span>
                  {" · "}
                </>
              )}
              {a.medico && `${a.medico} · `}
              {!isSessaoAberta(a.status as ConsultaStatus) && (
                <span
                  className={
                    a.status === "realizado"
                      ? "text-green-600"
                      : "text-red-600"
                  }
                >
                  {labelStatusConsulta(a.status as ConsultaStatus)}
                </span>
              )}
              {a.forma_pagamento && (
                <>
                  {" · "}
                  {ATENDIMENTO_LABEL[a.forma_pagamento] ?? a.forma_pagamento}
                </>
              )}
              {a.valor != null && ` · ${formatCurrency(Number(a.valor))}`}
            </p>
            {a.observacoes && (
              <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">
                <span className="font-medium text-gray-500">Observações: </span>
                {a.observacoes}
              </p>
            )}
          </div>
          {a.origem === "drive" && a.atendimentoId ? (
            <div className="flex flex-col gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => onEdit(a.atendimentoId!)}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-gray-200 text-[#047482] hover:bg-[var(--brand-bg-onboarding)]"
                title="Editar atendimento"
                aria-label="Editar atendimento"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onRemove(a.atendimentoId!)}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-gray-200 text-red-500 hover:bg-red-50"
                title="Remover atendimento"
                aria-label="Remover atendimento"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function ListaObservacoes({
  items,
  onRemove,
}: {
  items: ClienteObservacao[];
  onRemove: (id: string) => void;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-gray-400">Nenhuma observação.</p>;
  }
  return (
    <ul className="space-y-3">
      {items.map((o) => (
        <li key={o.id} className="border border-gray-100 rounded-xl p-4 flex justify-between items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-gray-400 mb-1">
              {format(parseISO(o.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              {o.autor ? ` · ${o.autor}` : ""}
            </p>
            <p className="text-gray-800 whitespace-pre-wrap">{o.texto}</p>
          </div>
          <button
            type="button"
            onClick={() => onRemove(o.id)}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-gray-200 text-red-500 hover:bg-red-50 shrink-0"
            title="Remover observação"
            aria-label="Remover observação"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </li>
      ))}
    </ul>
  );
}

function ListaPagamentos({
  items,
  formatData,
  onRemove,
}: {
  items: ClientePagamento[];
  formatData: (d: string) => string;
  onRemove: (id: string) => void;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-gray-400">Nenhum pagamento registrado.</p>;
  }
  return (
    <ul className="space-y-3">
      {items.map((p) => (
        <li key={p.id} className="border border-gray-100 rounded-xl p-4 flex justify-between items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-gray-900">
              {formatCurrency(Number(p.valor))} — {formatData(p.data)}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {ATENDIMENTO_LABEL[p.status]} ·{" "}
              {p.forma_pagamento ? ATENDIMENTO_LABEL[p.forma_pagamento] : "—"}
            </p>
            {p.observacao && <p className="text-sm text-gray-600 mt-1">{p.observacao}</p>}
          </div>
          <button
            type="button"
            onClick={() => onRemove(p.id)}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-gray-200 text-red-500 hover:bg-red-50 shrink-0"
            title="Remover pagamento"
            aria-label="Remover pagamento"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </li>
      ))}
    </ul>
  );
}
