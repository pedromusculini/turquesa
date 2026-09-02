import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ClienteDriveRecord, ClientesDriveStore } from '@/lib/clientesDrive';

import type { ClientesCrmSegmentosResumo } from '@/lib/clientesCrmSegments';
import type { ClientesCrmMarketingStats } from '@/lib/clientesCrmMarketing';
import {
  CRM_DIAS_SEM_RETORNO,
  CRM_HISTORICO_MESES,
  CRM_SEM_RETORNO_PAGE_SIZE,
  CRM_SEM_RETORNO_PAGE_SIZE_MAX,
  type ClienteSemRetorno,
  type SemRetornoSort,
} from '@/lib/clientesCrmConstants';
import {
  clienteTemAgendamentoFuturo,
  diasDesdeUltimaSessao,
  lastSessaoRealizadaCliente,
} from '@/lib/clientesCrmLastSessao';
import { getClientesCrmSegmentosResumo } from '@/lib/clientesCrmSegments';

const TZ = 'America/Sao_Paulo';

export {
  CRM_DIAS_SEM_RETORNO,
  CRM_HISTORICO_MESES,
  CRM_SEM_RETORNO_PAGE_SIZE,
  CRM_SEM_RETORNO_PAGE_SIZE_MAX,
  type ClienteSemRetorno,
  type SemRetornoSort,
} from '@/lib/clientesCrmConstants';

export type ClienteOrigemCrm = 'manual' | 'formulario' | 'google_contatos';

export type ClientesCrmOrigemStats = Record<ClienteOrigemCrm, number>;

export type ClientesCrmHistoricoMes = {
  mes: string;
  label: string;
  label_curto: string;
  novos: number;
};

export type { ClientesCrmMarketingStats } from '@/lib/clientesCrmMarketing';

export type ClientesCrmStats = {
  total: number;
  novos_mes: number;
  novos_mes_anterior: number;
  mes_referencia: string;
  mes_referencia_label: string;
  mes_anterior_label: string;
  variacao_vs_mes_anterior: number;
  historico_meses: ClientesCrmHistoricoMes[];
  origem_base: ClientesCrmOrigemStats;
  origem_novos_mes: ClientesCrmOrigemStats;
  sem_retorno: {
    dias_limite: number;
    total: number;
  };
  segmentos: ClientesCrmSegmentosResumo;
  marketing?: ClientesCrmMarketingStats;
};

export type ClientesSemRetornoPage = {
  dias_limite: number;
  total: number;
  page: number;
  limit: number;
  sort: SemRetornoSort;
  total_pages: number;
  clientes: ClienteSemRetorno[];
};

function brYearMonth(iso: string): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date(iso));
  return {
    year: Number(parts.find((p) => p.type === 'year')?.value),
    month: Number(parts.find((p) => p.type === 'month')?.value),
  };
}

function refYearMonth(ref: Date): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(ref);
  return {
    year: Number(parts.find((p) => p.type === 'year')?.value),
    month: Number(parts.find((p) => p.type === 'month')?.value),
  };
}

function monthLabel(year: number, month: number, short = false): string {
  const d = new Date(Date.UTC(year, month - 1, 15, 12, 0, 0));
  return format(d, short ? 'MMM yy' : 'MMMM yyyy', { locale: ptBR });
}

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  let m = month + delta;
  let y = year;
  while (m < 1) {
    m += 12;
    y -= 1;
  }
  while (m > 12) {
    m -= 12;
    y += 1;
  }
  return { year: y, month: m };
}

export function detectClienteOrigem(c: ClienteDriveRecord): ClienteOrigemCrm {
  if (c.formulario_importado_em) return 'formulario';
  if (c.google_contact_ids?.length) return 'google_contatos';
  return 'manual';
}

function emptyOrigem(): ClientesCrmOrigemStats {
  return { manual: 0, formulario: 0, google_contatos: 0 };
}

function bumpOrigem(stats: ClientesCrmOrigemStats, origem: ClienteOrigemCrm) {
  stats[origem] += 1;
}

function buildHistorico(refYear: number, refMonth: number): ClientesCrmHistoricoMes[] {
  const items: ClientesCrmHistoricoMes[] = [];
  for (let i = CRM_HISTORICO_MESES - 1; i >= 0; i--) {
    const { year, month } = shiftMonth(refYear, refMonth, -i);
    items.push({
      mes: `${year}-${String(month).padStart(2, '0')}`,
      label: monthLabel(year, month),
      label_curto: monthLabel(year, month, true),
      novos: 0,
    });
  }
  return items;
}

function buildSemRetornoLista(
  store: ClientesDriveStore,
  ref: Date,
  diasLimite = CRM_DIAS_SEM_RETORNO,
  agendaUltimaSessao?: Map<string, Date>,
  agendamentoFuturo?: Set<string>,
): ClienteSemRetorno[] {
  const lista: ClienteSemRetorno[] = [];
  for (const c of store.clientes) {
    if (clienteTemAgendamentoFuturo(c, ref, agendamentoFuturo)) continue;
    const ultimo = lastSessaoRealizadaCliente(c, agendaUltimaSessao);
    if (!ultimo) continue;
    const dias = diasDesdeUltimaSessao(ref, ultimo);
    if (dias < diasLimite) continue;
    lista.push({
      id: c.id,
      nome: c.nome,
      telefone: c.telefone,
      ultimo_atendimento: ultimo.toISOString(),
      dias_sem_retorno: dias,
    });
  }
  return lista;
}

