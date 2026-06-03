import type { EventInput } from '@fullcalendar/core';
import { STORAGE_KEY_CONSULTATIONS } from '@/lib/constants';

export const DIAS_RETORNO = 30;

export type ConsultaStatus =
  | 'agendado'
  | 'confirmado'
  | 'realizado'
  | 'cancelado'
  | 'faltou';

export type TipoConsulta = 'nova_consulta' | 'retorno';

export type FormaPagamentoConsulta =
  | 'pix'
  | 'dinheiro'
  | 'cartao_credito'
  | 'cartao_debito'
  | 'permuta'
  | 'convenio';

export type ConsultationPayment = {
  valorPago: number;
  valorOriginal: number;
  formaPagamento: FormaPagamentoConsulta;
  convenio?: string;
  descontoPercent?: number;
  descontoValor?: number;
  parcelas?: number;
  finalizadoEm: string;
};

export type ConsultationRecord = EventInput & {
  patient?: string;
  service?: string;
  value?: number;
  location?: string;
  telefone?: string;
  lembretesWhatsapp?: boolean;
  medico?: string;
  googleEventId?: string;
  status?: ConsultaStatus;
  tipoConsulta?: TipoConsulta;
  convenio?: string;
  observacoes?: string;
  payment?: ConsultationPayment;
};

export const FORMAS_PAGAMENTO_CONSULTA: {
  id: FormaPagamentoConsulta;
  label: string;
}[] = [
  { id: 'pix', label: 'PIX' },
  { id: 'cartao_credito', label: 'Cartão de crédito' },
  { id: 'cartao_debito', label: 'Cartão de débito' },
  { id: 'dinheiro', label: 'Dinheiro' },
  { id: 'permuta', label: 'Permuta' },
  { id: 'convenio', label: 'Convênio / plano' },
];

export const STATUS_CONSULTA_UI: Record<
  ConsultaStatus,
  { label: string; color: string }
> = {
  agendado: { label: 'Agendado', color: 'bg-slate-100 text-slate-700' },
  confirmado: { label: 'Confirmado', color: 'bg-blue-100 text-blue-700' },
  realizado: { label: 'Finalizada', color: 'bg-green-100 text-green-700' },
  cancelado: { label: 'Cancelado', color: 'bg-red-100 text-red-700' },
  faltou: { label: 'Faltou', color: 'bg-orange-100 text-orange-700' },
};

export const TIPO_CONSULTA_UI: Record<TipoConsulta, { label: string; color: string }> = {
  nova_consulta: { label: 'Nova consulta', color: 'bg-indigo-100 text-indigo-800' },
  retorno: { label: 'Retorno', color: 'bg-teal-100 text-teal-800' },
};

export function normalizePatientName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function parseEventDate(value: EventInput['start']): Date | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    // datetime-local salvo sem fuso: força interpretação local
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) {
      const d = new Date(trimmed);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    // dia inteiro (Google): YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [y, m, day] = trimmed.split('-').map(Number);
      return new Date(y, m - 1, day, 8, 0, 0, 0);
    }
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function getEventStartDate(event: ConsultationRecord): Date | null {
  return parseEventDate(event.start);
}

/** Formato para input datetime-local */
export function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Duração padrão de uma consulta na agenda (minutos) */
export const DURACAO_CONSULTA_MIN = 40;

/** Soma minutos a um horário HH:mm e retorna HH:mm */
export function horaMaisMinutos(
  horaHHmm: string,
  minutos = DURACAO_CONSULTA_MIN,
): string {
  const parts = horaHHmm.split(':');
  if (parts.length < 2) return '';
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (Number.isNaN(h) || Number.isNaN(m)) return '';
  const d = new Date(2000, 0, 1, h, m, 0);
  d.setMinutes(d.getMinutes() + minutos);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Soma minutos a um valor datetime-local (YYYY-MM-DDTHH:mm) */
export function datetimeLocalMaisMinutos(
  value: string,
  minutos = DURACAO_CONSULTA_MIN,
): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  d.setMinutes(d.getMinutes() + minutos);
  return toDatetimeLocalValue(d);
}

