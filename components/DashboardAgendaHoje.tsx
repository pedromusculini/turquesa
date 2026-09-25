'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, User } from 'lucide-react';
import FinalizarConsultaModal from '@/components/FinalizarConsultaModal';
import PacoteWhatsAppPrompt, { type PacoteWhatsAppData } from '@/components/PacoteWhatsAppPrompt';
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
import {
  MSG_FINALIZAR_CLIENTE_FALHOU,
  MSG_FINALIZAR_SEM_CLIENTE_DRIVE,
  MSG_FINANCEIRO_FALHOU,
  postFinalizarClienteFromAgenda,
  postFinanceiroEntradaFromAgenda,
} from '@/lib/finalizarClienteFromAgenda';
import { inferSyncHealth } from '@/lib/agendaSyncHealthUi';

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
  const [pacotePrompt, setPacotePrompt] = useState<{
    data: PacoteWhatsAppData;
    resumo: string | null;
  } | null>(null);
  const syncRemoteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncingRemoteRef = useRef(false);

  const applyLocal = useCallback(() => {
    const local = dedupeConsultations(loadConsultations(userEmail));
    setEvents((prev) => (consultationsListsEqual(prev, local) ? prev : local));
    onStatsChange?.(getDashboardStats(local));
    return local;
  }, [onStatsChange, userEmail]);

  const syncRemote = useCallback(async () => {
    if (syncingRemoteRef.current) return;
    syncingRemoteRef.current = true;
    const local = loadConsultations(userEmail);

    try {
      const [serverList, fin] = await Promise.all([
        loadAndMergeConsultasFromServer(local),
        userEmail
          ? revalidateFinanceiroCache(userEmail, {}).catch(() => null)
          : Promise.resolve(null),
      ]);

      let list = serverList;
      if (fin) {
        list = reconcileConsultasFromFinanceiro(list, fin);
      }

      const merged = dedupeConsultations(list);
      setEvents((prev) => (consultationsListsEqual(prev, merged) ? prev : merged));
      onStatsChange?.(getDashboardStats(merged));

      if (!consultationsListsEqual(local, merged)) {
        saveConsultations(merged, { broadcast: false, ownerEmail: userEmail });
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

  const hoje = getConsultasHoje(events).filter(
    (item) => inferSyncHealth(item) === 'linked_ok',
  );

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
    pacoteId?: string | null;
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

    // Sessão de pacote: o dinheiro entrou no financeiro na venda do pacote.
    if (!payload.pacoteId) try {
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

      const financeiroRes = await postFinanceiroEntradaFromAgenda({
        descricao: descParts.join(' - '),
        data: dataFinanceiro,
        valor: payload.valorPago,
        medico: payload.medico,
        forma_pagamento: payload.formaPagamento,
        parcelas: payload.parcelas,
        percentual_profissional: payload.percentualProfissional,
        observacao: [financeiroObs, pagamentoObs].filter(Boolean).join(' · '),
        catalogo_itens: payload.catalogoItens.filter((i) => i.catalogoId),
      });
      if (financeiroRes.ok) {
        if (userEmail) invalidateFinanceiroCache(userEmail);
      } else {
        window.alert(`${MSG_FINANCEIRO_FALHOU}\n\n${financeiroRes.error}`);
      }
    } catch {
      window.alert(MSG_FINANCEIRO_FALHOU);
    }

    const clienteDriveId =
      finalizedEvent?.clienteDriveId ?? finalizando.clienteDriveId ?? null;
    if (clienteDriveId) {
      const clienteRes = await postFinalizarClienteFromAgenda(clienteDriveId, {
        data: dataFinanceiro,
        hora: horaConsulta,
        valor: payload.valorOriginal,
        valorOriginal: payload.valorOriginal,
        descontoPercent: payload.descontoPercent,
        descontoValor: payload.descontoValor,
        forma_pagamento: payload.formaPagamento,
        medico: payload.medico,
        parcelas: payload.parcelas,
        observacoes: payload.observacoes || null,
        catalogo_itens: payload.catalogoItens,
        pacote_id: payload.pacoteId ?? null,
      });
      if (!clienteRes.ok) {
        window.alert(`${MSG_FINALIZAR_CLIENTE_FALHOU}\n\n${clienteRes.error}`);
      } else if (clienteRes.pacote_whatsapp) {
        setPacotePrompt({
          data: clienteRes.pacote_whatsapp,
          resumo: clienteRes.pacote_resumo ?? null,
        });
      }
    } else {
      window.alert(MSG_FINALIZAR_SEM_CLIENTE_DRIVE);
    }

    setSaving(false);
    applyLocal();
  }

  return (
    <>
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-gray-900 sm:text-lg">Agenda de hoje</h2>
          <Link
            href="/agenda"
            className="flex items-center gap-1 text-sm font-medium text-[#047482]"
          >
            Ver tudo <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {hoje.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-sm text-gray-500">Nenhuma sessão na agenda de hoje.</p>
            <div className="mt-3 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
              <Link
                href="/agenda"
                className="text-sm font-semibold text-[#047482]"
              >
                Marcar a primeira
              </Link>
              <span className="hidden text-gray-300 sm:inline">·</span>
              <Link href="/dashboard/configuracoes?tab=link" className="text-sm text-gray-600">
                Ou mande o link de autoagendamento
              </Link>
            </div>
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

      <PacoteWhatsAppPrompt
        data={pacotePrompt?.data ?? null}
        resumo={pacotePrompt?.resumo}
        onClose={() => setPacotePrompt(null)}
      />
    </>
  );
}
