"use client";

import { useMemo, useRef, useState } from "react";
import { Download, Printer } from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_COLORS, CORES } from "@/lib/visual/brand";
import {
  agregarPorDia,
  agregarPorFormaPagamento,
  agregarPorProfissional,
  gerarCsvGraficos,
  type FormaPagamentoSlice,
  type ProfissionalBar,
  type SerieTemporal,
  type TransacaoAgregavel,
} from "@/lib/financeiroAgregados";
import {
  downloadChartCardPng,
  periodSuffixForFilename,
  printAllCharts,
  printChartCard,
} from "@/lib/chartExport";
import { downloadCsv } from "@/lib/csv-export";

type Props = {
  transacoes: TransacaoAgregavel[];
  startDate?: string;
  endDate?: string;
  loading?: boolean;
};

function formatCurrency(val: number) {
  return `R$ ${val.toFixed(2).replace(".", ",")}`;
}

function ChartActionButton({
  onClick,
  label,
  icon: Icon,
  disabled,
}: {
  onClick: () => void;
  label: string;
  icon: typeof Download;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[#2d652d] transition hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </button>
  );
}

function ChartCard({
  title,
  subtitle,
  slug,
  periodSuffix,
  children,
  emptyMessage,
  isEmpty,
  csvRows,
}: {
  title: string;
  subtitle?: string;
  slug: string;
  periodSuffix: string;
  children: React.ReactNode;
  emptyMessage: string;
  isEmpty: boolean;
  csvRows: string[][];
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const handleDownloadPng = async () => {
    if (!cardRef.current || isEmpty) return;
    setExporting(true);
    try {
      await downloadChartCardPng(
        cardRef.current,
        `financeiro-${slug}-${periodSuffix}.png`,
      );
    } catch {
      alert("Não foi possível baixar o gráfico. Tente novamente.");
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = () => {
    if (!cardRef.current || isEmpty) return;
    printChartCard(cardRef.current);
  };

  const handleCsv = () => {
    if (isEmpty) return;
    const csv = csvRows.map((row) => row.join(";")).join("\n");
    downloadCsv(csv, `financeiro-${slug}-${periodSuffix}.csv`);
  };

  return (
    <div
      ref={cardRef}
      className="financeiro-chart-card rounded-4xl border border-slate-200 bg-white p-6 shadow-sm"
      data-chart-slug={slug}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p
            data-chart-title
            className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2d652d]"
          >
            {title}
          </p>
          {subtitle && (
            <p data-chart-subtitle className="mt-1 text-sm text-slate-500">
              {subtitle}
            </p>
          )}
        </div>
        <div className="financeiro-chart-actions flex flex-wrap gap-2">
          <ChartActionButton
            onClick={handleDownloadPng}
            label={exporting ? "Gerando..." : "Baixar PNG"}
            icon={Download}
            disabled={isEmpty || exporting}
          />
          <ChartActionButton
            onClick={handlePrint}
            label="Imprimir"
            icon={Printer}
            disabled={isEmpty}
          />
          <ChartActionButton
            onClick={handleCsv}
            label="CSV"
            icon={Download}
            disabled={isEmpty}
          />
        </div>
      </div>
      {isEmpty ? (
        <p className="mt-8 text-center text-sm text-slate-500">{emptyMessage}</p>
      ) : (
        <div data-chart-body className="mt-6 h-72">
          {children}
        </div>
      )}
    </div>
  );
}

export default function FinanceiroGraficos({
  transacoes,
  startDate,
  endDate,
  loading,
}: Props) {
  const sectionRef = useRef<HTMLDivElement>(null);

  const porForma = useMemo(
    () => agregarPorFormaPagamento(transacoes),
    [transacoes],
  );
  const porProfissional = useMemo(
    () => agregarPorProfissional(transacoes),
    [transacoes],
  );
  const porPeriodo = useMemo(
    () => agregarPorDia(transacoes, startDate, endDate),
    [transacoes, startDate, endDate],
  );

  const periodSuffix = periodSuffixForFilename(startDate, endDate);
  const hasAnyData =
    porForma.length > 0 ||
    porProfissional.length > 0 ||
    porPeriodo.length > 0;

  const handleExportAllCsv = () => {
    const csv = gerarCsvGraficos({ porForma, porProfissional, porPeriodo });
    downloadCsv(csv, `financeiro-graficos-${periodSuffix}.csv`);
  };

  const handlePrintAll = () => {
    if (sectionRef.current) {
      printAllCharts(sectionRef.current);
    } else {
      window.print();
    }
  };

  if (loading) {
    return (
      <div className="rounded-4xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
        Carregando gráficos...
      </div>
    );
  }

  return (
    <div
      ref={sectionRef}
      id="financeiro-graficos-print"
      className="financeiro-graficos-print-area space-y-6"
    >
      <div className="financeiro-graficos-toolbar flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mr-auto text-sm text-slate-600">
          Baixe cada gráfico em PNG ou exporte os dados para comparar períodos.
        </p>
        <ChartActionButton
          onClick={handlePrintAll}
          label="Imprimir todos"
          icon={Printer}
          disabled={!hasAnyData}
        />
        <ChartActionButton
          onClick={handleExportAllCsv}
          label="Exportar CSV dos gráficos"
          icon={Download}
          disabled={!hasAnyData}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Receita por forma de pagamento"
          subtitle="Distribuição das entradas no período filtrado."
          slug="formas-pagamento"
          periodSuffix={periodSuffix}
          isEmpty={porForma.length === 0}
          emptyMessage="Nenhuma entrada com forma de pagamento no período."
          csvRows={formaPagamentoCsvRows(porForma)}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={porForma}
                dataKey="valor"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius="55%"
                outerRadius="80%"
                paddingAngle={2}
              >
                {porForma.map((_, i) => (
                  <Cell
                    key={porForma[i].id}
                    fill={CHART_COLORS[i % CHART_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => formatCurrency(Number(value ?? 0))}
                contentStyle={{
                  borderRadius: "0.75rem",
                  border: "1px solid #e2e8f0",
                  fontSize: "0.875rem",
                }}
              />
              <Legend
                verticalAlign="bottom"
                formatter={(value) => (
                  <span className="text-xs text-slate-600">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Repasse por profissional"
          subtitle="Valor da comissão da profissional (parte prof.)."
          slug="repasse-profissional"
          periodSuffix={periodSuffix}
          isEmpty={porProfissional.length === 0}
          emptyMessage="Nenhuma entrada com profissional no período."
          csvRows={profissionalCsvRows(porProfissional)}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={porProfissional}
              layout="vertical"
              margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
            >
              <XAxis
                type="number"
                tickFormatter={(v) =>
                  v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}k` : formatCurrency(v)
                }
                tick={{ fontSize: 11, fill: "#64748b" }}
              />
              <YAxis
                type="category"
                dataKey="nome"
                width={100}
                tick={{ fontSize: 11, fill: "#334155" }}
              />
              <Tooltip
                formatter={(value) => formatCurrency(Number(value ?? 0))}
                contentStyle={{
                  borderRadius: "0.75rem",
                  border: "1px solid #e2e8f0",
                  fontSize: "0.875rem",
                }}
              />
              <Bar dataKey="valor" name="Parte prof." radius={[0, 6, 6, 0]}>
                {porProfissional.map((_, i) => (
                  <Cell
                    key={porProfissional[i].nome}
                    fill={CHART_COLORS[i % CHART_COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Entradas ao longo do tempo"
          subtitle={
            porPeriodo.length > 0 && porPeriodo[0].label.startsWith("Sem.")
              ? "Agrupado por semana (período longo)."
              : "Agrupado por dia."
          }
          slug="entradas-tempo"
          periodSuffix={periodSuffix}
          isEmpty={porPeriodo.length === 0}
          emptyMessage="Nenhuma entrada no período filtrado."
          csvRows={periodoCsvRows(porPeriodo)}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={porPeriodo}
              margin={{ top: 8, right: 16, left: 8, bottom: 4 }}
            >
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#64748b" }}
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={(v) =>
                  v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}k` : `R$ ${v}`
                }
                tick={{ fontSize: 11, fill: "#64748b" }}
                width={56}
              />
              <Tooltip
                formatter={(value) => formatCurrency(Number(value ?? 0))}
                labelFormatter={(label) => `Período: ${label}`}
                contentStyle={{
                  borderRadius: "0.75rem",
                  border: "1px solid #e2e8f0",
                  fontSize: "0.875rem",
                }}
              />
              <Line
                type="monotone"
                dataKey="valor"
                name="Entradas"
                stroke={CORES.primary}
                strokeWidth={2}
                dot={{ fill: CORES.primary, r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function formaPagamentoCsvRows(data: FormaPagamentoSlice[]): string[][] {
  return [
    ["Forma", "Valor (R$)"],
    ...data.map((f) => [f.label, f.valor.toFixed(2)]),
  ];
}

function profissionalCsvRows(data: ProfissionalBar[]): string[][] {
  return [
    ["Profissional", "Parte prof. (R$)"],
    ...data.map((p) => [p.nome, p.valor.toFixed(2)]),
  ];
}

function periodoCsvRows(data: SerieTemporal[]): string[][] {
  return [
    ["Período", "Rótulo", "Valor (R$)"],
    ...data.map((s) => [s.periodo, s.label, s.valor.toFixed(2)]),
  ];
}
