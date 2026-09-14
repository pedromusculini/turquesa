"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Users,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  FileInput,
  Contact,
  PenLine,
  Megaphone,
  Target,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import ClientesCrmSegmentoPanel from "@/components/ClientesCrmSegmentoPanel";
import {
  CRM_DIAS_SEM_RETORNO,
  ORIGEM_CRM_LABELS,
  type ClienteOrigemCrm,
  type ClientesCrmStats,
} from "@/lib/clientesCrmStats";
import {
  CRM_PERIODO_DEFAULT,
  CRM_PERIODO_IDS,
  CRM_PERIODO_LABELS,
  aggregateMarketingPeriodo,
  aggregateNovosPeriodo,
  isCrmPeriodoId,
  orderedHistoricoMeses,
  resolveCrmPeriodo,
  type CrmPeriodoId,
} from "@/lib/clientesCrmPeriodo";

const CHART_COLOR = "#047482";
const CHART_PREV_COLOR = "#c69c6c";
const CHART_CONTEXT_COLOR = "#94cbd3";
const MARKETING_GASTO_COLOR = "#7c3aed";
const CAC_LINE_COLOR = "#4338ca";
const ORIGEM_COLORS: Record<ClienteOrigemCrm, string> = {
  manual: "#3795a1",
  formulario: "#c69c6c",
  google_contatos: "#64748b",
};

const ORIGEM_ICONS: Record<ClienteOrigemCrm, typeof PenLine> = {
  manual: PenLine,
  formulario: FileInput,
  google_contatos: Contact,
};

type Props = {
  stats: ClientesCrmStats;
  onSelectCliente?: (id: string) => void;
};

