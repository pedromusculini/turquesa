import type { EventInput } from '@fullcalendar/core';
import type { AtendimentoItemLinha } from '@/lib/atendimentoItens';
import { STORAGE_KEY_CONSULTATIONS } from '@/lib/constants';
import { AGENDA_EVENT_COLORS } from '@/lib/visual/brand';
import { colorsForConsultationEvent, buildProfissionalColorMap, type ProfissionalColorLookup } from '@/lib/agendaProfissionalColors';

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
  /** ID em clinica_medicos (eventos criados localmente) */
  medicoProfissionalId?: string;
  googleEventId?: string;
  /** ID da profissional cuja agenda Google originou/sincronizou o evento */
  googleProfissionalId?: string;
  status?: ConsultaStatus;
  tipoConsulta?: TipoConsulta;
  convenio?: string;
  observacoes?: string;
  /** Serviços/produtos do catálogo registrados na finalização */
  catalogoItens?: AtendimentoItemLinha[];
  payment?: ConsultationPayment;
  /** ID do cliente no Drive (clientes.json) */
  clienteDriveId?: string | null;
};

export const FORMAS_PAGAMENTO_CONSULTA: {
  id: FormaPagamentoConsulta;
  label: string;
}[] = [
  { id: 'pix', label: 'PIX' },
  { id: 'dinheiro', label: 'Dinheiro' },
  { id: 'cartao_credito', label: 'Cartão de crédito' },
  { id: 'cartao_debito', label: 'Cartão de débito' },
  { id: 'permuta', label: 'Permuta' },
  { id: 'convenio', label: 'Convênio / plano' },
];

export const STATUS_CONSULTA_UI: Record<
  ConsultaStatus,
  { label: string; color: string }
> = {
  agendado: { label: 'Agendado', color: 'bg-slate-100 text-slate-700' },
  confirmado: { label: 'Confirmado', color: 'bg-[#D9F0F2] text-[#035e6b]' },
  realizado: { label: 'Finalizada', color: 'bg-[#eef4f5] text-[#047482]' },
  cancelado: { label: 'Cancelado', color: 'bg-red-100 text-red-700' },
  faltou: { label: 'Faltou', color: 'bg-orange-100 text-orange-700' },
};

export const TIPO_CONSULTA_UI: Record<TipoConsulta, { label: string; color: string }> = {
  nova_consulta: { label: 'Nova sessão', color: 'bg-[#D9F0F2] text-[#035e6b]' },
  retorno: { label: 'Sessão', color: 'bg-[#D9F0F2] text-[#035e6b]' },
};

const STATUS_PRIORITY: Record<ConsultaStatus, number> = {
  agendado: 0,
  confirmado: 1,
  faltou: 2,
  cancelado: 2,
  realizado: 3,
};

/** Escolhe o status mais avançado (ex.: realizado vence confirmado após sync Google). */
export function preferConsultaStatus(
  a?: ConsultaStatus,
  b?: ConsultaStatus,
): ConsultaStatus {
  const sa = a ?? 'agendado';
  const sb = b ?? 'agendado';
  return STATUS_PRIORITY[sa] >= STATUS_PRIORITY[sb] ? sa : sb;
}

/** Resolve status considerando pagamento registrado na finalização. */
export function resolveConsultaStatus(
  a?: ConsultaStatus,
  b?: ConsultaStatus,
  payment?: ConsultationPayment | null,
): ConsultaStatus {
  if (payment) return 'realizado';
  return preferConsultaStatus(a, b);
}

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

function isDraftConsultation(ev: ConsultationRecord): boolean {
  return (
    ev.backgroundColor === AGENDA_EVENT_COLORS.draft.background ||
    ev.borderColor === AGENDA_EVENT_COLORS.draft.border
  );
}

/** Janela exibida/armazenada localmente: 6 meses passado + 12 futuro. */
export const AGENDA_WINDOW_MONTHS_PAST = 6;
export const AGENDA_WINDOW_MONTHS_FUTURE = 12;
export const AGENDA_STORAGE_TRIM_THRESHOLD = 400;

export function agendaWindowTimeMin(now = new Date()): string {
  const past = new Date(now);
  past.setMonth(past.getMonth() - AGENDA_WINDOW_MONTHS_PAST);
  return past.toISOString();
}

export function agendaWindowTimeMax(now = new Date()): string {
  const future = new Date(now);
  future.setMonth(future.getMonth() + AGENDA_WINDOW_MONTHS_FUTURE);
  return future.toISOString();
}

export function isWithinAgendaWindow(
  ev: ConsultationRecord,
  now = new Date(),
): boolean {
  const start = getEventStartDate(ev);
  if (!start) return true;
  const past = new Date(now);
  past.setMonth(past.getMonth() - AGENDA_WINDOW_MONTHS_PAST);
  const future = new Date(now);
  future.setMonth(future.getMonth() + AGENDA_WINDOW_MONTHS_FUTURE);
  return start >= past && start <= future;
}

export function filterConsultationsForAgendaWindow(
  events: ConsultationRecord[],
): ConsultationRecord[] {
  return events.filter((ev) => isWithinAgendaWindow(ev) || isDraftConsultation(ev));
}

