"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import MultiSelect from "./MultiSelect";
import { gerarCsvCompleto, downloadCsv } from "@/lib/csv-export";

type Transacao = {
  id: string;
  tipo: "entrada" | "saida";
  descricao: string;
  data: string;
  valor: number;
  categoria: string | null;
  medico: string | null;
  observacao: string | null;
  created_at: string;
  splits: Split[];
};

type Split = {
  id: string;
  transacao_id: string;
  medico: string;
  porcentagem: number;
  valor_split: number;
};

const CATEGORIAS_ENTRADA = ["consulta", "procedimento", "exame", "outro"];
const CATEGORIAS_SAIDA = [
  "aluguel",
  "salario",
  "material",
  "marketing",
  "software",
  "imposto",
  "outro",
];

export default function FinanceiroPageClient() {
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [transacoesFiltradas, setTransacoesFiltradas] = useState<Transacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [filterType, setFilterType] = useState<"todas" | "entrada" | "saida">(
    "todas",
  );
  const [filterMedicos, setFilterMedicos] = useState<string[]>([]);
  const [filterClientes, setFilterClientes] = useState<string[]>([]);

  // Opções para os multi-selects
  const [medicosOptions, setMedicosOptions] = useState<{ value: string; label: string }[]>([]);
  const [clientesOptions, setClientesOptions] = useState<{ value: string; label: string }[]>([]);

  // Modal de nova transação
  const [showModal, setShowModal] = useState(false);
  const [formTipo, setFormTipo] = useState<"entrada" | "saida">("entrada");
  const [formDescricao, setFormDescricao] = useState("");
  const [formData, setFormData] = useState(
    format(new Date(), "yyyy-MM-dd"),
  );
  const [formValor, setFormValor] = useState("");
  const [formCategoria, setFormCategoria] = useState("");
  const [formMedico, setFormMedico] = useState("");
  const [formObservacao, setFormObservacao] = useState("");
  const [formSplits, setFormSplits] = useState<
    { medico: string; porcentagem: string }[]
  >([]);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Carregar opções de médicos (da clínica ou do perfil)
  useEffect(() => {
    async function loadOptions() {
      try {
        const res = await fetch("/api/perfil");
        const data = await res.json();
        if (!res.ok) return;

        const profile = data.profile;

        // Se for clínica, carrega médicos da tabela clinica_medicos
        if (profile?.user_type === "clinica") {
          const medRes = await fetch("/api/perfil/medicos");
          const medData = await medRes.json();
          if (medRes.ok && medData.medicos) {
            const nomes = medData.medicos.map((m: any) => ({
              value: m.nome,
              label: m.nome,
            }));
            setMedicosOptions(nomes);
          }
        } else if (profile?.full_name) {
          // Médico solo - apenas ele mesmo
          setMedicosOptions([{ value: profile.full_name, label: profile.full_name }]);
        }
      } catch (err) {
        console.error("[Financeiro] Erro ao carregar opções:", err);
      }
    }
    loadOptions();
  }, []);

  // Extrair opções de clientes das transações
  useEffect(() => {
    const clientes = new Set<string>();
    for (const t of transacoes) {
      // Extrair paciente da descrição se possível (ex: "Consulta - João - Dr. Pedro")
      const partes = t.descricao.split(" - ");
      if (partes.length >= 2 && t.tipo === "entrada") {
        // Assume formato "Procedimento - Paciente - Médico" ou similar
        const possivelPaciente = partes[1]?.trim();
        if (possivelPaciente && possivelPaciente.length > 0) {
          clientes.add(possivelPaciente);
        }
      }
      if (t.medico) {
        clientes.add(t.medico);
      }
    }
    setClientesOptions(
      Array.from(clientes).map((c) => ({ value: c, label: c }))
    );
  }, [transacoes]);

  // Filtragem local combinada (tipo + médico + cliente)
  useEffect(() => {
    let filtradas = [...transacoes];

    // Filtro por tipo
    if (filterType !== "todas") {
      filtradas = filtradas.filter((t) => t.tipo === filterType);
    }

    // Filtro por médicos
    if (filterMedicos.length > 0) {
      filtradas = filtradas.filter((t) => {
        // Verifica se o médico da transação está na lista
        if (t.medico && filterMedicos.includes(t.medico)) return true;
        // Verifica se algum split match
        if (t.splits && t.splits.some((s) => filterMedicos.includes(s.medico))) return true;
        return false;
      });
    }

    // Filtro por clientes (na descrição)
    if (filterClientes.length > 0) {
      filtradas = filtradas.filter((t) => {
        return filterClientes.some((cliente) =>
          t.descricao.toLowerCase().includes(cliente.toLowerCase())
        );
      });
    }

    setTransacoesFiltradas(filtradas);
  }, [transacoes, filterType, filterMedicos, filterClientes]);

  const fetchTransacoes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("start", startDate);
      if (endDate) params.set("end", endDate);
      if (filterType !== "todas") params.set("type", filterType);
      if (filterMedicos.length > 0) params.set("medicos", filterMedicos.join(","));

      const res = await fetch(`/api/financeiro?${params.toString()}`);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Erro ao carregar transações");
      }
      const data = await res.json();
      setTransacoes(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, filterType, filterMedicos]);

  useEffect(() => {
    fetchTransacoes();
  }, [fetchTransacoes]);

  const { totalEntradas, totalSaidas, saldo, totalPorMedico } = useMemo(() => {
    let entradas = 0;
    let saídas = 0;
    const porMedico: Record<string, number> = {};

    for (const t of transacoesFiltradas) {
      if (t.tipo === "entrada") {
        entradas += t.valor;
        if (t.splits && t.splits.length > 0) {
          for (const s of t.splits) {
            porMedico[s.medico] =
              (porMedico[s.medico] || 0) + s.valor_split;
          }
        } else if (t.medico) {
          porMedico[t.medico] = (porMedico[t.medico] || 0) + t.valor;
        }
      } else {
        saídas += t.valor;
      }
    }

    return {
      totalEntradas: entradas,
      totalSaidas: saídas,
      saldo: entradas - saídas,
      totalPorMedico: porMedico,
    };
  }, [transacoesFiltradas]);

  const handleDelete = async (id: string) => {
    if (!confirm("Remover esta transação?")) return;
    try {
      const res = await fetch(`/api/financeiro?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Erro ao remover");
      }
      fetchTransacoes();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const addSplit = () => {
    setFormSplits([...formSplits, { medico: "", porcentagem: "" }]);
  };

  const removeSplit = (idx: number) => {
    setFormSplits(formSplits.filter((_, i) => i !== idx));
  };

  const updateSplit = (
    idx: number,
    field: "medico" | "porcentagem",
    value: string,
  ) => {
    const updated = [...formSplits];
    updated[idx][field] = value;
    setFormSplits(updated);
  };

  const resetForm = () => {
    setFormTipo("entrada");
    setFormDescricao("");
    setFormData(format(new Date(), "yyyy-MM-dd"));
    setFormValor("");
    setFormCategoria("");
    setFormMedico("");
    setFormObservacao("");
    setFormSplits([]);
    setSubmitError(null);
    setShowModal(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    setSubmitError(null);

    try {
      const payload: any = {
        tipo: formTipo,
        descricao: formDescricao,
        data: formData,
        valor: parseFloat(formValor),
        categoria: formCategoria || null,
        medico: formMedico || null,
        observacao: formObservacao || null,
      };

      if (formTipo === "entrada" && formSplits.length > 0) {
        const totalPct = formSplits.reduce(
          (sum, s) => sum + (parseFloat(s.porcentagem) || 0),
          0,
        );
        if (Math.abs(totalPct - 100) > 0.01) {
          setSubmitError("A soma das porcentagens dos splits deve ser 100%");
          setSubmitLoading(false);
          return;
        }
        payload.splits = formSplits.map((s) => ({
          medico: s.medico,
          porcentagem: parseFloat(s.porcentagem),
        }));
      }

      const res = await fetch("/api/financeiro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Erro ao registrar transação");
      }

      resetForm();
      fetchTransacoes();
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setSubmitLoading(false);
    }
  };

  // Exportação CSV
  const handleExportCsv = () => {
    const csv = gerarCsvCompleto({
      events: [],
      financeiro: transacoesFiltradas,
    });
    const periodo =
      startDate && endDate
        ? `${startDate}_a_${endDate}`
        : format(new Date(), "yyyy-MM-dd");
    downloadCsv(csv, `financeiro_${periodo}.csv`);
  };

  const formatCurrency = (val: number) =>
    `R$ ${val.toFixed(2).replace(".", ",")}`;

  const categoriaLabel = (cat: string) => {
    const map: Record<string, string> = {
      consulta: "Consulta",
      procedimento: "Procedimento",
      exame: "Exame",
      aluguel: "Aluguel",
      salario: "Salário",
      material: "Material",
      marketing: "Marketing",
      software: "Software",
      imposto: "Imposto",
      outro: "Outro",
    };
    return map[cat] || cat;
  };

  return (
    <main className="min-h-screen bg-[#f8f9fa] pb-12">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Cabeçalho */}
        <div className="mb-8 rounded-4xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="inline-flex rounded-full bg-[#d4f5d4] px-3 py-1 text-sm font-semibold uppercase tracking-[0.24em] text-[#2d652d]">
                Financeiro
              </p>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                Controle de entradas e saídas
              </h1>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
                Registre consultas, procedimentos, despesas e configure splits
                automáticos por médico.
              </p>
            </div>
          </div>
        </div>

        {/* Totalizadores */}
        <div className="mb-8 grid gap-4 lg:grid-cols-4">
          <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2d652d]">
              Entradas
            </p>
            <p className="mt-4 text-3xl font-semibold text-emerald-600">
              {formatCurrency(totalEntradas)}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Receita acumulada no período.
            </p>
          </div>

          <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2d652d]">
              Saídas
            </p>
            <p className="mt-4 text-3xl font-semibold text-red-500">
              {formatCurrency(totalSaidas)}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Despesas totais no período.
            </p>
          </div>

          <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2d652d]">
              Saldo
            </p>
            <p
              className={`mt-4 text-3xl font-semibold ${
                saldo >= 0 ? "text-emerald-600" : "text-red-500"
              }`}
            >
              {formatCurrency(saldo)}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Diferença entre entradas e saídas.
            </p>
          </div>

          <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2d652d]">
              Transações
            </p>
            <p className="mt-4 text-3xl font-semibold text-slate-950">
              {transacoesFiltradas.length}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Registros no período.
            </p>
          </div>
        </div>

        {/* Split por médico (se houver) */}
        {Object.keys(totalPorMedico).length > 0 && (
          <div className="mb-8 rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-[#2d652d]">
              Repasse por médico (splits)
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(totalPorMedico).map(([medico, valor]) => (
                <div
                  key={medico}
                  className="rounded-2xl border border-slate-100 bg-[#f4fff4] p-4"
                >
                  <p className="text-sm font-semibold text-slate-950">
                    {medico}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-emerald-600">
                    {formatCurrency(valor)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filtros + Botões */}
        <div className="mb-6 flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
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
            <div>
              <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Tipo
              </label>
              <select
                value={filterType}
                onChange={(e) =>
                  setFilterType(
                    e.target.value as "todas" | "entrada" | "saida",
                  )
                }
                className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              >
                <option value="todas">Todas</option>
                <option value="entrada">Entradas</option>
                <option value="saida">Saídas</option>
              </select>
            </div>

            {/* Filtro multi-select: Médico */}
            <div className="min-w-[200px]">
              <MultiSelect
                label="Médico"
                options={medicosOptions}
                selected={filterMedicos}
                onChange={setFilterMedicos}
                placeholder="Todos os médicos"
              />
            </div>

            {/* Filtro multi-select: Cliente/Paciente */}
            <div className="min-w-[200px]">
              <MultiSelect
                label="Cliente/Paciente"
                options={clientesOptions}
                selected={filterClientes}
                onChange={setFilterClientes}
                placeholder="Todos os clientes"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowModal(true)}
              className="rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              + Nova transação
            </button>
            <button
              onClick={handleExportCsv}
              disabled={transacoesFiltradas.length === 0}
              className="rounded-2xl border border-emerald-600 px-6 py-3 text-sm font-semibold text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Exportar CSV
            </button>
          </div>
        </div>

        {/* Tabela de transações */}
        <div className="rounded-4xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2d652d]">
              Transações {transacoes.length !== transacoesFiltradas.length && `(${transacoesFiltradas.length} de ${transacoes.length})`}
            </p>
            {error && (
              <p className="mt-2 rounded-xl bg-red-50 p-3 text-sm text-red-600">
                {error}
              </p>
            )}
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Carregando...
            </div>
          ) : transacoesFiltradas.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-slate-500">
                Nenhuma transação encontrada no período.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-t border-slate-100 bg-[#f8fff8]">
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Data
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Descrição
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Categoria
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Médico
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Tipo
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Valor
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Splits
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {transacoesFiltradas.map((t) => (
                    <tr
                      key={t.id}
                      className="border-t border-slate-50 hover:bg-slate-50/50"
                    >
                      <td className="px-6 py-3 text-slate-700">
                        {t.data
                          ? format(new Date(t.data + "T12:00:00"), "dd/MM/yy")
                          : "-"}
                      </td>
                      <td className="px-6 py-3 font-medium text-slate-900">
                        {t.descricao}
                        {t.observacao && (
                          <p className="text-xs text-slate-400">
                            {t.observacao}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-3">
                        {t.categoria ? (
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                            {categoriaLabel(t.categoria)}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-slate-700">
                        {t.medico || "-"}
                      </td>
                      <td className="px-6 py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${
                            t.tipo === "entrada"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-red-50 text-red-700"
                          }`}
                        >
                          {t.tipo === "entrada" ? "Entrada" : "Saída"}
                        </span>
                      </td>
                      <td
                        className={`px-6 py-3 text-right font-semibold ${
                          t.tipo === "entrada"
                            ? "text-emerald-600"
                            : "text-red-500"
                        }`}
                      >
                        {formatCurrency(t.valor)}
                      </td>
                      <td className="px-6 py-3 text-right text-xs text-slate-500">
                        {t.splits && t.splits.length > 0
                          ? t.splits
                              .map(
                                (s) =>
                                  `${s.medico}: ${s.porcentagem}% (${formatCurrency(s.valor_split)})`,
                              )
                              .join(" | ")
                          : "-"}
                      </td>
                      <td className="px-6 py-3 text-center">
                        <button
                          onClick={() => handleDelete(t.id)}
                          className="rounded-lg p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                          title="Remover"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5"
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal de nova transação */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-slate-950">
                Nova transação
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
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

            {submitError && (
              <div className="mb-6 rounded-xl bg-red-50 p-4 text-sm font-medium text-red-600">
                {submitError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Tipo */}
              <div>
                <label className="block text-sm font-semibold text-slate-700">
                  Tipo *
                </label>
                <div className="mt-1 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setFormTipo("entrada")}
                    className={`flex-1 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                      formTipo === "entrada"
                        ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    Entrada (receita)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormTipo("saida")}
                    className={`flex-1 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                      formTipo === "saida"
                        ? "border-red-300 bg-red-50 text-red-700"
                        : "border-slate-200 text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    Saída (despesa)
                  </button>
                </div>
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-sm font-semibold text-slate-700">
                  Descrição *
                </label>
                <input
                  type="text"
                  required
                  value={formDescricao}
                  onChange={(e) => setFormDescricao(e.target.value)}
                  placeholder={
                    formTipo === "entrada"
                      ? "Ex: Consulta Dr. João"
                      : "Ex: Aluguel da clínica"
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              {/* Data e Valor */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-semibold text-slate-700">
                    Data *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData}
                    onChange={(e) => setFormData(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700">
                    Valor (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={formValor}
                    onChange={(e) => setFormValor(e.target.value)}
                    placeholder="0,00"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
              </div>

              {/* Categoria */}
              <div>
                <label className="block text-sm font-semibold text-slate-700">
                  Categoria
                </label>
                <select
                  value={formCategoria}
                  onChange={(e) => setFormCategoria(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="">Selecione...</option>
                  {(formTipo === "entrada"
                    ? CATEGORIAS_ENTRADA
                    : CATEGORIAS_SAIDA
                  ).map((cat) => (
                    <option key={cat} value={cat}>
                      {categoriaLabel(cat)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Médico (apenas para entradas) */}
              {formTipo === "entrada" && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700">
                    Médico responsável
                  </label>
                  <input
                    type="text"
                    value={formMedico}
                    onChange={(e) => setFormMedico(e.target.value)}
                    placeholder="Ex: Dr. João Silva"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
              )}

              {/* Observação */}
              <div>
                <label className="block text-sm font-semibold text-slate-700">
                  Observação
                </label>
                <textarea
                  value={formObservacao}
                  onChange={(e) => setFormObservacao(e.target.value)}
                  rows={2}
                  placeholder="Notas adicionais..."
                  className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              {/* Splits (apenas para entradas) */}
              {formTipo === "entrada" && (
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-slate-700">
                      Split por médico (opcional)
                    </label>
                    <button
                      type="button"
                      onClick={addSplit}
                      className="rounded-xl border border-emerald-300 px-3 py-1 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-50"
                    >
                      + Adicionar split
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Defina a porcentagem que cada médico recebe. A soma deve ser
                    100%.
                  </p>

                  {formSplits.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {formSplits.map((split, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 rounded-xl border border-slate-100 bg-[#f8fff8] p-3"
                        >
                          <input
                            type="text"
                            value={split.medico}
                            onChange={(e) =>
                              updateSplit(idx, "medico", e.target.value)
                            }
                            placeholder="Nome do médico"
                            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none"
                          />
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            value={split.porcentagem}
                            onChange={(e) =>
                              updateSplit(idx, "porcentagem", e.target.value)
                            }
                            placeholder="%"
                            className="w-20 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none"
                          />
                          <span className="text-sm text-slate-400">%</span>
                          <button
                            type="button"
                            onClick={() => removeSplit(idx)}
                            className="rounded-lg p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5"
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
                      ))}
                      <p className="text-xs text-slate-400">
                        Total:{" "}
                        {formSplits
                          .reduce(
                            (sum, s) => sum + (parseFloat(s.porcentagem) || 0),
                            0,
                          )
                          .toFixed(0)}
                        %
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Botões */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 rounded-xl border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitLoading}
                  className={`flex-1 rounded-xl px-6 py-3 text-sm font-semibold text-white transition ${
                    formTipo === "entrada"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-red-500 hover:bg-red-600"
                  } disabled:opacity-50`}
                >
                  {submitLoading ? "Salvando..." : "Salvar transação"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