export default function ClientesCrmInsights({
  stats,
  onSelectCliente,
}: Props) {
  const [semRetornoDias, setSemRetornoDias] = useState(CRM_DIAS_SEM_RETORNO);
  const [periodo, setPeriodo] = useState<CrmPeriodoId>(CRM_PERIODO_DEFAULT);
  const seg = stats.segmentos;
  const mkt = stats.marketing;
  const fmtBrl = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const fmtRoi = (v: number | null) =>
    v != null
      ? `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}x`
      : "—";

  const range = useMemo(() => resolveCrmPeriodo(periodo), [periodo]);
  const novosKpis = useMemo(
    () => aggregateNovosPeriodo(stats.historico_meses, range),
    [stats.historico_meses, range],
  );
  const mktKpis = useMemo(
    () =>
      mkt
        ? aggregateMarketingPeriodo(
            mkt.historico,
            range,
            novosKpis.novos,
            novosKpis.novosAnterior,
          )
        : null,
    [mkt, range, novosKpis.novos, novosKpis.novosAnterior],
  );
  const chartRows = useMemo(() => {
    const source = mkt?.historico ?? stats.historico_meses;
    return orderedHistoricoMeses(
      source as Array<{ mes: string; novos: number; label?: string; label_curto?: string }>,
      range.mesesGrafico,
    );
  }, [mkt?.historico, stats.historico_meses, range.mesesGrafico]);
  const selectedMesSet = useMemo(() => new Set(range.meses), [range.meses]);
  const prevMesSet = useMemo(
    () => new Set(range.mesesAnterior),
    [range.mesesAnterior],
  );
  const origemRows = (Object.keys(ORIGEM_CRM_LABELS) as ClienteOrigemCrm[]).map(
    (key) => ({
      key,
      label: ORIGEM_CRM_LABELS[key],
      total: stats.origem_base[key],
      novos_mes: novosKpis.origem[key],
      color: ORIGEM_COLORS[key],
    }),
  );
  const prevLineLabel =
    range.mesesAnterior.length === 1 ? "Mês anterior" : "Período anterior";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Indicadores</h2>
          <p className="mt-1 text-sm text-slate-600">
            {range.periodoLabel} · comparado a {range.periodoAnteriorLabel}
          </p>
        </div>
        <label className="block sm:min-w-[220px]">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Período
          </span>
          <select
            value={periodo}
            onChange={(e) => {
              const next = e.target.value;
              if (isCrmPeriodoId(next)) setPeriodo(next);
            }}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-[#047482] focus:outline-none focus:ring-2 focus:ring-[#047482]/20"
          >
            {CRM_PERIODO_IDS.map((id) => (
              <option key={id} value={id}>
                {CRM_PERIODO_LABELS[id]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#047482]">
            Novos no período
          </p>
          <p className="mt-3 text-3xl font-semibold text-[#047482]">{novosKpis.novos}</p>
          <p className="mt-2 text-sm text-slate-600 capitalize">{range.periodoLabel}</p>
          <p className="mt-1 text-xs text-slate-500">
            {prevLineLabel}:{" "}
            <span className="font-medium text-slate-700">{novosKpis.novosAnterior}</span>
            <span className="text-slate-400"> · {range.periodoAnteriorLabel}</span>
          </p>
        </div>

        <div className="rounded-2xl border border-violet-200 bg-violet-50/40 p-5 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-violet-800">
            Marketing no período
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Megaphone className="h-7 w-7 text-violet-600" aria-hidden />
            <p className="text-3xl font-semibold text-violet-950">
              {mktKpis ? fmtBrl(mktKpis.gasto) : "—"}
            </p>
          </div>
          <p className="mt-2 text-sm text-violet-900/80">
            {mktKpis && mktKpis.transacoes > 0
              ? `${mktKpis.transacoes} despesa(s) · Financeiro`
              : "Lance saídas categoria Marketing"}
          </p>
          <p className="mt-1 text-xs text-violet-800/70">
            {prevLineLabel}: {mktKpis ? fmtBrl(mktKpis.gastoAnterior) : "—"}
          </p>
        </div>

        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-indigo-800">
            CAC
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Target className="h-7 w-7 text-indigo-600" aria-hidden />
            <p className="text-3xl font-semibold text-indigo-950">
              {mktKpis?.cac != null ? fmtBrl(mktKpis.cac) : "—"}
            </p>
          </div>
          <p className="mt-2 text-sm text-indigo-900/80">
            Custo por nova cliente cadastrada
          </p>
          <p className="mt-1 text-xs text-indigo-800/70">
            {prevLineLabel}: {mktKpis?.cacAnterior != null ? fmtBrl(mktKpis.cacAnterior) : "—"}
            {mktKpis?.variacaoCacPct != null && (
              <span
                className={
                  mktKpis.variacaoCacPct <= 0 ? " text-emerald-700" : " text-red-600"
                }
              >
                {" "}
                ({mktKpis.variacaoCacPct > 0 ? "+" : ""}
                {mktKpis.variacaoCacPct}%)
              </span>
            )}
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-emerald-800">
            ROI 1ª sessão
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-emerald-600" aria-hidden />
            <p className="text-3xl font-semibold text-emerald-950">{fmtRoi(mktKpis?.roi ?? null)}</p>
          </div>
          <p className="mt-2 text-sm text-emerald-900/80">
            Receita média da 1ª visita ÷ CAC
          </p>
          <p className="mt-1 text-xs text-emerald-800/70">
            {mktKpis?.receitaMediaPrimeiraSessao != null ? (
              <>
                Média {fmtBrl(mktKpis.receitaMediaPrimeiraSessao)}
                {novosKpis.novos > 0 && (
                  <>
                    {" "}
                    · {mktKpis.novosComPrimeiraSessao} de {novosKpis.novos} novos já
                    atenderam
                  </>
                )}
              </>
            ) : (
              "Sem 1ª sessão paga no período"
            )}
          </p>
          <p className="mt-1 text-xs text-emerald-800/70">
            {prevLineLabel}: {fmtRoi(mktKpis?.roiAnterior ?? null)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#047482]">
            Vs período anterior
          </p>
          <div className="mt-3 flex items-center gap-2">
            {novosKpis.variacao > 0 ? (
              <TrendingUp className="h-7 w-7 text-emerald-600" aria-hidden />
            ) : novosKpis.variacao < 0 ? (
              <TrendingDown className="h-7 w-7 text-red-500" aria-hidden />
            ) : (
              <Minus className="h-7 w-7 text-slate-400" aria-hidden />
            )}
            <p
              className={`text-3xl font-semibold ${
                novosKpis.variacao > 0
                  ? "text-emerald-600"
                  : novosKpis.variacao < 0
                    ? "text-red-500"
                    : "text-slate-600"
              }`}
            >
              {novosKpis.variacao > 0 ? "+" : ""}
              {novosKpis.variacao}
            </p>
          </div>
          <p className="mt-2 text-sm text-slate-600 capitalize">
            {novosKpis.novosAnterior} em {range.periodoAnteriorLabel}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#047482]">
            Sem retorno
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Clock className="h-7 w-7 text-amber-600" aria-hidden />
            <p className="text-3xl font-semibold text-amber-700">
              {stats.sem_retorno.total}
            </p>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            +{stats.sem_retorno.dias_limite} dias desde última sessão realizada
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#047482]">
            Total cadastradas
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Users className="h-7 w-7 text-slate-400" aria-hidden />
            <p className="text-3xl font-semibold text-slate-950">{stats.total}</p>
          </div>
          <p className="mt-2 text-sm text-slate-600">Base no Google Drive</p>
        </div>
      </div>

      {mkt && (
        <p className="text-sm text-slate-600">
          Marketing, CAC e ROI usam despesas do{" "}
          <Link href="/financeiro" className="font-medium text-[#047482] underline-offset-2 hover:underline">
            Financeiro
          </Link>{" "}
          (categoria Marketing) e a receita da primeira sessão das clientes novas do período. ROI acima de 1x
          indica que a 1ª visita já cobre o custo de aquisição. O gráfico inclui o mês anterior ao período
          (barra dourada).
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
              <h2 className="text-base font-semibold text-slate-900">
                Novos cadastros, marketing e CAC — {range.label.toLowerCase()}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Barras: novas clientes · dourado = mês/período anterior · linhas: gasto em marketing e CAC (R$)
              </p>
              <div className="mt-4 h-72" data-chart-body>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={chartRows}
                    margin={{ top: 8, right: 12, left: -8, bottom: 0 }}
                  >
                    <XAxis
                      dataKey="label_curto"
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="left"
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) =>
                        Number(v).toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                          maximumFractionDigits: 0,
                        })
                      }
                    />
                    <Tooltip
                      formatter={(value, name) => {
                        const n = Number(value ?? 0);
                        if (name === "Novos") return [String(n), "Novos"];
                        if (name === "Gasto marketing")
                          return [fmtBrl(n), "Gasto marketing"];
                        if (name === "CAC") return [fmtBrl(n), "CAC"];
                        return [String(value ?? ""), String(name ?? "")];
                      }}
                      labelFormatter={(_, payload) =>
                        payload?.[0]?.payload?.label ?? ""
                      }
                      contentStyle={{
                        borderRadius: "0.75rem",
                        border: "1px solid #e2e8f0",
                        fontSize: "0.875rem",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "0.75rem" }} />
                    <Bar
                      yAxisId="left"
                      dataKey="novos"
                      name="Novos"
                      radius={[6, 6, 0, 0]}
                      barSize={28}
                    >
                      {chartRows.map((entry) => (
                        <Cell
                          key={entry.mes}
                          fill={
                            selectedMesSet.has(entry.mes)
                              ? CHART_COLOR
                              : prevMesSet.has(entry.mes)
                                ? CHART_PREV_COLOR
                                : CHART_CONTEXT_COLOR
                          }
                        />
                      ))}
                    </Bar>
                    {mkt && (
                      <>
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="gasto_marketing"
                          name="Gasto marketing"
                          stroke={MARKETING_GASTO_COLOR}
                          strokeWidth={2}
                          dot={{ r: 3, fill: MARKETING_GASTO_COLOR }}
                          connectNulls
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="cac"
                          name="CAC"
                          stroke={CAC_LINE_COLOR}
                          strokeWidth={2}
                          dot={{ r: 3, fill: CAC_LINE_COLOR }}
                          connectNulls
                        />
                      </>
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">Origem dos cadastros</h2>
              <p className="mt-1 text-sm text-slate-600">
                Base completa e novos de {range.periodoLabel}
              </p>
              <ul className="mt-4 space-y-3">
                {origemRows.map((row) => {
                  const Icon = ORIGEM_ICONS[row.key];
                  return (
                    <li
                      key={row.key}
                      className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3"
                    >
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
                        style={{ backgroundColor: row.color }}
                      >
                        <Icon className="h-4 w-4" aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900">{row.label}</p>
                        <p className="text-xs text-slate-500">
                          {row.total} na base · {row.novos_mes} novos no período
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
      </div>

      {seg && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Aniversariantes
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{seg.aniversariantes_mes}</p>
            <p className="mt-1 text-xs capitalize text-slate-500">{seg.mes_aniversario_label}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Sem atendimento
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{seg.sem_atendimento}</p>
            <p className="mt-1 text-xs text-slate-500">Cadastro sem sessão realizada</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Ticket médio
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {seg.ticket_medio > 0
                ? seg.ticket_medio.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })
                : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-500">Por sessão realizada</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Serviço top
            </p>
            <p className="mt-2 truncate text-lg font-semibold text-slate-900">
              {seg.servico_mais_realizado?.nome ?? "—"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {seg.servico_mais_realizado
                ? `${seg.servico_mais_realizado.total} ${
                    seg.servico_mais_realizado.total === 1 ? "vez" : "vezes"
                  } · histórico geral`
                : "Sem histórico pago"}
            </p>
          </div>
        </div>
      )}

      {seg && seg.servicos_top_mes.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Serviço top por mês</h2>
          <p className="mt-1 text-sm text-slate-600">
            Serviços do catálogo mais lançados após pagamento — últimos 6 meses
          </p>
          <ul className="mt-4 space-y-2">
            {seg.servicos_top_mes.map((row) => {
              const atual = selectedMesSet.has(row.mes);
              return (
                <li
                  key={row.mes}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-3 ${
                    atual
                      ? "border-[#047482]/30 bg-[#047482]/5"
                      : "border-slate-100 bg-slate-50/80"
                  }`}
                >
                  <div className="w-16 shrink-0">
                    <p
                      className={`text-xs font-semibold uppercase tracking-wide ${
                        atual ? "text-[#047482]" : "text-slate-500"
                      }`}
                    >
                      {row.label_curto}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {row.servico?.nome ?? "—"}
                    </p>
                    <p className="text-xs capitalize text-slate-500">{row.label}</p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-700">
                    {row.servico
                      ? `${row.servico.total} ${row.servico.total === 1 ? "vez" : "vezes"}`
                      : "—"}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="space-y-4">
        <ClientesCrmSegmentoPanel
          segmento="sem_retorno"
          titulo="Clientes sem retorno"
          descricao="Sessão realizada há muito tempo — exclui quem já tem agendamento futuro"
          total={stats.sem_retorno.total}
          onSelectCliente={onSelectCliente}
          showWhatsApp
          diasLimite={semRetornoDias}
          onDiasLimiteChange={setSemRetornoDias}
        />
        {seg && (
          <>
            <ClientesCrmSegmentoPanel
              segmento="aniversariantes"
              titulo="Aniversariantes do mês"
              descricao={`Clientes com aniversário em ${seg.mes_aniversario_label}`}
              total={seg.aniversariantes_mes}
              onSelectCliente={onSelectCliente}
            />
            <ClientesCrmSegmentoPanel
              segmento="sem_atendimento"
              titulo="Cadastradas sem atendimento"
              descricao="Nunca tiveram sessão realizada — exclui quem já tem agendamento futuro"
              total={seg.sem_atendimento}
              onSelectCliente={onSelectCliente}
            />
            <ClientesCrmSegmentoPanel
              segmento="primeira_visita"
              titulo="Só vieram uma vez"
              descricao="Uma sessão realizada — risco de não voltar; envie WhatsApp de resgate"
              total={seg.primeira_visita}
              onSelectCliente={onSelectCliente}
            />
            <ClientesCrmSegmentoPanel
              segmento="fidelizadas"
              titulo="Clientes fidelizadas"
              descricao="Duas ou mais sessões realizadas"
              total={seg.fidelizadas}
              onSelectCliente={onSelectCliente}
            />
            <ClientesCrmSegmentoPanel
              segmento="com_faltas"
              titulo="Com histórico de faltas"
              descricao="Alguma sessão marcada como faltou"
              total={seg.com_faltas}
              onSelectCliente={onSelectCliente}
            />
            <ClientesCrmSegmentoPanel
              segmento="top_clientes"
              titulo="Top clientes"
              descricao="Ordenadas pelo valor total em sessões realizadas"
              total={seg.fidelizadas + seg.primeira_visita}
              onSelectCliente={onSelectCliente}
            />
          </>
        )}
      </div>
    </div>
  );
}