export function trimConsultationsForStorage(
  events: ConsultationRecord[],
): ConsultationRecord[] {
  if (events.length <= AGENDA_STORAGE_TRIM_THRESHOLD) return events;
  return filterConsultationsForAgendaWindow(events);
}

/** Converte consultas salvas para o formato exibido pelo FullCalendar */
export function eventsForCalendar(
  events: ConsultationRecord[],
  options?: {
    profissionais?: ProfissionalColorLookup[];
    titularNome?: string | null;
  },
): EventInput[] {
  const windowed = filterConsultationsForAgendaWindow(events);
  const colorMap =
    options?.profissionais && options.profissionais.length > 0
      ? buildProfissionalColorMap(options.profissionais, options.titularNome)
      : null;
  const colorOpts = {
    profissionais: options?.profissionais,
    colorMap,
  };
  const result: EventInput[] = [];

  for (const ev of windowed) {
    const startDate = parseEventDate(ev.start);
    if (!startDate) continue;

    let endDate = parseEventDate(ev.end);
    if (!endDate || endDate.getTime() <= startDate.getTime()) {
      endDate = new Date(startDate);
      endDate.setMinutes(endDate.getMinutes() + DURACAO_CONSULTA_MIN);
    }

    const patient = ev.patient?.trim() || 'Cliente';
    const service = ev.service?.trim() || 'Atendimento';
    const title =
      ev.title?.trim() ||
      `${service} — ${patient}`;

    const isDraft = isDraftConsultation(ev);
    const profColors = isDraft ? null : colorsForConsultationEvent(ev, colorOpts);
    const tipoColors = AGENDA_EVENT_COLORS.nova;

    result.push({
      ...ev,
      id: String(ev.id ?? `ev-${startDate.getTime()}`),
      title,
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      allDay: false,
      backgroundColor: isDraft
        ? AGENDA_EVENT_COLORS.draft.background
        : profColors?.background ?? tipoColors.background,
      borderColor: isDraft
        ? AGENDA_EVENT_COLORS.draft.border
        : profColors?.border ?? tipoColors.border,
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
    medicoProfissionalId?: string;
    convenio?: string;
    observacoes?: string;
    status?: ConsultaStatus;
    clienteDriveId?: string | null;
    isDraft?: boolean;
  },
): ConsultationRecord {
  const patient = input.patient.trim() || 'Novo cliente';
  const serviceLabel = input.service?.trim() || 'Atendimento';
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
    medicoProfissionalId: input.medicoProfissionalId,
    convenio: input.convenio,
    status: input.status ?? (isDraft ? 'agendado' : 'confirmado'),
    tipoConsulta: 'nova_consulta',
    observacoes: input.observacoes,
    clienteDriveId: input.clienteDriveId ?? undefined,
    ...(isDraft
      ? {
          backgroundColor: AGENDA_EVENT_COLORS.draft.background,
          borderColor: AGENDA_EVENT_COLORS.draft.border,
        }
      : {}),
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
    const parsed = JSON.parse(raw) as ConsultationRecord[];
    return trimConsultationsForStorage(parsed);
  } catch {
    return [];
  }
}

export function saveConsultations(
  events: ConsultationRecord[],
  options?: { broadcast?: boolean },
): void {
  if (typeof window === 'undefined') return;
  const toSave = trimConsultationsForStorage(events);
  const serialized = JSON.stringify(toSave);
  const prev = window.localStorage.getItem(STORAGE_KEY_CONSULTATIONS);
  if (prev === serialized) return;

  window.localStorage.setItem(STORAGE_KEY_CONSULTATIONS, serialized);

  if (options?.broadcast !== false) {
    window.dispatchEvent(new CustomEvent('medsupapp-consultations-updated'));
  }
}

export type FinalizarConsultaPayload = {
  valorPago: number;
  valorOriginal: number;
  formaPagamento: FormaPagamentoConsulta;
  convenio?: string;
  descontoPercent: number;
  descontoValor: number;
  parcelas: number;
  tipoConsulta: TipoConsulta;
  medico?: string;
  percentualProfissional?: number;
  observacoes?: string;
  catalogoItens?: AtendimentoItemLinha[];
};

export function applyFinalizarConsulta(
  events: ConsultationRecord[],
  consultaId: string | number,
  payload: FinalizarConsultaPayload,
): ConsultationRecord[] {
  return events.map((ev) => {
    if (String(ev.id) !== String(consultaId)) return ev;
    const itens = payload.catalogoItens?.filter((i) => i.catalogoId) ?? [];
    const serviceFromItens =
      itens.length > 0
        ? itens.map((i) => (i.quantidade > 1 ? `${i.quantidade}x ${i.nome}` : i.nome)).join(', ')
        : null;

    return {
      ...ev,
      status: 'realizado' as const,
      tipoConsulta: 'nova_consulta',
      convenio: payload.convenio || ev.convenio,
      medico: payload.medico?.trim() || ev.medico,
      value: payload.valorPago,
      observacoes: payload.observacoes?.trim() || ev.observacoes,
      catalogoItens: itens.length > 0 ? itens : ev.catalogoItens,
      service: serviceFromItens || ev.service || 'Atendimento',
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