/** Converte consultas salvas para o formato exibido pelo FullCalendar */
export function eventsForCalendar(events: ConsultationRecord[]): EventInput[] {
  const result: EventInput[] = [];

  for (const ev of events) {
    const startDate = parseEventDate(ev.start);
    if (!startDate) continue;

    let endDate = parseEventDate(ev.end);
    if (!endDate || endDate.getTime() <= startDate.getTime()) {
      endDate = new Date(startDate);
      endDate.setMinutes(endDate.getMinutes() + DURACAO_CONSULTA_MIN);
    }

    const patient = ev.patient?.trim() || 'Paciente';
    const service = ev.service?.trim() || 'Consulta';
    const title =
      ev.title?.trim() ||
      `${service} — ${patient}`;

    result.push({
      ...ev,
      id: String(ev.id ?? `ev-${startDate.getTime()}`),
      title,
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      allDay: false,
      backgroundColor:
        ev.backgroundColor ||
        (ev.tipoConsulta === 'retorno' ? '#5eead4' : '#90EE90'),
      borderColor:
        ev.borderColor ||
        (ev.tipoConsulta === 'retorno' ? '#0d9488' : '#228B22'),
      textColor: '#0f172a',
      extendedProps: {
        patient: ev.patient,
        service: ev.service,
        status: ev.status,
      },
    });
  }

  return result;
}

/** Cria ou atualiza estrutura de consulta para a agenda */
export function createConsultationEvent(
  input: {
    id?: string;
    patient: string;
    service?: string;
    value?: number;
    start: Date;
    end: Date;
    location?: string;
    telefone?: string;
    lembretesWhatsapp?: boolean;
    medico?: string;
    convenio?: string;
    observacoes?: string;
    status?: ConsultaStatus;
    isDraft?: boolean;
    allEvents?: ConsultationRecord[];
  },
): ConsultationRecord {
  const patient = input.patient.trim() || 'Novo paciente';
  const serviceBase = input.service?.trim() || 'Consulta médica';
  const tipoConsulta = input.allEvents
    ? classificarTipoConsulta(input.allEvents, patient, input.start)
    : 'nova_consulta';
  const serviceLabel =
    tipoConsulta === 'retorno' ? 'Retorno' : serviceBase;
  const isDraft = input.isDraft ?? false;

  return {
    id: input.id ?? `local-${Date.now()}`,
    title: `${serviceLabel} - ${patient}`,
    patient,
    service: serviceLabel,
    value: input.value ?? 200,
    start: input.start.toISOString(),
    end: input.end.toISOString(),
    location: input.location,
    telefone: input.telefone?.trim() || undefined,
    lembretesWhatsapp: input.lembretesWhatsapp !== false,
    medico: input.medico,
    convenio: input.convenio,
    status: input.status ?? (isDraft ? 'agendado' : 'confirmado'),
    tipoConsulta,
    observacoes: input.observacoes,
    backgroundColor: isDraft
      ? '#fde047'
      : tipoConsulta === 'retorno'
        ? '#5eead4'
        : '#90EE90',
    borderColor: isDraft
      ? '#ca8a04'
      : tipoConsulta === 'retorno'
        ? '#0d9488'
        : '#228B22',
  };
}

