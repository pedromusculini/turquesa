"use client";

import { useState } from "react";
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
  Clock,
  FileInput,
  Contact,
  PenLine,
} from "lucide-react";
import ClientesCrmSegmentoPanel from "@/components/ClientesCrmSegmentoPanel";
import {
  CRM_DIAS_SEM_RETORNO,
  ORIGEM_CRM_LABELS,
  type ClienteOrigemCrm,
  type ClientesCrmStats,
} from "@/lib/clientesCrmStats";

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
};

export default function ClientesCrmInsights({
  stats,
  onSelectCliente,
}: Props) {
  const [semRetornoDias, setSemRetornoDias] = useState(CRM_DIAS_SEM_RETORNO);
  const seg = stats.segmentos;
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
              const atual = row.mes === stats.mes_referencia;
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
          descricao="Sessão realizada há muito tempo — expanda para ordenar, paginar e enviar WhatsApp de resgate"
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
              descricao="Nunca tiveram sessão realizada — leads para converter"
              total={seg.sem_atendimento}
              onSelectCliente={onSelectCliente}
            />
            <ClientesCrmSegmentoPanel
              segmento="primeira_visita"
              titulo="Só vieram uma vez"
              descricao="Uma sessão realizada — risco de não voltar"
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
