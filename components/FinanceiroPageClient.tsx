"use client";

import {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
  memo,
  startTransition,
} from "react";
import dynamic from "next/dynamic";
import { format } from "date-fns";
import MultiSelect from "./MultiSelect";
import FinanceiroNovaTransacaoModal, {
  type FinanceiroTransacaoCriada,
} from "./FinanceiroNovaTransacaoModal";
import { gerarCsvCompleto, downloadCsv } from "@/lib/csv-export";
import { ATENDIMENTO_LABEL, FORMAS_PAGAMENTO } from "@/lib/constants";
import { extractClienteFromDescricao } from "@/lib/financeiroClientes";
import { transacaoMatchesFinanceiroSearch } from "@/lib/financeiroSearch";
import { loadMedicosOptions } from "@/lib/loadMedicosOptions";
import { useCustomSession } from "@/lib/useSession";
import {
  fetchClientesListAll,
  readClientesListCache,
} from "@/lib/clientesListCache";
import {
  invalidateFinanceiroCache,
  readFinanceiroCache,
  revalidateFinanceiroCache,
} from "@/lib/financeiroCache";

function formatCurrency(val: number) {
  return `R$ ${val.toFixed(2).replace(".", ",")}`;
}

const FinanceiroGraficos = dynamic(() => import("./FinanceiroGraficos"), {
  ssr: false,
  loading: () => (
    <div className="rounded-4xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
      Carregando gráficos...
    </div>
  ),
});

type Split = {
  id: string;
  transacao_id: string;
  medico: string;
  porcentagem: number;
  valor_split: number;
};

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
  valor_bruto?: number | null;
  taxa_pagamento?: number | null;
  valor_liquido?: number | null;
  percentual_profissional?: number | null;
  valor_profissional?: number | null;
  valor_salao?: number | null;
  forma_pagamento?: string | null;
  catalogo_itens?: unknown;
};

