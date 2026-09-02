import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ClienteDriveRecord, ClientesDriveStore } from '@/lib/clientesDrive';
import {
  CRM_DIAS_SEM_RETORNO,
  CRM_HISTORICO_MESES,
  CRM_SEM_RETORNO_PAGE_SIZE,
  CRM_SEM_RETORNO_PAGE_SIZE_MAX,
  type ClienteSemRetorno,
  type SemRetornoSort,
} from '@/lib/clientesCrmConstants';
import {
  diasDesdeUltimaSessao,
  lastSessaoRealizadaCliente,
} from '@/lib/clientesCrmLastSessao';
import { parseObservacaoAtendimento } from '@/lib/atendimentoItens';

const TZ = 'America/Sao_Paulo';

export { CRM_SEM_RETORNO_PAGE_SIZE_MAX } from '@/lib/clientesCrmConstants';

export type CrmSegmento =
  | 'sem_retorno'
  | 'aniversariantes'
  | 'sem_atendimento'
  | 'primeira_visita'
  | 'fidelizadas'
  | 'com_faltas'
  | 'top_clientes';

export type ClienteCrmListaItem = {
  id: string;
  nome: string;
  telefone: string | null;
  detalhe?: string;
  valor_num?: number;
};

export type ClientesCrmServicoTopMes = {
  mes: string;
  label: string;
  label_curto: string;
  servico: { nome: string; total: number } | null;
};

export type ClientesCrmSegmentosResumo = {
  aniversariantes_mes: number;
  sem_atendimento: number;
  primeira_visita: number;
  fidelizadas: number;
  com_faltas: number;
  ticket_medio: number;
  servico_mais_realizado: { nome: string; total: number } | null;
  servicos_top_mes: ClientesCrmServicoTopMes[];
  mes_aniversario_label: string;
};

export type ClientesCrmSegmentoPage = {
  segmento: CrmSegmento;
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  clientes: ClienteCrmListaItem[];
};

function countAtendimentosRealizados(c: ClienteDriveRecord): number {
  return (c.atendimentos ?? []).filter((a) => a.status === 'realizado').length;
}

function countFaltas(c: ClienteDriveRecord): number {
  return (c.atendimentos ?? []).filter((a) => a.status === 'faltou').length;
}

