'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
  TIPO_CONSULTA_UI,
  statusConsultaBadge,
  formatHorario,
  FORMAS_PAGAMENTO_CONSULTA,
  applyFinalizarConsulta,
  parseEventDate,
  consultationsListsEqual,
} from '@/lib/consultations';
import { reconcileConsultasFromFinanceiro } from '@/lib/reconcileConsultasFinanceiro';
import {
  dedupeConsultations,
  loadAndMergeConsultasFromServer,
  syncConsultaToServerImmediately,
} from '@/lib/syncConsultasClient';
import { revalidateFinanceiroCache, invalidateFinanceiroCache } from '@/lib/financeiroCache';
import { formatCurrency } from '@/lib/constants';
import { format } from 'date-fns';
import {
  formatItensResumo,
  formatObservacaoAtendimento,
  type AtendimentoItemLinha,
} from '@/lib/atendimentoItens';

const DASHBOARD_SYNC_DEFER_MS = 1500;
const REFRESH_DEBOUNCE_MS = 500;

type DashboardAgendaHojeProps = {
  userEmail?: string;
  onStatsChange?: (stats: ReturnType<typeof getDashboardStats>) => void;
};

export default function DashboardAgendaHoje({
  userEmail = '',
  onStatsChange,
}: DashboardAgendaHojeProps) {
  const { medicos, isClinica } = useMedicosOptions();
  const [events, setEvents] = useState<ConsultationRecord[]>([]);
  const [finalizando, setFinalizando] = useState<ConsultationRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const syncRemoteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncingRemoteRef = useRef(false);

  const applyLocal = useCallback(() => {
    const local = dedupeConsultations(loadConsultations());
    setEvents((prev) => (consultationsListsEqual(prev, local) ? prev : local));
    onStatsChange?.(getDashboardStats(local));
    return local;
  }, [onStatsChange]);

  const syncRemote = useCallback(async () => {
    if (syncingRemoteRef.current) return;
    syncingRemoteRef.current = true;
    const local = loadConsultations();

    try {
      let list = await loadAndMergeConsultasFromServer(local);

      if (userEmail) {
        try {
          const fin = await revalidateFinanceiroCache(userEmail, {});
          list = reconcileConsultasFromFinanceiro(list, fin);
        } catch {
          /* financeiro opcional */
        }
      }

      const merged = dedupeConsultations(list);
      setEvents((prev) => (consultationsListsEqual(prev, merged) ? prev : merged));
      onStatsChange?.(getDashboardStats(merged));

      if (!consultationsListsEqual(local, merged)) {
        saveConsultations(merged, { broadcast: false });
      }
    } catch {
      const localDeduped = dedupeConsultations(local);
      if (!consultationsListsEqual(local, localDeduped)) {
        saveConsultations(localDeduped, { broadcast: false });
      }
    } finally {
      syncingRemoteRef.current = false;
    }
  }, [onStatsChange, userEmail]);

  const scheduleSyncRemote = useCallback(() => {
    if (syncRemoteTimerRef.current) clearTimeout(syncRemoteTimerRef.current);
    syncRemoteTimerRef.current = setTimeout(() => {
      syncRemoteTimerRef.current = null;
      void syncRemote();
    }, REFRESH_DEBOUNCE_MS);
  }, [syncRemote]);

  useEffect(() => {
    applyLocal();
    const deferTimer = setTimeout(() => void syncRemote(), DASHBOARD_SYNC_DEFER_MS);

    const onConsultationsUpdated = () => {
      applyLocal();
      scheduleSyncRemote();
    };

    const onStorage = () => {
      applyLocal();
    };

    window.addEventListener('medsupapp-consultations-updated', onConsultationsUpdated);
    window.addEventListener('storage', onStorage);

    return () => {
      clearTimeout(deferTimer);
      if (syncRemoteTimerRef.current) clearTimeout(syncRemoteTimerRef.current);
      window.removeEventListener('medsupapp-consultations-updated', onConsultationsUpdated);
      window.removeEventListener('storage', onStorage);
    };
  }, [applyLocal, syncRemote, scheduleSyncRemote]);

  const hoje = getConsultasHoje(events);

  async function handleFinalizar(payload: {
    valorPago: number;
    valorOriginal: number;
    formaPagamento: FormaPagamentoConsulta;
    descontoPercent: number;
    descontoValor: number;
    parcelas: number;
    tipoConsulta: 'nova_consulta';
    medico: string;
    percentualProfissional: number;
    observacoes: string;
    catalogoItens: AtendimentoItemLinha[];
  }) {
    if (!finalizando?.id) return;
    setSaving(true);

    const formaLabel =
      FORMAS_PAGAMENTO_CONSULTA.find((f) => f.id === payload.formaPagamento)?.label ??
      payload.formaPagamento;
    const tipoLabel = 'Atendimento';
    const paciente = finalizando.patient ?? 'Cliente';
    const hojeStr = format(new Date(), 'yyyy-MM-dd');

    const updated = applyFinalizarConsulta(events, finalizando.id!, payload);
    const finalizedEvent = updated.find(
      (e) => String(e.id) === String(finalizando.id),
    );

    saveConsultations(updated);
    setEvents(dedupeConsultations(updated));
    setFinalizando(null);

    const dataConsulta = parseEventDate(finalizando.start);
    const dataFinanceiro = dataConsulta
      ? format(dataConsulta, 'yyyy-MM-dd')
      : hojeStr;
    const horaConsulta = dataConsulta ? format(dataConsulta, 'HH:mm') : null;

    if (finalizedEvent) {
      void syncConsultaToServerImmediately(finalizedEvent);
    }

    try {
      const itensResumo = formatItensResumo(payload.catalogoItens);
      const descParts = [
        tipoLabel,
        itensResumo || null,
        paciente,
        formaLabel,
        payload.parcelas > 1 ? `${payload.parcelas}x` : null,
        payload.descontoPercent || payload.descontoValor
          ? `Desc: ${payload.descontoPercent ? payload.descontoPercent + '%' : ''}${payload.descontoValor ? ' R$' + payload.descontoValor : ''}`
          : null,
      ].filter(Boolean);
      const financeiroObs = formatObservacaoAtendimento(
        payload.observacoes,
        payload.catalogoItens,
      );
      const pagamentoObs = `Pagamento: ${formaLabel}${payload.parcelas > 1 ? ` (${payload.parcelas}x)` : ''}`;

      await fetch('/api/financeiro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'entrada',
          descricao: descParts.join(' - '),
          data: dataFinanceiro,
          valor: payload.valorPago,
          categoria: 'consulta',
          medico: payload.medico,
          forma_pagamento: payload.formaPagamento,
          parcelas: payload.parcelas,
          percentual_profissional: payload.percentualProfissional,
          observacao: [financeiroObs, pagamentoObs].filter(Boolean).join(' · '),
          catalogo_itens: payload.catalogoItens.filter((i) => i.catalogoId),
        }),
      });
      if (userEmail) invalidateFinanceiroCache(userEmail);
    } catch {
      /* financeiro opcional se Drive/DB falhar */
    }

    if (finalizando.clienteDriveId) {
      try {
        await fetch(`/api/clientes/${finalizando.clienteDriveId}/finalizar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: dataFinanceiro,
            hora: horaConsulta,
            valor: payload.valorOriginal,
            valorOriginal: payload.valorOriginal,
            descontoPercent: payload.descontoPercent,
            descontoValor: payload.descontoValor,
            forma_pagamento: payload.formaPagamento,
            medico: payload.medico,
            parcelas: payload.parcelas,
            tipo: 'consulta',
            observacoes: payload.observacoes || null,
            catalogo_itens: payload.catalogoItens,
          }),
        });
      } catch {
        /* histórico do cliente opcional */
      }
    }

    setSaving(false);
    applyLocal();
  }

  return (
    <>
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Agenda de hoje</h2>
          <Link
            href="/agenda"
            className="text-sm text-[#047482] hover:underline flex items-center gap-1"
          >
            Ver agenda completa <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {hoje.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400 text-sm">Nenhum atendimento agendado para hoje.</p>
            <Link
              href="/agenda"
              className="inline-block mt-3 text-sm text-[#047482] font-medium hover:underline"
            >
              Agendar sessão
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {hoje.map((item) => {
              const st = statusConsultaBadge(item.status);
              const tipo =
                item.tipoConsulta && TIPO_CONSULTA_UI[item.tipoConsulta];
              const podeFinalizar =
                item.status !== 'realizado' &&
                item.status !== 'cancelado' &&
                item.status !== 'faltou';

              return (
                <div
                  key={String(item.id)}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border border-gray-100 hover:border-[#3795a1]/40 hover:bg-[#F8FAFC] transition"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="text-sm font-bold text-gray-800 w-14 shrink-0 tabular-nums">
                      {formatHorario(item)}
                    </div>
                    <div className="w-9 h-9 rounded-full bg-[#D9F0F2] flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-[#047482]" />
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
                          {item.service || 'Atendimento'}
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
                    {st && (
                      <span
                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${st.color}`}
                      >
                        {st.label}
                      </span>
                    )}
                    {podeFinalizar && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => setFinalizando(item)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold bg-[#047482] text-white px-3 py-2 rounded-lg hover:bg-[#035e6b] disabled:opacity-50 whitespace-nowrap"
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
          medicos={medicos}
          isClinica={isClinica}
          saving={saving}
          onClose={() => setFinalizando(null)}
          onConfirm={handleFinalizar}
        />
      )}
    </>
  );
}
