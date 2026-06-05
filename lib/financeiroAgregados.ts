import {
  differenceInCalendarDays,
  format,
  parseISO,
  startOfWeek,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ATENDIMENTO_LABEL } from '@/lib/constants';

export type TransacaoAgregavel = {
  tipo: 'entrada' | 'saida';
  data: string;
  valor: number;
  forma_pagamento?: string | null;
  medico?: string | null;
  valor_profissional?: number | null;
};

export type FormaPagamentoSlice = {
  id: string;
  label: string;
  valor: number;
};

export type ProfissionalBar = {
  nome: string;
  valor: number;
};

export type SerieTemporal = {
  periodo: string;
  label: string;
  valor: number;
};

function labelFormaPagamento(id: string | null | undefined): string {
  if (!id) return 'Não informado';
  return ATENDIMENTO_LABEL[id] ?? id;
}

/** Receita (entradas) agrupada por forma de pagamento. */
export function agregarPorFormaPagamento(
  transacoes: TransacaoAgregavel[],
): FormaPagamentoSlice[] {
  const porForma: Record<string, number> = {};

  for (const t of transacoes) {
    if (t.tipo !== 'entrada') continue;
    const id = t.forma_pagamento || 'sem_forma';
    porForma[id] = (porForma[id] || 0) + t.valor;
  }

  return Object.entries(porForma)
    .map(([id, valor]) => ({
      id,
      label: id === 'sem_forma' ? 'Não informado' : labelFormaPagamento(id),
      valor,
    }))
    .sort((a, b) => b.valor - a.valor);
}

/** Repasse da profissional por nome (padrão relatorioProfissionais). */
export function agregarPorProfissional(
  transacoes: TransacaoAgregavel[],
): ProfissionalBar[] {
  const porProf: Record<string, number> = {};

  for (const t of transacoes) {
    if (t.tipo !== 'entrada' || !t.medico) continue;
    porProf[t.medico] =
      (porProf[t.medico] || 0) + (t.valor_profissional ?? 0);
  }

  return Object.entries(porProf)
    .map(([nome, valor]) => ({ nome, valor }))
    .sort((a, b) => b.valor - a.valor);
}

/** Entradas ao longo do tempo — dia ou semana conforme duração do período. */
export function agregarPorDia(
  transacoes: TransacaoAgregavel[],
  startDate?: string,
  endDate?: string,
): SerieTemporal[] {
  const entradas = transacoes.filter((t) => t.tipo === 'entrada' && t.data);
  if (entradas.length === 0) return [];

  const datas = entradas.map((t) => t.data);
  const minDate = startDate || datas.reduce((a, b) => (a < b ? a : b));
  const maxDate = endDate || datas.reduce((a, b) => (a > b ? a : b));
  const dias =
    differenceInCalendarDays(parseISO(maxDate), parseISO(minDate)) + 1;
  const porSemana = dias > 31;

  const buckets: Record<string, number> = {};

  for (const t of entradas) {
    const d = parseISO(t.data);
    const chave = porSemana
      ? format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd')
      : t.data;
    buckets[chave] = (buckets[chave] || 0) + t.valor;
  }

  return Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([periodo, valor]) => ({
      periodo,
      label: porSemana
        ? `Sem. ${format(parseISO(periodo), 'dd/MM', { locale: ptBR })}`
        : format(parseISO(periodo), 'dd/MM/yy', { locale: ptBR }),
      valor,
    }));
}

/** CSV dos dados agregados exibidos nos gráficos (para análise externa). */
export function gerarCsvGraficos(data: {
  porForma: FormaPagamentoSlice[];
  porProfissional: ProfissionalBar[];
  porPeriodo: SerieTemporal[];
}): string {
  const linhas: string[] = [];

  linhas.push('=== RECEITA POR FORMA DE PAGAMENTO ===');
  linhas.push('Forma;Valor (R$)');
  for (const f of data.porForma) {
    linhas.push(`${f.label};${f.valor.toFixed(2)}`);
  }

  linhas.push('');
  linhas.push('=== REPASSE POR PROFISSIONAL ===');
  linhas.push('Profissional;Parte prof. (R$)');
  for (const p of data.porProfissional) {
    linhas.push(`${p.nome};${p.valor.toFixed(2)}`);
  }

  linhas.push('');
  linhas.push('=== ENTRADAS AO LONGO DO TEMPO ===');
  linhas.push('Período;Rótulo;Valor (R$)');
  for (const s of data.porPeriodo) {
    linhas.push(`${s.periodo};${s.label};${s.valor.toFixed(2)}`);
  }

  linhas.push('');
  linhas.push('=== METADADOS ===');
  linhas.push('Exportado em;Aplicativo');
  linhas.push(`${new Date().toLocaleString('pt-BR')};Turquesa Agenda`);

  return linhas.join('\n');
}