function formatDataCurta(iso: string): string {
  try {
    return format(parseISO(iso), 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return iso.slice(0, 10);
  }
}

function formatMoedaBrl(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function totalGastoRealizado(c: ClienteDriveRecord): number {
  let total = 0;
  for (const a of c.atendimentos ?? []) {
    if (a.status === 'realizado' && typeof a.valor === 'number' && a.valor > 0) {
      total += a.valor;
    }
  }
  return Math.round(total * 100) / 100;
}

function brMonthDay(ref: Date): { month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(ref);
  return {
    month: Number(parts.find((p) => p.type === 'month')?.value),
    day: Number(parts.find((p) => p.type === 'day')?.value),
  };
}

function brMonthFromIso(iso: string): { month: number; day: number } | null {
  if (!iso?.trim()) return null;
  const d = iso.includes('T') ? iso : `${iso}T12:00:00`;
  return brMonthDay(new Date(d));
}

function monthLabel(ref: Date): string {
  return format(ref, 'MMMM yyyy', { locale: ptBR });
}

export function buildSemRetornoListaWithDias(
  store: ClientesDriveStore,
  ref: Date,
  diasLimite: number,
  agendaUltimaSessao?: Map<string, Date>,
): ClienteSemRetorno[] {
  const lista: ClienteSemRetorno[] = [];
  for (const c of store.clientes) {
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

function monthLabelFromParts(year: number, month: number, short = false): string {
  const d = new Date(Date.UTC(year, month - 1, 15, 12, 0, 0));
  return format(d, short ? 'MMM yy' : 'MMMM yyyy', { locale: ptBR });
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

function atendimentoMesKey(data: string): string | null {
  const day = data.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(day)) return day.slice(0, 7);
  const parsed = Date.parse(data);
  if (Number.isNaN(parsed)) return null;
  const { year, month } = refYearMonth(new Date(parsed));
  return `${year}-${String(month).padStart(2, '0')}`;
}

function topServicoFromCounts(counts: Map<string, number>): { nome: string; total: number } | null {
  let top: { nome: string; total: number } | null = null;
  for (const [nome, total] of counts) {
    if (!top || total > top.total) top = { nome, total };
  }
  return top;
}

function forEachServicoCatalogoPago(
  store: ClientesDriveStore,
  cb: (mesKey: string, nome: string, qtd: number) => void,
) {
  for (const c of store.clientes) {
    const pagPorAtend = new Map(
      (c.pagamentos ?? [])
        .filter((p) => p.atendimento_id)
        .map((p) => [p.atendimento_id as string, p]),
    );

    for (const a of c.atendimentos ?? []) {
      if (a.status !== 'realizado') continue;

      const mesKey = atendimentoMesKey(a.data);
      if (!mesKey) continue;

      const { itens } = parseObservacaoAtendimento(a.observacoes);
      const servicos = itens.filter((i) => i.tipo === 'servico' && i.nome.trim());
      if (servicos.length === 0) continue;

      const pag = pagPorAtend.get(a.id);
      const pago =
        pag?.status === 'pago' ||
        (!pag && typeof a.valor === 'number' && a.valor > 0 && servicos.length > 0);
      if (!pago) continue;

      for (const item of servicos) {
        cb(mesKey, item.nome.trim(), Math.max(1, item.quantidade));
      }
    }
  }
}

function countServicosCatalogoPagos(store: ClientesDriveStore): Map<string, number> {
  const servicoCount = new Map<string, number>();
  forEachServicoCatalogoPago(store, (_mesKey, nome, qtd) => {
    servicoCount.set(nome, (servicoCount.get(nome) ?? 0) + qtd);
  });
  return servicoCount;
}

function buildServicosTopPorMes(store: ClientesDriveStore, ref: Date): ClientesCrmServicoTopMes[] {
  const { year: refYear, month: refMonth } = refYearMonth(ref);
  const porMes = new Map<string, Map<string, number>>();

  forEachServicoCatalogoPago(store, (mesKey, nome, qtd) => {
    if (!porMes.has(mesKey)) porMes.set(mesKey, new Map());
    const bucket = porMes.get(mesKey)!;
    bucket.set(nome, (bucket.get(nome) ?? 0) + qtd);
  });

  const items: ClientesCrmServicoTopMes[] = [];
  for (let i = CRM_HISTORICO_MESES - 1; i >= 0; i--) {
    const { year, month } = shiftMonth(refYear, refMonth, -i);
    const mes = `${year}-${String(month).padStart(2, '0')}`;
    items.push({
      mes,
      label: monthLabelFromParts(year, month),
      label_curto: monthLabelFromParts(year, month, true),
      servico: topServicoFromCounts(porMes.get(mes) ?? new Map()),
    });
  }
  return items;
}

export function getClientesCrmSegmentosResumo(
  store: ClientesDriveStore,
  ref = new Date(),
): ClientesCrmSegmentosResumo {
  const { month: refMonth } = brMonthDay(ref);
  let semAtendimento = 0;
  let primeiraVisita = 0;
  let fidelizadas = 0;
  let comFaltas = 0;
  let aniversariantes = 0;
  let totalValor = 0;
  let totalAtendimentos = 0;

  for (const c of store.clientes) {
    const realizados = countAtendimentosRealizados(c);
    if (realizados === 0) semAtendimento += 1;
    else if (realizados === 1) primeiraVisita += 1;
    else fidelizadas += 1;

    if (countFaltas(c) > 0) comFaltas += 1;

    const nasc = brMonthFromIso(c.data_nascimento ?? '');
    if (nasc && nasc.month === refMonth) aniversariantes += 1;

    for (const a of c.atendimentos ?? []) {
      if (a.status !== 'realizado') continue;
      totalAtendimentos += 1;
      if (typeof a.valor === 'number' && a.valor > 0) totalValor += a.valor;
    }
  }

  const servicoCount = countServicosCatalogoPagos(store);
  const servicosTopMes = buildServicosTopPorMes(store, ref);

  let servicoTop: { nome: string; total: number } | null = null;
  for (const [nome, total] of servicoCount) {
    if (!servicoTop || total > servicoTop.total) servicoTop = { nome, total };
  }

  return {
    aniversariantes_mes: aniversariantes,
    sem_atendimento: semAtendimento,
    primeira_visita: primeiraVisita,
    fidelizadas: fidelizadas,
    com_faltas: comFaltas,
    ticket_medio:
      totalAtendimentos > 0 ? Math.round((totalValor / totalAtendimentos) * 100) / 100 : 0,
    servico_mais_realizado: servicoTop,
    servicos_top_mes: servicosTopMes,
    mes_aniversario_label: monthLabel(ref),
  };
}

function toListaItem(c: ClienteDriveRecord, detalhe?: string, valor_num?: number): ClienteCrmListaItem {
  return {
    id: c.id,
    nome: c.nome,
    telefone: c.telefone,
    detalhe,
    valor_num,
  };
}

function paginate<T>(items: T[], page: number, limit: number) {
  const total = items.length;
  const total_pages = total === 0 ? 0 : Math.ceil(total / limit);
  const safePage = total_pages === 0 ? 1 : Math.min(Math.max(page, 1), total_pages);
  const offset = (safePage - 1) * limit;
  return {
    total,
    page: safePage,
    limit,
    total_pages,
    items: items.slice(offset, offset + limit),
  };
}

export function getClientesCrmSegmentoPage(
  store: ClientesDriveStore,
  segmento: CrmSegmento,
  options: {
    page?: number;
    limit?: number;
    sort?: SemRetornoSort;
    dias_limite?: number;
    ref?: Date;
    agenda_ultima_sessao?: Map<string, Date>;
  } = {},
): ClientesCrmSegmentoPage | null {
  const ref = options.ref ?? new Date();
  const agendaUltimaSessao = options.agenda_ultima_sessao;
  const limit = Math.min(
    Math.max(options.limit ?? CRM_SEM_RETORNO_PAGE_SIZE, 1),
    CRM_SEM_RETORNO_PAGE_SIZE_MAX,
  );
  const page = Math.max(options.page ?? 1, 1);
  const { month: refMonth } = brMonthDay(ref);

  if (segmento === 'sem_retorno') {
    const dias = options.dias_limite ?? CRM_DIAS_SEM_RETORNO;
    const sort = options.sort === 'asc' ? 'asc' : 'desc';
    let lista = buildSemRetornoListaWithDias(store, ref, dias, agendaUltimaSessao);
    lista.sort((a, b) =>
      sort === 'desc'
        ? b.dias_sem_retorno - a.dias_sem_retorno
        : a.dias_sem_retorno - b.dias_sem_retorno,
    );
    const paged = paginate(lista, page, limit);
    return {
      segmento,
      total: paged.total,
      page: paged.page,
      limit: paged.limit,
      total_pages: paged.total_pages,
      clientes: paged.items.map((c) => ({
        id: c.id,
        nome: c.nome,
        telefone: c.telefone,
        detalhe: `${c.dias_sem_retorno}d · última ${formatDataCurta(c.ultimo_atendimento)}`,
        valor_num: c.dias_sem_retorno,
      })),
    };
  }

  const rows: ClienteCrmListaItem[] = [];

  for (const c of store.clientes) {
    const realizados = countAtendimentosRealizados(c);
    switch (segmento) {
      case 'aniversariantes': {
        const nasc = brMonthFromIso(c.data_nascimento ?? '');
        if (!nasc || nasc.month !== refMonth) break;
        rows.push(
          toListaItem(
            c,
            c.data_nascimento
              ? `Aniversário ${format(parseISO(c.data_nascimento.includes('T') ? c.data_nascimento : `${c.data_nascimento}T12:00:00`), 'dd/MM', { locale: ptBR })}`
              : undefined,
          ),
        );
        break;
      }
      case 'sem_atendimento':
        if (realizados === 0) rows.push(toListaItem(c, 'Nunca teve sessão realizada'));
        break;
      case 'primeira_visita':
        if (realizados === 1) {
          const ult = lastSessaoRealizadaCliente(c, agendaUltimaSessao);
          rows.push(
            toListaItem(c, ult ? `Única sessão: ${formatDataCurta(ult.toISOString())}` : '1 sessão'),
          );
        }
        break;
      case 'fidelizadas':
        if (realizados >= 2) {
          rows.push(toListaItem(c, `${realizados} sessões realizadas`, realizados));
        }
        break;
      case 'com_faltas': {
        const faltas = countFaltas(c);
        if (faltas > 0) rows.push(toListaItem(c, `${faltas} falta(s)`, faltas));
        break;
      }
      case 'top_clientes': {
        if (realizados >= 1) {
          const valor = totalGastoRealizado(c);
          rows.push(
            toListaItem(
              c,
              `${realizados} ${realizados === 1 ? 'sessão' : 'sessões'} · ${formatMoedaBrl(valor)} no total`,
              valor,
            ),
          );
        }
        break;
      }
    }
  }

  if (segmento === 'aniversariantes') {
    rows.sort((a, b) => (a.detalhe ?? '').localeCompare(b.detalhe ?? '', 'pt-BR'));
  } else if (segmento === 'top_clientes') {
    rows.sort((a, b) => {
      const diff = (b.valor_num ?? 0) - (a.valor_num ?? 0);
      if (diff !== 0) return diff;
      return a.nome.localeCompare(b.nome, 'pt-BR');
    });
  } else {
    rows.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  const paged = paginate(rows, page, limit);
  return {
    segmento,
    total: paged.total,
    page: paged.page,
    limit: paged.limit,
    total_pages: paged.total_pages,
    clientes: paged.items,
  };
}
