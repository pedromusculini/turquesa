'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, User } from 'lucide-react';
import FinalizarConsultaModal from '@/components/FinalizarConsultaModal';
import { useMedicosOptions } from '@/lib/useMedicosOptions';
import {
  type ConsultationRecord,
  type FormaPagamentoConsulta,
  loadConsultations,
  saveConsultations,
  getConsultasHoje,
  getDashboardStats,
  STATUS_CONSULTA_UI,
  TIPO_CONSULTA_UI,
  formatHorario,
  FORMAS_PAGAMENTO_CONSULTA,
  applyFinalizarConsulta,
} from '@/lib/consultations';
import { formatCurrency } from '@/lib/constants';
import { format } from 'date-fns';

type DashboardAgendaHojeProps = {
  onStatsChange?: (stats: ReturnType<typeof getDashboardStats>) => void;
};

export default function DashboardAgendaHoje({ onStatsChange }: DashboardAgendaHojeProps) {
  const { medicos, isClinica } = useMedicosOptions();
  const [events, setEvents] = useState<ConsultationRecord[]>([]);
  const [finalizando, setFinalizando] = useState<ConsultationRecord | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(() => {
    const list = loadConsultations();
    setEvents(list);
    onStatsChange?.(getDashboardStats(list));
  }, [onStatsChange]);

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener('medsupapp-consultations-updated', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('medsupapp-consultations-updated', handler);
      window.removeEventListener('storage', handler);
    };
  }, [refresh]);

  const hoje = getConsultasHoje(events);

  async function handleFinalizar(payload: {
    valorPago: number;
    valorOriginal: number;
    formaPagamento: FormaPagamentoConsulta;
    convenio: string;
    descontoPercent: number;
    descontoValor: number;
    parcelas: number;
    tipoConsulta: 'nova_consulta' | 'retorno';
    medico: string;
  }) {
    if (!finalizando?.id) return;
    setSaving(true);

    const formaLabel =
      FORMAS_PAGAMENTO_CONSULTA.find((f) => f.id === payload.formaPagamento)?.label ??
      payload.formaPagamento;
    const tipoLabel = payload.tipoConsulta === 'retorno' ? 'Retorno' : 'Nova consulta';
    const paciente = finalizando.patient ?? 'Paciente';
    const hojeStr = format(new Date(), 'yyyy-MM-dd');

    const updated = applyFinalizarConsulta(events, finalizando.id!, payload);

    saveConsultations(updated);
    setEvents(updated);
    setFinalizando(null);

    try {
      const descParts = [
        tipoLabel,
        paciente,
        formaLabel,
        payload.convenio ? `Convênio: ${payload.convenio}` : null,
        payload.parcelas > 1 ? `${payload.parcelas}x` : null,
        payload.descontoPercent || payload.descontoValor
          ? `Desc: ${payload.descontoPercent ? payload.descontoPercent + '%' : ''}${payload.descontoValor ? ' R$' + payload.descontoValor : ''}`
          : null,
      ].filter(Boolean);

      await fetch('/api/financeiro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'entrada',
          descricao: descParts.join(' - '),
          data: hojeStr,
          valor: payload.valorPago,
          categoria: payload.tipoConsulta === 'retorno' ? 'consulta' : 'consulta',
          observacao: `Pagamento: ${formaLabel}${payload.parcelas > 1 ? ` (${payload.parcelas}x)` : ''}`,
        }),
      });
    } catch {
      /* financeiro opcional se Drive/DB falhar */
    }

    setSaving(false);
    refresh();
  }

  return (
    <>
      <div className="lg:col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Agenda de hoje</h2>
          <Link
            href="/agenda"
            className="text-sm text-[#228B22] hover:underline flex items-center gap-1"
          >
            Ver agenda completa <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {hoje.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400 text-sm">Nenhuma consulta agendada para hoje.</p>
            <Link
              href="/agenda"
              className="inline-block mt-3 text-sm text-[#228B22] font-medium hover:underline"
            >
              Agendar consulta
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {hoje.map((item) => {
              const st =
                STATUS_CONSULTA_UI[item.status ?? 'confirmado'] ??
                STATUS_CONSULTA_UI.confirmado;
              const tipo =
                item.tipoConsulta && TIPO_CONSULTA_UI[item.tipoConsulta];
              const podeFinalizar =
                item.status !== 'realizado' &&
                item.status !== 'cancelado' &&
                item.status !== 'faltou';

              return (
                <div
                  key={String(item.id)}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border border-gray-100 hover:border-green-100 hover:bg-[#fafffa] transition"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="text-sm font-bold text-gray-800 w-14 shrink-0 tabular-nums">
                      {formatHorario(item)}
                    </div>
                    <div className="w-9 h-9 rounded-full bg-green-50 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-[#228B22]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 truncate">
                        {item.patient || 'Sem nome'}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                        {tipo && (
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${tipo.color}`}
                          >
                            {tipo.label}
                          </span>
                        )}
                        <span className="text-xs text-gray-400">
                          {item.service || 'Consulta'}
                        </span>
                        {item.medico && (
                          <span className="text-xs text-gray-500">· {item.medico}</span>
                        )}
                        {item.convenio && (
                          <span className="text-xs text-gray-500">· {item.convenio}</span>
                        )}
                      </div>
                      {item.status === 'realizado' && item.payment && (
                        <p className="text-xs text-green-700 mt-1 font-medium">
                          {formatCurrency(item.payment.valorPago)} ·{' '}
                          {
                            FORMAS_PAGAMENTO_CONSULTA.find(
                              (f) => f.id === item.payment?.formaPagamento,
                            )?.label
                          }
                          {item.payment.parcelas && item.payment.parcelas > 1
                            ? ` (${item.payment.parcelas}x)`
                            : ''}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:shrink-0 pl-[4.25rem] sm:pl-0">
                    <span
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${st.color}`}
                    >
                      {st.label}
                    </span>
                    {podeFinalizar && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => setFinalizando(item)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold bg-[#013a01] text-white px-3 py-2 rounded-lg hover:bg-[#025201] disabled:opacity-50 whitespace-nowrap"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Finalizar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {finalizando && (
        <FinalizarConsultaModal
          consulta={finalizando}
          allEvents={events}
          medicos={medicos}
          isClinica={isClinica}
          onClose={() => setFinalizando(null)}
          onConfirm={handleFinalizar}
        />
      )}
    </>
  );
}
