"use client";

import {
  Bar,
  BarChart,
  Cell,
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
  UserPlus,
  Clock,
  FileInput,
  Contact,
  PenLine,
} from "lucide-react";
import {
  CRM_DIAS_SEM_RETORNO,
  ORIGEM_CRM_LABELS,
  type ClienteOrigemCrm,
  type ClientesCrmStats,
} from "@/lib/clientesCrmStats";
import { formatPhoneDisplay } from "@/lib/phoneMatch";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const CHART_COLOR = "#047482";
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
  compact?: boolean;
};

function formatDataCurta(iso: string) {
  try {
    return format(parseISO(iso), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return iso.slice(0, 10);
  }
}

export default function ClientesCrmInsights({
  stats,
  onSelectCliente,
  compact = false,
}: Props) {
  const origemRows = (Object.keys(ORIGEM_CRM_LABELS) as ClienteOrigemCrm[]).map(
    (key) => ({
      key,
      label: ORIGEM_CRM_LABELS[key],
      total: stats.origem_base[key],
      novos_mes: stats.origem_novos_mes[key],
      color: ORIGEM_COLORS[key],
    }),
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#047482]">
            Novos este mês
          </p>
          <p className="mt-3 text-3xl font-semibold text-[#047482]">{stats.novos_mes}</p>
          <p className="mt-2 text-sm text-slate-600 capitalize">
            {stats.mes_referencia_label}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#047482]">
            Vs mês anterior
          </p>
          <div className="mt-3 flex items-center gap-2">
            {stats.variacao_vs_mes_anterior > 0 ? (
              <TrendingUp className="h-7 w-7 text-emerald-600" aria-hidden />
            ) : stats.variacao_vs_mes_anterior < 0 ? (
              <TrendingDown className="h-7 w-7 text-red-500" aria-hidden />
            ) : (
              <Minus className="h-7 w-7 text-slate-400" aria-hidden />
            )}
            <p
              className={`text-3xl font-semibold ${
                stats.variacao_vs_mes_anterior > 0
                  ? "text-emerald-600"
                  : stats.variacao_vs_mes_anterior < 0
                    ? "text-red-500"
                    : "text-slate-600"
              }`}
            >
              {stats.variacao_vs_mes_anterior > 0 ? "+" : ""}
              {stats.variacao_vs_mes_anterior}
            </p>
          </div>
          <p className="mt-2 text-sm text-slate-600 capitalize">
            {stats.novos_mes_anterior} em {stats.mes_anterior_label}
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

      {!compact && (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">
                Novos cadastros — últimos 6 meses
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Clientes que entraram na base por mês
              </p>
              <div className="mt-4 h-56" data-chart-body>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={stats.historico_meses}
                    margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                  >
                    <XAxis
                      dataKey="label_curto"
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(value) => [String(value ?? 0), "Novos"]}
                      labelFormatter={(_, payload) =>
                        payload?.[0]?.payload?.label ?? ""
                      }
                      contentStyle={{
                        borderRadius: "0.75rem",
                        border: "1px solid #e2e8f0",
                        fontSize: "0.875rem",
                      }}
                    />
                    <Bar dataKey="novos" name="Novos" radius={[6, 6, 0, 0]}>
                      {stats.historico_meses.map((entry) => (
                        <Cell
                          key={entry.mes}
                          fill={
                            entry.mes === stats.mes_referencia
                              ? CHART_COLOR
                              : "#94cbd3"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">Origem dos cadastros</h2>
              <p className="mt-1 text-sm text-slate-600">
                Base completa e novos de {stats.mes_referencia_label}
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
                          {row.total} na base · {row.novos_mes} novos este mês
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Clientes sem retorno
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Sessão realizada há mais de {CRM_DIAS_SEM_RETORNO} dias — oportunidade de
                  reativar
                </p>
              </div>
              {stats.sem_retorno.total > 0 && (
                <p className="text-sm font-medium text-amber-800">
                  {stats.sem_retorno.total} no total
                </p>
              )}
            </div>

            {stats.sem_retorno.clientes.length === 0 ? (
              <p className="mt-6 rounded-xl bg-emerald-50 px-4 py-6 text-center text-sm text-emerald-800">
                Nenhuma cliente sem retorno neste período. Ótimo sinal de fidelização.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-slate-100">
                {stats.sem_retorno.clientes.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => onSelectCliente?.(c.id)}
                      className="flex w-full items-center gap-3 py-3 text-left hover:bg-slate-50 rounded-lg px-2 -mx-2 transition"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800">
                        <UserPlus className="h-4 w-4" aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-900 truncate">{c.nome}</p>
                        <p className="text-xs text-slate-500">
                          Última sessão: {formatDataCurta(c.ultimo_atendimento)}
                          {c.telefone
                            ? ` · ${formatPhoneDisplay(c.telefone)}`
                            : ""}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">
                        {c.dias_sem_retorno}d
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