const SEARCH_DEBOUNCE_MS = 300;
const CATEGORIA_LABELS: Record<string, string> = {
  consulta: "Atendimento",
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

function categoriaLabel(cat: string) {
  return CATEGORIA_LABELS[cat] || cat;
}

const FinanceiroTransacaoRow = memo(function FinanceiroTransacaoRow({
  t,
  onDelete,
}: {
  t: Transacao;
  onDelete: (id: string) => void;
}) {
  const dataLabel = t.data
    ? format(new Date(t.data + "T12:00:00"), "dd/MM/yy")
    : "-";

  return (
    <tr className="border-t border-slate-50 hover:bg-slate-50/50">
      <td className="px-6 py-3 text-slate-700">{dataLabel}</td>
      <td className="px-6 py-3 font-medium text-slate-900">
        {t.descricao}
        {t.observacao && (
          <p className="text-xs text-slate-400">{t.observacao}</p>
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
      <td className="px-6 py-3 text-slate-700">{t.medico || "-"}</td>
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
          t.tipo === "entrada" ? "text-emerald-600" : "text-red-500"
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
          type="button"
          onClick={() => onDelete(t.id)}
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
  );
});

export default function FinanceiroPageClient() {
  const { data: session } = useCustomSession();
  const ownerEmail = session?.user?.email?.toLowerCase().trim() ?? "";

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
  const [filterFormasPagamento, setFilterFormasPagamento] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const fetchSeqRef = useRef(0);

  // Opções para os multi-selects
  const [medicosOptions, setMedicosOptions] = useState<{ value: string; label: string }[]>([]);
  const [clientesOptions, setClientesOptions] = useState<{ value: string; label: string }[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [viewMode, setViewMode] = useState<"transacoes" | "repasse" | "graficos">(
    "transacoes",
  );

  const formasPagamentoOptions = useMemo(
    () =>
      FORMAS_PAGAMENTO.map((id) => ({
        value: id,
        label: ATENDIMENTO_LABEL[id] ?? id,
      })),
    [],
  );

  // Carregar opções de profissionais e clientes
  useEffect(() => {
    async function loadOptions() {
      try {
        const cachedClientes = ownerEmail ? readClientesListCache(ownerEmail) : null;
        if (cachedClientes?.length) {
          setClientesOptions(
            cachedClientes
              .map((c) => c.nome?.trim())
              .filter(Boolean)
              .map((nome) => ({ value: nome!, label: nome! })),
          );
        }

        const [medicosResult, clientes] = await Promise.all([
          loadMedicosOptions(),
          ownerEmail
            ? fetchClientesListAll(ownerEmail)
            : fetch("/api/clientes?all=1")
                .then((r) => r.json())
                .then((d) => (Array.isArray(d.clientes) ? d.clientes : []))
                .catch(() => [] as { nome?: string }[]),
        ]);

        if (medicosResult.medicos.length > 0) {
          setMedicosOptions(
            medicosResult.medicos.map((nome) => ({ value: nome, label: nome })),
          );
        }

        if (Array.isArray(clientes) && clientes.length > 0) {
          const fromApi = clientes
            .map((c: { nome?: string }) => c.nome?.trim())
            .filter(Boolean) as string[];
          if (fromApi.length > 0) {
            setClientesOptions(
              fromApi.map((nome) => ({ value: nome, label: nome })),
            );
          }
        }
      } catch (err) {
        console.error("[Financeiro] Erro ao carregar opções:", err);
      }
    }
    loadOptions();
  }, [ownerEmail]);

  // Complementar opções de clientes a partir das transações (sem incluir profissionais)
  useEffect(() => {
    setClientesOptions((prev) => {
      const clientes = new Set(prev.map((c) => c.value));
      for (const t of transacoes) {
        const nome = extractClienteFromDescricao(t.descricao, t.tipo);
        if (nome) clientes.add(nome);
      }
      return Array.from(clientes)
        .sort((a, b) => a.localeCompare(b, "pt-BR"))
        .map((c) => ({ value: c, label: c }));
    });
  }, [transacoes]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebouncedSearchQuery(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  // Filtragem local combinada (período + tipo + médico + cliente)
  useEffect(() => {
    let filtradas = [...transacoes];

    const dataRef = (t: Transacao) => (t.data ? t.data.slice(0, 10) : "");
    if (startDate) {
      filtradas = filtradas.filter((t) => {
        const d = dataRef(t);
        return d && d >= startDate;
      });
    }
    if (endDate) {
      filtradas = filtradas.filter((t) => {
        const d = dataRef(t);
        return d && d <= endDate;
      });
    }

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

    // Filtro por forma de pagamento
    if (filterFormasPagamento.length > 0) {
      filtradas = filtradas.filter((t) => {
        if (!t.forma_pagamento) return false;
        return filterFormasPagamento.includes(t.forma_pagamento);
      });
    }

    if (debouncedSearchQuery) {
      filtradas = filtradas.filter((t) =>
        transacaoMatchesFinanceiroSearch(t, debouncedSearchQuery),
      );
    }

    setTransacoesFiltradas(filtradas);
  }, [
    transacoes,
    startDate,
    endDate,
    filterType,
    filterMedicos,
    filterClientes,
    filterFormasPagamento,
    debouncedSearchQuery,
  ]);

  const fetchTransacoes = useCallback(async () => {
    if (!ownerEmail) return;

    const filters = {
      start: startDate,
      end: endDate,
      type: filterType,
      medicos: filterMedicos,
    };

    const cached = readFinanceiroCache(ownerEmail, filters);
    if (cached) {
      setTransacoes(cached as Transacao[]);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);

    const seq = ++fetchSeqRef.current;

    try {
      const data = await revalidateFinanceiroCache(ownerEmail, filters);
      if (seq !== fetchSeqRef.current) return;
      setTransacoes(data as Transacao[]);
    } catch (err: unknown) {
      if (seq !== fetchSeqRef.current) return;
      const message =
        err instanceof Error ? err.message : "Erro ao carregar transações";
      setError(message);
    } finally {
      if (seq === fetchSeqRef.current) {
        setLoading(false);
      }
    }
  }, [ownerEmail, startDate, endDate, filterType, filterMedicos]);

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

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm("Remover esta transação?")) return;
      let previous: Transacao[] = [];
      setTransacoes((prev) => {
        previous = prev;
        return prev.filter((t) => t.id !== id);
      });
      invalidateFinanceiroCache(ownerEmail);
      try {
        const res = await fetch(`/api/financeiro?id=${id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Erro ao remover");
        }
      } catch (err: unknown) {
        setTransacoes(previous);
        alert(err instanceof Error ? err.message : "Erro ao remover");
      }
    },
    [ownerEmail],
  );

  const handleCreated = useCallback(
    (created: FinanceiroTransacaoCriada) => {
      const row: Transacao = {
        id: created.id,
        tipo: created.tipo,
        descricao: created.descricao,
        data: created.data,
        valor: Number(created.valor),
        categoria: created.categoria ?? null,
        medico: created.medico ?? null,
        observacao: created.observacao ?? null,
        created_at: created.created_at ?? new Date().toISOString(),
        splits: Array.isArray(created.splits) ? created.splits : [],
        valor_bruto: created.valor_bruto,
        taxa_pagamento: created.taxa_pagamento,
        valor_liquido: created.valor_liquido,
        percentual_profissional: created.percentual_profissional,
        valor_profissional: created.valor_profissional,
        valor_salao: created.valor_salao,
        forma_pagamento: created.forma_pagamento,
        catalogo_itens: created.catalogo_itens,
      };
      startTransition(() => {
        setTransacoes((prev) => [row, ...prev.filter((t) => t.id !== row.id)]);
      });
      invalidateFinanceiroCache(ownerEmail);
    },
    [ownerEmail],
  );

  const handleCloseModal = useCallback(() => setShowModal(false), []);

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

  const relatorioProfissionais = useMemo(() => {
    const entradas = transacoesFiltradas.filter((t) => t.tipo === "entrada" && t.medico);
    const porProf: Record<
      string,
      {
        bruto: number;
        taxa: number;
        liquido: number;
        profissional: number;
        salao: number;
        qtd: number;
      }
    > = {};

    for (const t of entradas) {
      const nome = t.medico!;
      if (!porProf[nome]) {
        porProf[nome] = { bruto: 0, taxa: 0, liquido: 0, profissional: 0, salao: 0, qtd: 0 };
      }
      const bruto = t.valor_bruto ?? t.valor;
      const taxa = t.taxa_pagamento ?? 0;
      const liquido = t.valor_liquido ?? bruto - taxa;
      const vp = t.valor_profissional ?? 0;
      const vs = t.valor_salao ?? liquido - vp;
      porProf[nome].bruto += bruto;
      porProf[nome].taxa += taxa;
      porProf[nome].liquido += liquido;
      porProf[nome].profissional += vp;
      porProf[nome].salao += vs;
      porProf[nome].qtd += 1;
    }
    return Object.entries(porProf).sort((a, b) => b[1].profissional - a[1].profissional);
  }, [transacoesFiltradas]);

  return (
    <main className="min-h-screen bg-[#f8f9fa] pb-12">
      {/* Esconde a lista no mobile enquanto o modal está aberto — evita paint/layout da tabela atrás. */}
      <div
        className={`mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 ${
          showModal ? "hidden" : ""
        }`}
      >
        {/* Cabeçalho */}
        <div className="mb-8 rounded-4xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="inline-flex rounded-full bg-[#D9F0F2] px-3 py-1 text-sm font-semibold uppercase tracking-[0.24em] text-[#047482]">
                Financeiro
              </p>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                Controle de entradas e saídas
              </h1>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
                Registre atendimentos, despesas e acompanhe o repasse às profissionais.
              </p>
            </div>
          </div>
        </div>

        {/* Totalizadores */}
        <div className="mb-8 grid gap-4 lg:grid-cols-4">
          <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#047482]">
              Entradas
            </p>
            <p className="mt-4 text-3xl font-semibold text-[#047482]">
              {formatCurrency(totalEntradas)}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Receita acumulada no período.
            </p>
          </div>

          <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#047482]">
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
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#047482]">
              Saldo
            </p>
            <p
              className={`mt-4 text-3xl font-semibold ${
                saldo >= 0 ? "text-[#047482]" : "text-red-500"
              }`}
            >
              {formatCurrency(saldo)}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Diferença entre entradas e saídas.
            </p>
          </div>

          <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#047482]">
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

        {/* Modo de visualização */}
        <div className="mb-6 flex gap-2">
          <button
            type="button"
            onClick={() => setViewMode("transacoes")}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${
              viewMode === "transacoes"
                ? "bg-emerald-600 text-white"
                : "border border-slate-200 text-slate-600"
            }`}
          >
            Transações
          </button>
          <button
            type="button"
            onClick={() => setViewMode("repasse")}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${
              viewMode === "repasse"
                ? "bg-emerald-600 text-white"
                : "border border-slate-200 text-slate-600"
            }`}
          >
            Repasse profissionais
          </button>
          <button
            type="button"
            onClick={() => setViewMode("graficos")}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${
              viewMode === "graficos"
                ? "bg-emerald-600 text-white"
                : "border border-slate-200 text-slate-600"
            }`}
          >
            Visão gráfica
          </button>
        </div>

        {/* Filtros compartilhados */}
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

            <div className="min-w-[200px]">
              <MultiSelect
                label="Profissional"
                options={medicosOptions}
                selected={filterMedicos}
                onChange={setFilterMedicos}
                placeholder="Todas as profissionais"
              />
            </div>

            <div className="min-w-[200px]">
              <MultiSelect
                label="Cliente"
                options={clientesOptions}
                selected={filterClientes}
                onChange={setFilterClientes}
                placeholder="Todos os clientes"
              />
            </div>

            <div className="min-w-[200px]">
              <MultiSelect
                label="Forma de pagamento"
                options={formasPagamentoOptions}
                selected={filterFormasPagamento}
                onChange={setFilterFormasPagamento}
                placeholder="Todas as formas"
              />
            </div>

            <div className="min-w-[260px] flex-1">
              <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Busca
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  type="search"
                  aria-label="Buscar transações"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Buscar transação (cliente, descrição, valor...)"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
                {searchInput ? (
                  <button
                    type="button"
                    onClick={() => setSearchInput("")}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    Limpar
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {viewMode === "transacoes" && (
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
          )}
        </div>

        {viewMode === "repasse" && (
          <div className="mb-8 rounded-4xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#047482]">
                Relatório por profissional
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Bruto → taxa do meio de pagamento → líquido → comissão da profissional → parte do
                salão.
              </p>
            </div>
            {relatorioProfissionais.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500">
                Nenhuma entrada com profissional no período filtrado.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#eef4f5] text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-6 py-3">Profissional</th>
                      <th className="px-6 py-3 text-right">Atend.</th>
                      <th className="px-6 py-3 text-right">Bruto</th>
                      <th className="px-6 py-3 text-right">Taxa</th>
                      <th className="px-6 py-3 text-right">Líquido</th>
                      <th className="px-6 py-3 text-right">Parte prof.</th>
                      <th className="px-6 py-3 text-right">Parte salão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {relatorioProfissionais.map(([nome, r]) => (
                      <tr key={nome} className="border-t border-slate-50">
                        <td className="px-6 py-3 font-medium text-slate-900">{nome}</td>
                        <td className="px-6 py-3 text-right text-slate-600">{r.qtd}</td>
                        <td className="px-6 py-3 text-right">{formatCurrency(r.bruto)}</td>
                        <td className="px-6 py-3 text-right text-red-500">
                          {formatCurrency(r.taxa)}
                        </td>
                        <td className="px-6 py-3 text-right">{formatCurrency(r.liquido)}</td>
                        <td className="px-6 py-3 text-right font-semibold text-emerald-600">
                          {formatCurrency(r.profissional)}
                        </td>
                        <td className="px-6 py-3 text-right text-slate-700">
                          {formatCurrency(r.salao)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {viewMode === "graficos" && (
          <FinanceiroGraficos
            transacoes={transacoesFiltradas}
            startDate={startDate || undefined}
            endDate={endDate || undefined}
            loading={loading}
            ownerEmail={ownerEmail}
          />
        )}

        {viewMode === "transacoes" && (
        <>
        {Object.keys(totalPorMedico).length > 0 && (
          <div className="mb-8 rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-[#047482]">
              Repasse por profissional (splits)
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(totalPorMedico).map(([medico, valor]) => (
                <div
                  key={medico}
                  className="rounded-2xl border border-slate-100 bg-[#eef4f5] p-4"
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

        {/* Tabela de transações */}
        <div className="rounded-4xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#047482]">
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
                {debouncedSearchQuery
                  ? `Nenhuma transação encontrada para «${debouncedSearchQuery}».`
                  : "Nenhuma transação encontrada no período."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-t border-slate-100 bg-[#eef4f5]">
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
                      Profissional
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
                    <FinanceiroTransacaoRow
                      key={t.id}
                      t={t}
                      onDelete={handleDelete}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        </>
        )}
      </div>

      <FinanceiroNovaTransacaoModal
        open={showModal}
        onClose={handleCloseModal}
        onCreated={handleCreated}
        medicosOptions={medicosOptions}
      />
    </main>
  );
}
