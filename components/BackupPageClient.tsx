"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useCallback } from "react";
import MultiSelect from "./MultiSelect";
import {
  loadConsultations,
  type ConsultationRecord,
  TIPO_CONSULTA_UI,
  STATUS_CONSULTA_UI,
} from "@/lib/consultations";
import { STORAGE_KEY_FINANCEIRO } from "@/lib/constants";
import {
  buildPlanoFilterOptions,
  buildServicoFilterOptions,
  consultaMatchesPlanoFilter,
  consultaMatchesServicoFilter,
  mapConvenioPorPaciente,
  planosDaConsulta,
  servicoDaConsulta,
  type ClienteResumoBackup,
} from "@/lib/backupHelpers";

type FinanceTransacao = {
  id: string;
  tipo: "entrada" | "saida";
  descricao: string;
  data: string;
  valor: number;
  categoria: string | null;
  medico: string | null;
  observacao: string | null;
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
  const [isLoadingDrive, setIsLoadingDrive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Perfil e tipo de usuário
  const [profile, setProfile] = useState<Profile | null>(null);
  const [clinicaMedicos, setClinicaMedicos] = useState<ClinicaMedico[]>([]);
  const isMedico = profile?.user_type === "medico";

  // Filtros
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [filterPacientes, setFilterPacientes] = useState<string[]>([]);
  const [filterServicos, setFilterServicos] = useState<string[]>([]);
  const [filterPlanos, setFilterPlanos] = useState<string[]>([]);
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

  // Clientes no Drive (planos/convênios dos pacientes)
  useEffect(() => {
    async function loadClientes() {
      try {
        const res = await fetch("/api/clientes");
        if (!res.ok) return;
        const data = await res.json();
        const list = (data.clientes ?? []) as { nome?: string; convenio?: string | null }[];
        setClientes(
          list
            .filter((c) => c.nome?.trim())
            .map((c) => ({ nome: c.nome!.trim(), convenio: c.convenio ?? null })),
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
  const convenioPorPaciente = useMemo(
    () => mapConvenioPorPaciente(clientes),
    [clientes],
  );

  const pacientesOptions = useMemo(() => {
    const names = new Set<string>();
    for (const e of events) {
      if (e.patient?.trim()) names.add(e.patient.trim());
    }
    for (const c of clientes) {
      if (c.nome?.trim()) names.add(c.nome.trim());
    }
    return [...names]
      .sort((a, b) => a.localeCompare(b, "pt-BR"))
      .map((p) => ({ value: p, label: p }));
  }, [events, clientes]);

  const servicosOptions = useMemo(
    () => buildServicoFilterOptions(events),
    [events],
  );

  const planosOptions = useMemo(
    () => buildPlanoFilterOptions(events, clientes),
    [events, clientes],
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
    let list = [...events];

    // Filtro de período
    if (startDate) {
      list = list.filter((e) => e.start && e.start >= startDate);
    }
    if (endDate) {
      list = list.filter((e) => e.end && e.end <= endDate + "T23:59:59");
    }

    // Filtro de paciente
    if (filterPacientes.length > 0) {
      list = list.filter((e) => e.patient && filterPacientes.includes(e.patient));
    }

    if (filterServicos.length > 0) {
      list = list.filter((e) => consultaMatchesServicoFilter(e, filterServicos));
    }

    if (filterPlanos.length > 0) {
      list = list.filter((e) =>
        consultaMatchesPlanoFilter(e, filterPlanos, convenioPorPaciente),
      );
    }

    return list;
  }, [
    events,
    startDate,
    endDate,
    filterPacientes,
    filterServicos,
    filterPlanos,
    convenioPorPaciente,
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
  const pacientesUnicos = useMemo(
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

  /** Gera CSV completo: pacientes, consultas, faturamento e splits */
  function gerarCsvCompleto(): string {
    const linhas: string[] = [];

    // Seção 1: Consultas (agenda)
    linhas.push("=== CONSULTAS (AGENDA) ===");
    linhas.push(
      "Título;Paciente;Serviço;Plano/Convênio;Tipo;Status;Valor;Início;Fim;Endereço;Google Calendar",
    );
    for (const e of filteredEvents) {
      const planos = planosDaConsulta(e);
      const planoCsv = planos.length > 0 ? planos.join(" | ") : "";
      const tipo = e.tipoConsulta
        ? TIPO_CONSULTA_UI[e.tipoConsulta]?.label ?? e.tipoConsulta
        : "";
      const status = e.status
        ? STATUS_CONSULTA_UI[e.status]?.label ?? e.status
        : "";
      linhas.push(
        [
          e.title ?? "",
          e.patient ?? "",
          servicoDaConsulta(e),
          planoCsv,
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
    linhas.push("Faturamento Total;Pacientes Únicos;Consultas");
    linhas.push(
      `${faturamentoTotal.toFixed(2)};${pacientesUnicos};${countConsultas}`,
    );

    // Seção 3: Financeiro (transações)
    linhas.push("");
    linhas.push("=== TRANSAÇÕES FINANCEIRAS ===");
    linhas.push("Tipo;Descrição;Data;Categoria;Médico;Valor;Observação;Splits");
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

    // Seção 5: Metadados com info dos filtros aplicados
    linhas.push("");
    linhas.push("=== METADADOS ===");
    linhas.push(
      "Exportado em;Aplicativo;Total consultas bruto;Período filtro;Pacientes filtro;Serviços filtro;Planos filtro;Médicos filtro",
    );
    linhas.push(
      `${new Date().toLocaleString("pt-BR")};MedSupApp;${events.length};` +
      `${startDate || "sem filtro"} a ${endDate || "sem filtro"};` +
      `${filterPacientes.length > 0 ? filterPacientes.join(", ") : "todos"};` +
      `${filterServicos.length > 0 ? filterServicos.join(", ") : "todos"};` +
      `${filterPlanos.length > 0 ? filterPlanos.join(", ") : "todos"};` +
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
    link.download = `medsupapp_backup_${new Date().toISOString().slice(0, 10)}.csv`;
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

      // Gerar JSON de pacientes
      const pacientes = filteredEvents
        .filter((e) => e.patient)
        .map((e) => ({
          nome: e.patient ?? "",
          ultima_consulta: e.start?.toString() ?? "",
          servico: servicoDaConsulta(e),
          plano_convenio: planosDaConsulta(e).join(" | ") || null,
          tipo: e.tipoConsulta ?? null,
          status: e.status ?? null,
          valor: e.value ?? 0,
        }));
      const pacientesJson = JSON.stringify(
        { version: 1, exportado_em: new Date().toISOString(), pacientes },
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
            pacientesJson,
            financasJson,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erro ao enviar para Google Drive");
      }

      setMessage(
        "Backup completo enviado para o Google Drive! (CSV + pacientes.json + financas.json)",
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
      const res = await fetch("/api/google-drive");
      if (!res.ok) {
        // Se der 403, é porque não está logado com Google
        if (res.status === 403) {
          setIsGoogleConnected(false);
          setDriveFiles([]);
          return;
        }
        throw new Error("Erro ao listar arquivos");
      }
      const data = await res.json();
      setDriveFiles(data.files || []);
      setIsGoogleConnected(true);
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

  const fmt = (val: number) => `R$ ${val.toFixed(2).replace(".", ",")}`;

  return (
    <main className="min-h-screen bg-[#f8f9fa] pb-12">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Cabeçalho */}
        <div className="mb-8 rounded-4xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="inline-flex rounded-full bg-[#d4f5d4] px-3 py-1 text-sm font-semibold uppercase tracking-[0.24em] text-[#2d652d]">
                Backup LGPD
              </p>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                Seus dados, seu controle.
              </h1>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
                Exporte e armazene pacientes e faturamento no seu Google Drive.
                Nenhum dado de paciente fica no MedSupAPP.
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
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2d652d]">
              Consultas
            </p>
            <p className="mt-4 text-3xl font-semibold text-slate-950">
              {countConsultas}
            </p>
            <p className="mt-2 text-sm text-slate-600">Registros na agenda.</p>
          </div>
          <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2d652d]">
              Pacientes
            </p>
            <p className="mt-4 text-3xl font-semibold text-slate-950">
              {pacientesUnicos}
            </p>
            <p className="mt-2 text-sm text-slate-600">Pacientes únicos.</p>
          </div>
          <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2d652d]">
              Receita (Agenda)
            </p>
            <p className="mt-4 text-3xl font-semibold text-emerald-600">
              {fmt(faturamentoTotal)}
            </p>
            <p className="mt-2 text-sm text-slate-600">Valor acumulado.</p>
          </div>
          <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2d652d]">
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
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2d652d]">
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
                label="Paciente"
                options={pacientesOptions}
                selected={filterPacientes}
                searchable
                searchPlaceholder="Buscar paciente..."
                onChange={setFilterPacientes}
                placeholder="Todos os pacientes"
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
            <div className="min-w-[220px]">
              <MultiSelect
                label="Plano / Convênio"
                options={planosOptions}
                selected={filterPlanos}
                searchable
                searchPlaceholder="Buscar plano..."
                onChange={setFilterPlanos}
                placeholder="Todos os planos"
              />
            </div>
            {!isMedico && medicosOptions.length > 0 && (
              <div className="min-w-[200px]">
                <MultiSelect
                  label="Médico (splits)"
                  options={medicosOptions}
                  selected={filterMedicos}
                  searchable
                  searchPlaceholder="Buscar médico..."
                  onChange={setFilterMedicos}
                  placeholder="Todos os médicos"
                />
              </div>
            )}
            {(startDate ||
              endDate ||
              filterPacientes.length > 0 ||
              filterServicos.length > 0 ||
              filterPlanos.length > 0 ||
              filterMedicos.length > 0) && (
              <button
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                  setFilterPacientes([]);
                  setFilterServicos([]);
                  setFilterPlanos([]);
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
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2d652d]">
                Exportar CSV completo
              </p>
              <p className="mt-3 text-sm text-slate-600">
                Gera um arquivo CSV com consultas, pacientes, faturamento,
                transações financeiras, splits por médico e totais.
              </p>
              <ul className="mt-3 space-y-1 text-xs text-slate-500">
                <li>• Consultas com paciente, serviço, plano/convênio, tipo, status e valor</li>
                <li>• Resumo financeiro da agenda</li>
                <li>• Transações financeiras (entradas/saídas)</li>
                <li>• Splits por médico com porcentagens e valores</li>
                <li>• Totais: entradas, saídas e saldo</li>
              </ul>
              <button
                type="button"
                onClick={handleDownloadCsv}
                className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-[#90EE90] px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-[#7ad47a]"
              >
                📥 Baixar CSV completo ({countConsultas} consultas)
              </button>
            </div>

            {/* Google Drive */}
            <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2d652d]">
                    Google Drive
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    {isGoogleConnected
                      ? "Seus dados de pacientes e finanças no seu Google Drive pessoal."
                      : "Faça login com Google para armazenar backups no seu Drive."}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] ${
                    isGoogleConnected
                      ? "bg-[#f4fff4] text-[#2d652d]"
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
                <p className="mt-3 text-xs text-slate-400">
                  O backup será salvo na pasta "MedSupApp" do seu
                  Google Drive. Você controla seus dados.
                </p>
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
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2d652d]">
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
                        </p>
                        <p className="text-xs text-slate-400">
                          {file.createdTime
                            ? new Date(file.createdTime).toLocaleDateString(
                                "pt-BR",
                              )
                            : ""}{" "}
                          · {file.mimeType?.includes("json") ? "JSON" : "CSV"}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteDriveFile(file.id)}
                        className="ml-2 shrink-0 rounded-full p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
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
                  ))
                )}
              </div>
            </div>

            {/* O que é exportado */}
            <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2d652d]">
                O que é exportado
              </p>
              <ul className="mt-4 space-y-3 text-sm text-slate-700">
                <li className="rounded-3xl bg-[#f4fff4] p-4">
                  📋 <strong>Consultas:</strong> paciente, serviço, plano/convênio,
                  tipo, status, valor, data e Google Calendar
                </li>
                <li className="rounded-3xl bg-[#f4fff4] p-4">
                  💰 <strong>Financeiro:</strong> entradas, saídas, categorias e
                  splits por médico
                </li>
                <li className="rounded-3xl bg-[#f4fff4] p-4">
                  📊 <strong>Totais:</strong> faturamento, despesas e saldo
                  consolidado
                </li>
                <li className="rounded-3xl bg-[#f4fff4] p-4">
                  🔒 <strong>LGPD:</strong> dados salvos exclusivamente no seu
                  Google Drive, nunca no MedSupAPP
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}