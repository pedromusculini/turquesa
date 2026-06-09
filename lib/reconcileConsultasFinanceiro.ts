import type {
  ConsultationRecord,
  FormaPagamentoConsulta,
} from '@/lib/consultations';
import { normalizePatientName, parseEventDate } from '@/lib/consultations';

const BR_TIMEZONE = 'America/Sao_Paulo';

export type FinanceiroTransacaoResumo = {
  data: string;
  descricao: string;
  valor: number;
  forma_pagamento?: string | null;
  medico?: string | null;
  categoria?: string | null;
  tipo?: string;
};

function eventDateKey(ev: ConsultationRecord): string | null {
  const d = parseEventDate(ev.start);
  if (!d) return null;
  return d.toLocaleDateString('en-CA', { timeZone: BR_TIMEZONE });
}

function descricaoContainsPatient(descricao: string, patient: string): boolean {
  const p = normalizePatientName(patient);
  if (!p) return false;
  return normalizePatientName(descricao).includes(p);
}

function medicoMatches(
  consultaMedico?: string | null,
  financeiroMedico?: string | null,
): boolean {
  const a = consultaMedico?.trim().toLowerCase() ?? '';
  const b = financeiroMedico?.trim().toLowerCase() ?? '';
  if (!a || !b) return true;
  return a === b;
}

function isConsultaEntrada(tx: FinanceiroTransacaoResumo): boolean {
  if (tx.tipo && tx.tipo !== 'entrada') return false;
  if (tx.categoria === 'consulta') return true;
  return /atendimento/i.test(tx.descricao ?? '');
}

/** Marca consultas como realizado quando há entrada no financeiro (mesmo cliente + data). */
export function reconcileConsultasFromFinanceiro(
  events: ConsultationRecord[],
  financeiro: FinanceiroTransacaoResumo[],
): ConsultationRecord[] {
  const entradas = financeiro.filter(isConsultaEntrada);
  if (entradas.length === 0) return events;

  return events.map((ev) => {
    if (ev.status === 'realizado') return ev;
    const dateKey = eventDateKey(ev);
    const patient = ev.patient?.trim();
    if (!dateKey || !patient) return ev;

    const match = entradas.find(
      (tx) =>
        tx.data === dateKey &&
        descricaoContainsPatient(tx.descricao, patient) &&
        medicoMatches(ev.medico, tx.medico),
    );
    if (!match) return ev;

    const forma = (match.forma_pagamento as FormaPagamentoConsulta) || 'pix';
    const valor = Number(match.valor) || 0;

    return {
      ...ev,
      status: 'realizado' as const,
      payment: ev.payment ?? {
        valorPago: valor,
        valorOriginal: valor,
        formaPagamento: forma,
        finalizadoEm: new Date().toISOString(),
      },
    };
  });
}

export type ConsultaAgendaReconcileRow = {
  id: string;
  paciente: string;
  inicio: string;
  status: string;
  medico?: string | null;
};

/** Encontra consultas no Supabase que deveriam estar finalizadas (para API de reparo). */
export function findConsultasToReconcileFromFinanceiro(
  consultas: ConsultaAgendaReconcileRow[],
  financeiro: FinanceiroTransacaoResumo[],
): string[] {
  const entradas = financeiro.filter(isConsultaEntrada);
  const ids: string[] = [];

  for (const row of consultas) {
    if (row.status === 'realizado') continue;
    const dateKey = (() => {
      const d = new Date(row.inicio);
      if (Number.isNaN(d.getTime())) return row.inicio.slice(0, 10);
      return d.toLocaleDateString('en-CA', { timeZone: BR_TIMEZONE });
    })();

    const match = entradas.find(
      (tx) =>
        tx.data === dateKey &&
        descricaoContainsPatient(tx.descricao, row.paciente) &&
        medicoMatches(row.medico, tx.medico),
    );
    if (match) ids.push(row.id);
  }

  return ids;
}
