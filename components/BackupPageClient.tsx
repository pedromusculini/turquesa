"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import MultiSelect from "./MultiSelect";
import {
  loadConsultations,
  saveConsultations,
  type ConsultationRecord,
  TIPO_CONSULTA_UI,
  labelStatusConsulta,
} from "@/lib/consultations";
import { STORAGE_KEY_FINANCEIRO } from "@/lib/constants";
import {
  buildServicoFilterOptions,
  consultaMatchesServicoFilter,
  servicoDaConsulta,
  type ClienteResumoBackup,
} from "@/lib/backupHelpers";
import {
  gerarCsvSecoesCatalogo,
  type TransacaoAgregavel,
} from "@/lib/financeiroAgregados";
import { useCustomSession } from "@/lib/useSession";
import { sanitizeConsultationsForLegacy } from "@/lib/legacyProcedimentoCatalog";
import { useLegacyServicoCatalog } from "@/lib/useLegacyServicoCatalog";
import {
  mergeConsultationsWithServer,
  serverRowToConsultation,
} from "@/lib/syncConsultasClient";

type FinanceTransacao = {
  id: string;
  tipo: "entrada" | "saida";
  descricao: string;
  data: string;
  valor: number;
  categoria: string | null;
  medico: string | null;
  observacao: string | null;
  catalogo_itens?: unknown;
  splits?: { medico: string; porcentagem: number; valor_split: number }[];
};

type Profile = {
  user_type: "medico" | "clinica";
  full_name?: string;
};

type ClinicaMedico = {
  id: string;
  nome: string;
  crm?: string;
  specialty?: string;
};

type DriveFile = {
  id: string;
  name: string;
  size?: string;
  mimeType?: string;
  createdTime?: string;
};

