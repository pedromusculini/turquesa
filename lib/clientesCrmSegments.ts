import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ClienteDriveRecord, ClientesDriveStore } from '@/lib/clientesDrive';
import {
  CRM_DIAS_SEM_RETORNO,
  CRM_SEM_RETORNO_PAGE_SIZE,
  CRM_SEM_RETORNO_PAGE_SIZE_MAX,
  type ClienteSemRetorno,
  type SemRetornoSort,
} from '@/lib/clientesCrmConstants';

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

export type ClientesCrmSegmentosResumo = {
  aniversariantes_mes: number;
  sem_atendimento: number;
  primeira_visita: number;
  fidelizadas: number;
  com_faltas: number;
  ticket_medio: number;
  servico_mais_realizado: { nome: string; total: number } | null;
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

function parseAtendimentoDate(data: string, hora: string | null): Date {
  const base = data.includes('T') ? data : `${data}T12:00:00`;
  if (hora?.trim()) {
    const [h, m] = hora.split(':');
    const d = parseISO(`${data}T00:00:00`);
    d.setHours(Number(h) || 0, Number(m) || 0, 0, 0);
    return d;
  }
  return new Date(base);
}

function countAtendimentosRealizados(c: ClienteDriveRecord): number {
  return (c.atendimentos ?? []).filter((a) => a.status === 'realizado').length;
}

function countFaltas(c: ClienteDriveRecord): number {
  return (c.atendimentos ?? []).filter((a) => a.status === 'faltou').length;
}

function lastAtendimentoRealizado(c: ClienteDriveRecord): Date | null {
  let max: Date | null = null;
  for (const a of c.atendimentos ?? []) {
    if (a.status !== 'realizado') continue;
    const d = parseAtendimentoDate(a.data, a.hora);
    if (!max || d > max) max = d;
  }
  return max;
}

function formatDataCurta(iso: string): string {
  try {
    return format(parseISO(iso), 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return iso.slice(0, 10);
  }
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
): ClienteSemRetorno[] {
  const lista: ClienteSemRetorno[] = [];
  for (const c of store.clientes) {
    const ultimo = lastAtendimentoRealizado(c);
    if (!ultimo) continue;
    const dias = differenceInCalendarDays(ref, ultimo);
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
  const servicoCount = new Map<string, number>();

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
      const tipo = a.tipo?.trim();
      if (tipo) servicoCount.set(tipo, (servicoCount.get(tipo) ?? 0) + 1);
    }
  }

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
  } = {},
): ClientesCrmSegmentoPage | null {
  const ref = options.ref ?? new Date();
  const limit = Math.min(
    Math.max(options.limit ?? CRM_SEM_RETORNO_PAGE_SIZE, 1),
    CRM_SEM_RETORNO_PAGE_SIZE_MAX,
  );
  const page = Math.max(options.page ?? 1, 1);
  const { month: refMonth } = brMonthDay(ref);

  if (segmento === 'sem_retorno') {
    const dias = options.dias_limite ?? CRM_DIAS_SEM_RETORNO;
    const sort = options.sort === 'asc' ? 'asc' : 'desc';
    let lista = buildSemRetornoListaWithDias(store, ref, dias);
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
          const ult = lastAtendimentoRealizado(c);
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
          let valor = 0;
          for (const a of c.atendimentos ?? []) {
            if (a.status === 'realizado' && typeof a.valor === 'number') valor += a.valor;
          }
          rows.push(toListaItem(c, `${realizados} sessões`, valor || realizados));
        }
        break;
      }
    }
  }

  if (segmento === 'aniversariantes') {
    rows.sort((a, b) => (a.detalhe ?? '').localeCompare(b.detalhe ?? '', 'pt-BR'));
  } else if (segmento === 'top_clientes') {
    rows.sort((a, b) => (b.valor_num ?? 0) - (a.valor_num ?? 0));
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