export function getClientesSemRetornoPage(
  store: ClientesDriveStore,
  options: {
    page?: number;
    limit?: number;
    sort?: SemRetornoSort;
    dias_limite?: number;
    ref?: Date;
    agenda_ultima_sessao?: Map<string, Date>;
    agendamento_futuro?: Set<string>;
  } = {},
): ClientesSemRetornoPage {
  const ref = options.ref ?? new Date();
  const agendaUltimaSessao = options.agenda_ultima_sessao;
  const agendamentoFuturo = options.agendamento_futuro;
  const diasLimite = options.dias_limite ?? CRM_DIAS_SEM_RETORNO;
  const sort = options.sort === 'asc' ? 'asc' : 'desc';
  const limit = Math.min(
    Math.max(options.limit ?? CRM_SEM_RETORNO_PAGE_SIZE, 1),
    CRM_SEM_RETORNO_PAGE_SIZE_MAX,
  );
  const page = Math.max(options.page ?? 1, 1);

  const lista = buildSemRetornoLista(store, ref, diasLimite, agendaUltimaSessao, agendamentoFuturo);
  lista.sort((a, b) =>
    sort === 'desc'
      ? b.dias_sem_retorno - a.dias_sem_retorno
      : a.dias_sem_retorno - b.dias_sem_retorno,
  );

  const total = lista.length;
  const total_pages = total === 0 ? 0 : Math.ceil(total / limit);
  const safePage = total_pages === 0 ? 1 : Math.min(page, total_pages);
  const offset = (safePage - 1) * limit;

  return {
    dias_limite: diasLimite,
    total,
    page: safePage,
    limit,
    sort,
    total_pages,
    clientes: lista.slice(offset, offset + limit),
  };
}

/** Métricas CRM a partir do store completo (Drive). */
export function getClientesCrmStats(
  store: ClientesDriveStore,
  ref = new Date(),
  opts?: {
    agenda_ultima_sessao?: Map<string, Date>;
    agendamento_futuro?: Set<string>;
  },
): ClientesCrmStats {
  const agendaUltimaSessao = opts?.agenda_ultima_sessao;
  const agendamentoFuturo = opts?.agendamento_futuro;
  const { year: refYear, month: refMonth } = refYearMonth(ref);
  const { year: prevYear, month: prevMonth } = shiftMonth(refYear, refMonth, -1);

  const historico = buildHistorico(refYear, refMonth);
  const historicoByMes = new Map(historico.map((h) => [h.mes, h]));

  let novosMes = 0;
  let novosMesAnterior = 0;
  const origemBase = emptyOrigem();
  const origemNovosMes = emptyOrigem();

  const hoje = ref;

  for (const c of store.clientes) {
    const origem = detectClienteOrigem(c);
    bumpOrigem(origemBase, origem);

    if (c.created_at) {
      const { year, month } = brYearMonth(c.created_at);
      const mesKey = `${year}-${String(month).padStart(2, '0')}`;
      const bucket = historicoByMes.get(mesKey);
      if (bucket) bucket.novos += 1;

      if (year === refYear && month === refMonth) {
        novosMes += 1;
        bumpOrigem(origemNovosMes, origem);
      } else if (year === prevYear && month === prevMonth) {
        novosMesAnterior += 1;
      }
    }
  }

  const semRetornoTotal = buildSemRetornoLista(
    store,
    hoje,
    CRM_DIAS_SEM_RETORNO,
    agendaUltimaSessao,
    agendamentoFuturo,
  ).length;

  return {
    total: store.clientes.length,
    novos_mes: novosMes,
    novos_mes_anterior: novosMesAnterior,
    mes_referencia: `${refYear}-${String(refMonth).padStart(2, '0')}`,
    mes_referencia_label: monthLabel(refYear, refMonth),
    mes_anterior_label: monthLabel(prevYear, prevMonth),
    variacao_vs_mes_anterior: novosMes - novosMesAnterior,
    historico_meses: historico,
    origem_base: origemBase,
    origem_novos_mes: origemNovosMes,
    sem_retorno: {
      dias_limite: CRM_DIAS_SEM_RETORNO,
      total: semRetornoTotal,
    },
    segmentos: getClientesCrmSegmentosResumo(store, hoje, {
      agenda_ultima_sessao: agendaUltimaSessao,
      agendamento_futuro: agendamentoFuturo,
    }),
  };
}

export const ORIGEM_CRM_LABELS: Record<ClienteOrigemCrm, string> = {
  manual: 'Cadastro manual',
  formulario: 'Formulário online',
  google_contatos: 'Google Contatos',
};