export default function BackupPageClient() {
  const { data: session } = useCustomSession();
  const ownerEmail = session?.user?.email?.toLowerCase().trim() ?? "";
  const { catalog: legacyCatalog, isLegacy, ready: legacyReady } =
    useLegacyServicoCatalog(ownerEmail);
  const fixLegacyRan = useRef(false);

  const [events, setEvents] = useState<ConsultationRecord[]>([]);
  const [clientes, setClientes] = useState<ClienteResumoBackup[]>([]);
  const [financeiro, setFinanceiro] = useState<FinanceTransacao[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error" | "info">(
    "info",
  );
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [autoBackupInfo, setAutoBackupInfo] = useState<{
    clientes?: { latest?: DriveFile | null; interval_hours?: number };
    faturamento?: { latest?: DriveFile | null; interval_hours?: number };
    agenda?: { latest?: DriveFile | null; retention_days?: number };
  } | null>(null);
  const [restoringFileId, setRestoringFileId] = useState<string | null>(null);
  const [isLoadingDrive, setIsLoadingDrive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Perfil e tipo de usuário
  const [profile, setProfile] = useState<Profile | null>(null);
  const [clinicaMedicos, setClinicaMedicos] = useState<ClinicaMedico[]>([]);
  const isMedico = profile?.user_type === "medico";

  // Filtros
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [filterClientes, setFilterClientes] = useState<string[]>([]);
  const [filterServicos, setFilterServicos] = useState<string[]>([]);
  const [filterMedicos, setFilterMedicos] = useState<string[]>([]);

  // Conectar Google Drive via autorização incremental
  function handleConnectDrive() {
    setIsAuthorizing(true);
    const redirect = encodeURIComponent(window.location.pathname);
    window.location.href = `/api/auth/google-authorize?scope=drive&redirect=${redirect}`;
  }

  // Verificar se autorização foi concluída (via URL param)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('google_connected') === 'drive') {
      setIsGoogleConnected(true);
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, []);

  // Verificar conexão com Google Drive via sessão (token já pode estar na sessão)
  useEffect(() => {
    async function checkSessionConnection() {
      if (isGoogleConnected) return;
      try {
        const res = await fetch("/api/google-drive");
        if (res.ok) {
          setIsGoogleConnected(true);
        }
      } catch {
        // Silencioso - não conectado ainda
      }
    }
    checkSessionConnection();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const reloadAgenda = useCallback(() => {
    setEvents(loadConsultations());
  }, []);

  // Agenda (localStorage)
  useEffect(() => {
    reloadAgenda();
    const onStorage = (e: StorageEvent) => {
      if (e.key === "medsupapp-consultations") reloadAgenda();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("medsupapp-consultations-updated", reloadAgenda);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("medsupapp-consultations-updated", reloadAgenda);
    };
  }, [reloadAgenda]);

  // Conta legacy: corrige servico=cliente no Supabase e sincroniza localStorage
  useEffect(() => {
    if (!isLegacy || !legacyReady || fixLegacyRan.current) return;
    fixLegacyRan.current = true;

    void (async () => {
      try {
        const res = await fetch("/api/consultas/fix-legacy-servicos", {
          method: "POST",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!Array.isArray(data.consultas) || data.consultas.length === 0) {
          reloadAgenda();
          return;
        }
        const local = loadConsultations();
        const server = data.consultas.map((row: Parameters<typeof serverRowToConsultation>[0]) =>
          serverRowToConsultation(row),
        );
        saveConsultations(mergeConsultationsWithServer(local, server));
        reloadAgenda();
      } catch {
        /* silencioso */
      }
    })();
  }, [isLegacy, legacyReady, reloadAgenda]);

  const eventsForUi = useMemo(() => {
    if (!isLegacy || !legacyCatalog) return events;
    return sanitizeConsultationsForLegacy(events, legacyCatalog);
  }, [events, isLegacy, legacyCatalog]);

  // Financeiro (API + fallback local)
  useEffect(() => {
    async function loadFinanceiro() {
      try {
        const res = await fetch("/api/financeiro");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setFinanceiro(data);
            return;
          }
        }
      } catch {
        /* fallback */
      }
      const fin = window.localStorage.getItem(STORAGE_KEY_FINANCEIRO);
      if (fin) {
        try {
          setFinanceiro(JSON.parse(fin));
        } catch {
          /* ignora */
        }
      }
    }
    loadFinanceiro();
  }, []);

  // Clientes no Drive (nomes para filtro)
  useEffect(() => {
    async function loadClientes() {
      try {
        const res = await fetch("/api/clientes?all=1");
        if (!res.ok) return;
        const data = await res.json();
        const list = (data.clientes ?? []) as { nome?: string }[];
        setClientes(
          list
            .filter((c) => c.nome?.trim())
            .map((c) => ({ nome: c.nome!.trim() })),
        );
      } catch {
        /* Drive pode estar offline */
      }
    }
    loadClientes();
  }, [isGoogleConnected]);

  // Carregar perfil e determinar tipo de usuário
  useEffect(() => {
    fetch("/api/perfil")
      .then((res) => res.json())
      .then((data) => {
        if (data.profile) {
          setProfile(data.profile);
          // Se for clínica, carregar médicos
          if (data.profile.user_type === "clinica") {
            fetch("/api/perfil/medicos")
              .then((r) => r.json())
              .then((d) => {
                if (d.medicos) setClinicaMedicos(d.medicos);
              })
              .catch(() => {});
          }
        }
      })
      .catch(() => {});
  }, []);

  // Opções para filtros
  const clientesOptions = useMemo(() => {
    const names = new Set<string>();
    for (const e of eventsForUi) {
      if (e.patient?.trim()) names.add(e.patient.trim());
    }
    for (const c of clientes) {
      if (c.nome?.trim()) names.add(c.nome.trim());
    }
    return [...names]
      .sort((a, b) => a.localeCompare(b, "pt-BR"))
      .map((p) => ({ value: p, label: p }));
  }, [eventsForUi, clientes]);

  const servicosOptions = useMemo(
    () =>
      buildServicoFilterOptions(
        eventsForUi,
        isLegacy ? legacyCatalog ?? undefined : undefined,
      ),
    [eventsForUi, isLegacy, legacyCatalog],
  );

  const medicosOptions = useMemo(
    () =>
      clinicaMedicos.map((m) => ({
        value: m.nome,
        label: m.nome,
      })),
    [clinicaMedicos],
  );

  // Aplicar filtros nos dados
  const filteredEvents = useMemo(() => {
    let list = [...eventsForUi];

    // Filtro de período
    if (startDate) {
      list = list.filter((e) => e.start && e.start >= startDate);
    }
    if (endDate) {
      list = list.filter((e) => e.end && e.end <= endDate + "T23:59:59");
    }

    // Filtro de cliente
    if (filterClientes.length > 0) {
      list = list.filter((e) => e.patient && filterClientes.includes(e.patient));
    }

    if (filterServicos.length > 0) {
      list = list.filter((e) => consultaMatchesServicoFilter(e, filterServicos));
    }

    return list;
  }, [
    eventsForUi,
    startDate,
    endDate,
    filterClientes,
    filterServicos,
  ]);

  const filteredFinanceiro = useMemo(() => {
    let list = [...financeiro];

    // Filtro de período (usar data da transação)
    if (startDate) {
      list = list.filter((t) => t.data && t.data >= startDate);
    }
    if (endDate) {
      list = list.filter((t) => t.data && t.data <= endDate + "T23:59:59");
    }

    // Filtro de médico
    if (filterMedicos.length > 0 && !isMedico) {
      list = list.filter(
        (t) => t.medico && filterMedicos.includes(t.medico),
      );
    }

    return list;
  }, [financeiro, startDate, endDate, filterMedicos, isMedico]);

  const countConsultas = filteredEvents.length;
  const clientesUnicos = useMemo(
    () => new Set(filteredEvents.map((e) => e.patient).filter(Boolean)).size,
    [filteredEvents],
  );
  const faturamentoTotal = useMemo(
    () => filteredEvents.reduce((s, e) => s + (e.value ?? 0), 0),
    [filteredEvents],
  );
  const faturamentoFinanceiro = useMemo(
    () =>
      filteredFinanceiro
        .filter((t) => t.tipo === "entrada")
        .reduce((s, t) => s + t.valor, 0),
    [filteredFinanceiro],
  );
  const despesasFinanceiro = useMemo(
    () =>
      filteredFinanceiro
        .filter((t) => t.tipo === "saida")
        .reduce((s, t) => s + t.valor, 0),
    [filteredFinanceiro],
  );

  /** Gera CSV completo: clientes, consultas, faturamento e splits */
  function gerarCsvCompleto(): string {
    const linhas: string[] = [];

    // Seção 1: Atendimentos (agenda)
    linhas.push("=== ATENDIMENTOS (AGENDA) ===");
    linhas.push(
      "Título;Cliente;Serviço;Tipo;Status;Valor;Início;Fim;Endereço;Google Calendar",
    );
    for (const e of filteredEvents) {
      const tipo = e.tipoConsulta
        ? TIPO_CONSULTA_UI[e.tipoConsulta]?.label ?? e.tipoConsulta
        : "";
      const status = e.status
        ? labelStatusConsulta(e.status)
        : "";
      linhas.push(
        [
          e.title ?? "",
          e.patient ?? "",
          servicoDaConsulta(e),
          tipo,
          status,
          (e.value ?? 0).toFixed(2),
          e.start?.toString() ?? "",
          e.end?.toString() ?? "",
          e.location ?? "",
          e.googleEventId ? "Sim" : "Não",
        ].join(";"),
      );
    }

    // Seção 2: Resumo financeiro da agenda
    linhas.push("");
    linhas.push("=== RESUMO FINANCEIRO (AGENDA) ===");
    linhas.push("Faturamento Total;Clientes Únicos;Atendimentos");
    linhas.push(
      `${faturamentoTotal.toFixed(2)};${clientesUnicos};${countConsultas}`,
    );

    // Seção 3: Financeiro (transações)
    linhas.push("");
    linhas.push("=== TRANSAÇÕES FINANCEIRAS ===");
    linhas.push("Tipo;Descrição;Data;Categoria;Profissional;Valor;Observação;Splits");
    for (const t of filteredFinanceiro) {
      const splitsStr = t.splits
        ? t.splits
            .map(
              (s) =>
                `${s.medico}: ${s.porcentagem}% (R$ ${s.valor_split.toFixed(2)})`,
            )
            .join(" | ")
        : "";
      linhas.push(
        [
          t.tipo === "entrada" ? "Entrada" : "Saída",
          t.descricao,
          t.data ?? "",
          t.categoria ?? "",
          t.medico ?? "",
          t.valor.toFixed(2),
          t.observacao ?? "",
          splitsStr,
        ].join(";"),
      );
    }

    // Seção 4: Totais financeiros
    linhas.push("");
    linhas.push("=== TOTAIS FINANCEIROS ===");
    linhas.push("Entradas;Saídas;Saldo");
    linhas.push(
      `${faturamentoFinanceiro.toFixed(2)};${despesasFinanceiro.toFixed(
        2,
      )};${(faturamentoFinanceiro - despesasFinanceiro).toFixed(2)}`,
    );

    const transacoesAgregaveis: TransacaoAgregavel[] = filteredFinanceiro.map(
      (t) => ({
        tipo: t.tipo,
        data: t.data,
        valor: t.valor,
        observacao: t.observacao,
        descricao: t.descricao,
        catalogo_itens: t.catalogo_itens,
      }),
    );
    linhas.push(...gerarCsvSecoesCatalogo(transacoesAgregaveis, ownerEmail));

    // Seção 5: Metadados com info dos filtros aplicados
    linhas.push("");
    linhas.push("=== METADADOS ===");
    linhas.push(
      "Exportado em;Aplicativo;Total atendimentos bruto;Período filtro;Clientes filtro;Serviços filtro;Profissionais filtro",
    );
    linhas.push(
      `${new Date().toLocaleString("pt-BR")};Turquesa Agenda;${events.length};` +
      `${startDate || "sem filtro"} a ${endDate || "sem filtro"};` +
      `${filterClientes.length > 0 ? filterClientes.join(", ") : "todos"};` +
      `${filterServicos.length > 0 ? filterServicos.join(", ") : "todos"};` +
      `${filterMedicos.length > 0 ? filterMedicos.join(", ") : "todos"}`,
    );

    return linhas.join("\n");
  }

  /** Baixar CSV local */
  function handleDownloadCsv() {
    const csv = gerarCsvCompleto();
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `turquesaagenda_backup_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setMessage("CSV baixado com sucesso.");
    setMessageType("success");
  }

  /** Fazer upload do CSV para o Google Drive */
  async function handleUploadToDrive() {
    setIsUploading(true);
    setMessage(null);

    try {
      const csv = gerarCsvCompleto();

      // Gerar JSON de clientes
      const clientesExport = filteredEvents
        .filter((e) => e.patient)
        .map((e) => ({
          nome: e.patient ?? "",
          ultima_consulta: e.start?.toString() ?? "",
          servico: servicoDaConsulta(e),
          tipo: e.tipoConsulta ?? null,
          status: e.status ?? null,
          valor: e.value ?? 0,
        }));
      const clientesJson = JSON.stringify(
        { version: 1, exportado_em: new Date().toISOString(), clientes: clientesExport },
        null,
        2,
      );

      // Gerar JSON de finanças
      const financasJson = JSON.stringify(
        {
          version: 1,
          exportado_em: new Date().toISOString(),
          total_entradas: faturamentoFinanceiro,
          total_saidas: despesasFinanceiro,
          saldo: faturamentoFinanceiro - despesasFinanceiro,
          transacoes: financeiro,
        },
        null,
        2,
      );

      const res = await fetch("/api/google-drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "backup-csv",
          data: {
            content: csv,
            clientesJson,
            financasJson,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erro ao enviar para Google Drive");
      }

      setMessage(
        "Backup completo enviado para o Google Drive! (CSV + clientes.json + financas.json)",
      );
      setMessageType("success");

      // Recarregar lista de arquivos
      await handleListDriveFiles();
    } catch (err: any) {
      setMessage(err.message);
      setMessageType("error");
    } finally {
      setIsUploading(false);
    }
  }

  /** Listar arquivos no Google Drive */
  async function handleListDriveFiles() {
    setIsLoadingDrive(true);
    try {
      const [listRes, clientesAutoRes, faturamentoAutoRes, agendaAutoRes] =
        await Promise.all([
        fetch("/api/google-drive"),
        fetch("/api/clientes/restore-backup"),
        fetch("/api/financeiro/restore-backup"),
        fetch("/api/agenda/snapshot-status"),
      ]);
      if (!listRes.ok) {
        // Se der 403, é porque não está logado com Google
        if (listRes.status === 403) {
          setIsGoogleConnected(false);
          setDriveFiles([]);
          setAutoBackupInfo(null);
          return;
        }
        throw new Error("Erro ao listar arquivos");
      }
      const data = await listRes.json();
      setDriveFiles(data.files || []);
      setIsGoogleConnected(true);

      if (clientesAutoRes.ok) {
        const clientesAuto = await clientesAutoRes.json();
        const faturamentoAuto = faturamentoAutoRes.ok
          ? await faturamentoAutoRes.json()
          : null;
        const agendaAuto = agendaAutoRes.ok ? await agendaAutoRes.json() : null;
        setAutoBackupInfo({
          clientes: {
            latest: clientesAuto.latest ?? null,
            interval_hours: clientesAuto.interval_hours,
          },
          faturamento: faturamentoAuto
            ? {
                latest: faturamentoAuto.latest ?? null,
                interval_hours: faturamentoAuto.interval_hours,
              }
            : undefined,
          agenda: agendaAuto
            ? {
                latest: agendaAuto.latest ?? null,
                retention_days: agendaAuto.retention_days,
              }
            : undefined,
        });
      }
    } catch {
      setDriveFiles([]);
    } finally {
      setIsLoadingDrive(false);
    }
  }

  useEffect(() => {
    handleListDriveFiles();
  }, []);

  /** Deletar arquivo do Google Drive */
  async function handleDeleteDriveFile(fileId: string) {
    if (!confirm("Remover este arquivo do Google Drive?")) return;
    try {
      const res = await fetch(
        `/api/google-drive?fileId=${encodeURIComponent(fileId)}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Erro ao remover");
      setMessage("Arquivo removido do Google Drive.");
      setMessageType("success");
      handleListDriveFiles();
    } catch (err: any) {
      setMessage(err.message);
      setMessageType("error");
    }
  }

  /** Restaurar clientes.json ou faturamento.json a partir de snapshot */
  async function handleRestoreDriveBackup(file: DriveFile) {
    const isClientes = isClientesBackupFile(file.name);
    const isFaturamento = isFaturamentoBackupFile(file.name);
    if (!isClientes && !isFaturamento) return;

    if (file.name === "clientes.json" || file.name === "faturamento.json") {
      setMessage(`${file.name} já é o arquivo ativo. Escolha um arquivo *_backup_*.json.`);
      setMessageType("info");
      return;
    }

    const label = isClientes ? "ficha de clientes" : "espelho financeiro";
    if (
      !confirm(
        `Restaurar ${label} a partir de "${file.name}"?\n\n` +
          "O sistema salvará um backup do estado atual antes de restaurar.",
      )
    ) {
      return;
    }

    setRestoringFileId(file.id);
    setMessage(null);
    try {
      const endpoint = isClientes
        ? "/api/clientes/restore-backup"
        : "/api/financeiro/restore-backup";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: file.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao restaurar backup");
      const count = isClientes ? data.clientes : data.transacoes;
      const unit = isClientes ? "clientes" : "transações";
      setMessage(
        `${label} restaurada (${count} ${unit}). Backup anterior: ${data.pre_restore_backup}` +
          (data.note ? ` — ${data.note}` : ""),
      );
      setMessageType("success");
      await handleListDriveFiles();
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Erro ao restaurar");
      setMessageType("error");
    } finally {
      setRestoringFileId(null);
    }
  }

  function isClientesBackupFile(name: string): boolean {
    return name.startsWith("clientes_backup_") && name.endsWith(".json");
  }

  function isFaturamentoBackupFile(name: string): boolean {
    return name.startsWith("faturamento_backup_") && name.endsWith(".json");
  }

  function isRestorableBackupFile(name: string): boolean {
    return isClientesBackupFile(name) || isFaturamentoBackupFile(name);
  }

  const fmt = (val: number) => `R$ ${val.toFixed(2).replace(".", ",")}`;

  return (
    <main data-tour="backup-overview" className="min-h-screen bg-[#f8f9fa] pb-12">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Cabeçalho */}
        <div className="mb-8 rounded-4xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="inline-flex rounded-full bg-[#D9F0F2] px-3 py-1 text-sm font-semibold uppercase tracking-[0.24em] text-[#047482]">
                Backup LGPD
              </p>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                Seus dados, seu controle.
              </h1>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
                Exporte e armazene clientes e faturamento no seu Google Drive.
                Nenhum dado de cliente fica no Turquesa Agenda.
              </p>
            </div>
            <Link
              href="/dashboard"
              className="inline-flex rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:border-slate-400 hover:bg-slate-50"
            >
              Dashboard
            </Link>
          </div>
        </div>

        {/* Cards de resumo */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#047482]">
              Atendimentos
            </p>
            <p className="mt-4 text-3xl font-semibold text-slate-950">
              {countConsultas}
            </p>
            <p className="mt-2 text-sm text-slate-600">Registros na agenda.</p>
          </div>
          <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#047482]">
              Clientes
            </p>
            <p className="mt-4 text-3xl font-semibold text-slate-950">
              {clientesUnicos}
            </p>
            <p className="mt-2 text-sm text-slate-600">Clientes únicos.</p>
          </div>
          <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#047482]">
              Receita (Agenda)
            </p>
            <p className="mt-4 text-3xl font-semibold text-[#047482]">
              {fmt(faturamentoTotal)}
            </p>
            <p className="mt-2 text-sm text-slate-600">Valor acumulado.</p>
          </div>
          <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#047482]">
              Drive
            </p>
            <p className="mt-4 text-3xl font-semibold text-slate-950">
              {driveFiles.length}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Arquivos no Google Drive.
            </p>
          </div>
        </div>

        {/* Filtros */}
        <div className="mb-8 rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#047482]">
            Filtros
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Aplique filtros para refinar os dados exportados no CSV e nos cards de resumo acima.
          </p>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Início
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Fim
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </div>
            <div className="min-w-[200px]">
              <MultiSelect
                label="Cliente"
                options={clientesOptions}
                selected={filterClientes}
                searchable
                searchPlaceholder="Buscar cliente..."
                onChange={setFilterClientes}
                placeholder="Todos os clientes"
              />
            </div>
            <div className="min-w-[200px]">
              <MultiSelect
                label="Serviço"
                options={servicosOptions}
                selected={filterServicos}
                searchable
                searchPlaceholder="Buscar serviço..."
                onChange={setFilterServicos}
                placeholder="Todos os serviços"
              />
            </div>
            {!isMedico && medicosOptions.length > 0 && (
              <div className="min-w-[200px]">
                <MultiSelect
                  label="Profissional (splits)"
                  options={medicosOptions}
                  selected={filterMedicos}
                  searchable
                  searchPlaceholder="Buscar profissional..."
                  onChange={setFilterMedicos}
                  placeholder="Todas as profissionais"
                />
              </div>
            )}
            {(startDate ||
              endDate ||
              filterClientes.length > 0 ||
              filterServicos.length > 0 ||
              filterMedicos.length > 0) && (
              <button
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                  setFilterClientes([]);
                  setFilterServicos([]);
                  setFilterMedicos([]);
                }}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-50"
              >
                Limpar filtros
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Coluna 1: Exportações */}
          <div className="space-y-6">
            {/* Exportar CSV */}
            <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#047482]">
                Exportar CSV completo
              </p>
              <p className="mt-3 text-sm text-slate-600">
                Gera um arquivo CSV com atendimentos, clientes, faturamento,
                transações financeiras, splits por profissional e totais.
              </p>
              <ul className="mt-3 space-y-1 text-xs text-slate-500">
                <li>• Atendimentos com cliente, serviço, tipo, status e valor</li>
                <li>• Resumo financeiro da agenda</li>
                <li>• Transações financeiras (entradas/saídas)</li>
                <li>• Splits por profissional com porcentagens e valores</li>
                <li>• Faturamento por serviço e por produto</li>
                <li>• Totais: entradas, saídas e saldo</li>
              </ul>
              <button
                type="button"
                onClick={handleDownloadCsv}
                className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-[var(--brand-primary)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-primary-dark)]"
              >
                📥 Baixar CSV completo ({countConsultas} atendimentos)
              </button>
            </div>

            {/* Google Drive */}
            <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#047482]">
                    Google Drive
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    {isGoogleConnected
                      ? "Seus dados de clientes e finanças no seu Google Drive pessoal."
                      : "Faça login com Google para armazenar backups no seu Drive."}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] ${
                    isGoogleConnected
                      ? "bg-[#eef4f5] text-[#047482]"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {isGoogleConnected ? "Conectado" : "Offline"}
                </span>
              </div>

              <button
                type="button"
                onClick={
                  isGoogleConnected
                    ? handleUploadToDrive
                    : handleConnectDrive
                }
                disabled={isUploading || isAuthorizing}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#4285F4] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#3367d6] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isUploading || isAuthorizing ? (
                  <>
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    {isUploading ? "Enviando..." : "Redirecionando..."}
                  </>
                ) : isGoogleConnected ? (
                  <>
                    <svg className="h-5 w-5" viewBox="0 0 87.3 78" fill="currentColor">
                      <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066DA"/>
                      <path d="M43.65 25l-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44c-.8 1.4-1.2 2.95-1.2 4.5h27.5l16.15-28z" fill="#00AC47"/>
                      <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 10.15 7.9 13.65z" fill="#EA4335"/>
                      <path d="M43.65 25l13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.4-4.5 1.2l13.75 23.8z" fill="#00832D"/>
                      <path d="M59.8 53l-16.15-28-16.15 28h32.3z" fill="#2684FC"/>
                      <path d="M73.55 76.8l-29.9-51.8-16.15 28h27.5c0 1.55.4 3.1 1.2 4.5l3.85 6.65 7.9 13.65 1.6 2.75c.8 1.4 2.35 1.9 3.8 1.05z" fill="#FFBA00"/>
                    </svg>
                    Enviar backup para Google Drive
                  </>
                ) : (
                  "Conectar Google Drive"
                )}
              </button>

              {isGoogleConnected && (
                <div className="mt-3 space-y-2 text-xs text-slate-500">
                  <p>
                    Os dados ficam na pasta <strong>MedSupApp</strong> do seu Google Drive.
                  </p>
                  <p className="rounded-2xl bg-[#eef4f5] p-3 text-slate-600">
                    <strong>Backup automático:</strong> clientes e financeiro geram snapshots no
                    Drive no máximo a cada{" "}
                    {autoBackupInfo?.clientes?.interval_hours ?? 6}h (48 versões mantidas).
                    A agenda grava 1 snapshot por dia ao abrir/sincronizar (
                    {autoBackupInfo?.agenda?.retention_days ?? 30} dias mantidos) — só leitura, sem
                    alterar o Google Calendar.
                    <br />
                    Clientes:{" "}
                    {autoBackupInfo?.clientes?.latest?.createdTime
                      ? new Date(autoBackupInfo.clientes.latest.createdTime).toLocaleString("pt-BR")
                      : "na próxima alteração"}
                    . Financeiro:{" "}
                    {autoBackupInfo?.faturamento?.latest?.createdTime
                      ? new Date(autoBackupInfo.faturamento.latest.createdTime).toLocaleString(
                          "pt-BR",
                        )
                      : "na próxima movimentação"}
                    . Agenda:{" "}
                    {autoBackupInfo?.agenda?.latest?.createdTime
                      ? new Date(autoBackupInfo.agenda.latest.createdTime).toLocaleString("pt-BR")
                      : "no próximo sync da agenda"}
                    .
                  </p>
                </div>
              )}
            </div>

            {/* Mensagem de feedback */}
            {message && (
              <div
                className={`rounded-4xl p-6 text-sm ${
                  messageType === "success"
                    ? "bg-emerald-50 text-emerald-700"
                    : messageType === "error"
                      ? "bg-red-50 text-red-600"
                      : "bg-blue-50 text-blue-700"
                }`}
              >
                {message}
              </div>
            )}
          </div>

          {/* Coluna 2: Arquivos no Google Drive + O que é exportado */}
          <div className="space-y-6">
            {/* Arquivos no Drive */}
            <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#047482]">
                  Arquivos no Google Drive
                </p>
                <button
                  onClick={handleListDriveFiles}
                  disabled={isLoadingDrive}
                  className="rounded-xl px-3 py-1 text-xs text-blue-600 transition hover:bg-blue-50"
                >
                  {isLoadingDrive ? "..." : "↻ Atualizar"}
                </button>
              </div>

              <div className="mt-4 space-y-2 max-h-[400px] overflow-y-auto">
                {driveFiles.length === 0 ? (
                  <p className="text-sm text-slate-400">
                    {isGoogleConnected
                      ? "Nenhum arquivo de backup encontrado."
                      : "Conecte-se com Google para ver seus arquivos."}
                  </p>
                ) : (
                  driveFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">
                          {file.name}
                          {file.name === "clientes.json" && (
                            <span className="ml-2 text-xs font-normal text-[#047482]">
                              (clientes ativo)
                            </span>
                          )}
                          {file.name === "faturamento.json" && (
                            <span className="ml-2 text-xs font-normal text-[#047482]">
                              (financeiro ativo)
                            </span>
                          )}
                          {file.name.startsWith("agenda_snapshot_") && (
                            <span className="ml-2 text-xs font-normal text-slate-500">
                              agenda diária
                            </span>
                          )}
                          {file.name.includes("_auto.json") && (
                            <span className="ml-2 text-xs font-normal text-slate-500">
                              automático
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-slate-400">
                          {file.createdTime
                            ? new Date(file.createdTime).toLocaleString("pt-BR")
                            : ""}{" "}
                          · {file.mimeType?.includes("json") ? "JSON" : "CSV"}
                        </p>
                      </div>
                      <div className="ml-2 flex shrink-0 items-center gap-1">
                        {isRestorableBackupFile(file.name) && (
                          <button
                            type="button"
                            onClick={() => handleRestoreDriveBackup(file)}
                            disabled={restoringFileId === file.id}
                            className="rounded-full px-2 py-1 text-xs font-medium text-[#047482] transition hover:bg-[#D9F0F2] disabled:opacity-50"
                            title="Restaurar ficha de clientes"
                          >
                            {restoringFileId === file.id ? "..." : "Restaurar"}
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteDriveFile(file.id)}
                          className="rounded-full p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                          title="Remover"
                        >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* O que é exportado */}
            <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#047482]">
                O que é exportado
              </p>
              <ul className="mt-4 space-y-3 text-sm text-slate-700">
                <li className="rounded-3xl bg-[#eef4f5] p-4">
                  📋 <strong>Atendimentos:</strong> cliente, serviço, tipo, status,
                  valor, data e Google Calendar
                </li>
                <li className="rounded-3xl bg-[#eef4f5] p-4">
                  💰 <strong>Financeiro:</strong> entradas, saídas, categorias,
                  splits por profissional e faturamento por serviço/produto
                </li>
                <li className="rounded-3xl bg-[#eef4f5] p-4">
                  📊 <strong>Totais:</strong> faturamento, despesas e saldo
                  consolidado
                </li>
                <li className="rounded-3xl bg-[#eef4f5] p-4">
                  📅 <strong>Agenda:</strong> snapshot diário no Drive (consultas ativas + últimas
                  excluídas), sem interferir no Google Calendar
                </li>
                <li className="rounded-3xl bg-[#eef4f5] p-4">
                  🔒 <strong>LGPD:</strong> fichas de clientes no seu Google Drive
                  (pasta MedSupApp), com snapshots automáticos versionados
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}