export function formatHorario(event: ConsultationRecord): string {
  const d = getEventStartDate(event);
  if (!d || Number.isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function loadConsultations(): ConsultationRecord[] {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(STORAGE_KEY_CONSULTATIONS);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ConsultationRecord[];
  } catch {
    return [];
  }
}

export function saveConsultations(
  events: ConsultationRecord[],
  options?: { broadcast?: boolean },
): void {
  if (typeof window === 'undefined') return;
  const serialized = JSON.stringify(events);
  const prev = window.localStorage.getItem(STORAGE_KEY_CONSULTATIONS);
  if (prev === serialized) return;

  window.localStorage.setItem(STORAGE_KEY_CONSULTATIONS, serialized);

  if (options?.broadcast !== false) {
    window.dispatchEvent(new CustomEvent('medsupapp-consultations-updated'));
  }
}

/** Última consulta finalizada do mesmo paciente antes da data de referência */
export function getUltimaConsultaFinalizada(
  events: ConsultationRecord[],
  patientName: string,
  antesDe: Date,
): ConsultationRecord | null {
  const key = normalizePatientName(patientName);
  let ultima: ConsultationRecord | null = null;
  let ultimaData = 0;

  for (const ev of events) {
    if (ev.status !== 'realizado' || !ev.patient) continue;
    if (normalizePatientName(ev.patient) !== key) continue;
    const dataRef = ev.payment?.finalizadoEm
      ? new Date(ev.payment.finalizadoEm)
      : getEventStartDate(ev);
    if (!dataRef || Number.isNaN(dataRef.getTime())) continue;
    if (dataRef.getTime() >= antesDe.getTime()) continue;
    if (dataRef.getTime() > ultimaData) {
      ultimaData = dataRef.getTime();
      ultima = ev;
    }
  }
  return ultima;
}

/**
 * Retorno se o paciente teve consulta finalizada nos últimos 30 dias
 * (em relação à data/hora agendada da consulta atual).
 */
export function classificarTipoConsulta(
  events: ConsultationRecord[],
  patientName: string,
  dataConsulta: Date,
): TipoConsulta {
  const ultima = getUltimaConsultaFinalizada(events, patientName, dataConsulta);
  if (!ultima) return 'nova_consulta';

  const dataUltima = ultima.payment?.finalizadoEm
    ? new Date(ultima.payment.finalizadoEm)
    : getEventStartDate(ultima);
  if (!dataUltima) return 'nova_consulta';

  const diffMs = dataConsulta.getTime() - dataUltima.getTime();
  const diffDias = diffMs / (1000 * 60 * 60 * 24);
  return diffDias <= DIAS_RETORNO ? 'retorno' : 'nova_consulta';
}

export type FinalizarConsultaPayload = {
  valorPago: number;
  valorOriginal: number;
  formaPagamento: FormaPagamentoConsulta;
  convenio: string;
  descontoPercent: number;
  descontoValor: number;
  parcelas: number;
  tipoConsulta: TipoConsulta;
  medico?: string;
};

export function applyFinalizarConsulta(
  events: ConsultationRecord[],
  consultaId: string | number,
  payload: FinalizarConsultaPayload,
): ConsultationRecord[] {
  return events.map((ev) => {
    if (String(ev.id) !== String(consultaId)) return ev;
    return {
      ...ev,
      status: 'realizado' as const,
      tipoConsulta: payload.tipoConsulta,
      convenio: payload.convenio || ev.convenio,
      medico: payload.medico?.trim() || ev.medico,
      value: payload.valorPago,
      service:
        payload.tipoConsulta === 'retorno'
          ? 'Retorno'
          : ev.service?.includes('Retorno')
            ? 'Consulta médica'
            : ev.service || 'Consulta médica',
      payment: {
        valorPago: payload.valorPago,
        valorOriginal: payload.valorOriginal,
        formaPagamento: payload.formaPagamento,
        convenio: payload.convenio,
        descontoPercent: payload.descontoPercent || undefined,
        descontoValor: payload.descontoValor || undefined,
        parcelas: payload.parcelas > 1 ? payload.parcelas : undefined,
        finalizadoEm: new Date().toISOString(),
      },
    };
  });
}

export function calcularValorComDesconto(
  valorBase: number,
  descontoPercent: number,
  descontoValor: number,
): number {
  let v = valorBase;
  if (descontoPercent > 0) v -= (v * descontoPercent) / 100;
  if (descontoValor > 0) v -= descontoValor;
  return Math.max(0, Math.round(v * 100) / 100);
}

export function getConsultasHoje(events: ConsultationRecord[]): ConsultationRecord[] {
  const hoje = new Date();
  return events
    .filter((ev) => {
      const d = getEventStartDate(ev);
      return d && isSameDay(d, hoje) && ev.status !== 'cancelado';
    })
    .sort((a, b) => {
      const da = getEventStartDate(a)?.getTime() ?? 0;
      const db = getEventStartDate(b)?.getTime() ?? 0;
      return da - db;
    });
}

export function getDashboardStats(events: ConsultationRecord[]) {
  const hoje = new Date();
  const mes = hoje.getMonth();
  const ano = hoje.getFullYear();

  const consultasHoje = getConsultasHoje(events).filter(
    (e) => e.status !== 'realizado',
  ).length;

  let faturamentoMes = 0;
  const pacientesMes = new Set<string>();

  for (const ev of events) {
    if (ev.status !== 'realizado' || !ev.payment) continue;
    const d = new Date(ev.payment.finalizadoEm);
    if (d.getMonth() === mes && d.getFullYear() === ano) {
      faturamentoMes += ev.payment.valorPago;
      if (ev.patient) pacientesMes.add(normalizePatientName(ev.patient));
    }
  }

  const proximosAgendamentos = getConsultasHoje(events).filter(
    (e) => e.status === 'agendado' || e.status === 'confirmado',
  ).length;

  return {
    consultasHoje: getConsultasHoje(events).length,
    pendentesHoje: consultasHoje,
    faturamentoMes,
    pacientesAtendidos: pacientesMes.size,
    proximosAgendamentos,
  };
}
