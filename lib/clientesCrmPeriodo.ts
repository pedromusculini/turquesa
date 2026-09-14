import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CRM_HISTORICO_MESES } from '@/lib/clientesCrmConstants';
import type { ClientesCrmHistoricoMes, ClientesCrmOrigemStats } from '@/lib/clientesCrmStats';
import type { ClientesCrmMarketingHistoricoMes } from '@/lib/clientesCrmMarketing';

const TZ = 'America/Sao_Paulo';

export const CRM_PERIODO_IDS = [
  'este_mes',
  'mes_anterior',
  'ultimos_3_meses',
  'ultimos_6_meses',
  'ultimos_12_meses',
  'este_trimestre',
  'trimestre_anterior',
  'este_ano',
  'ano_anterior',
] as const;

export type CrmPeriodoId = (typeof CRM_PERIODO_IDS)[number];

export const CRM_PERIODO_LABELS: Record<CrmPeriodoId, string> = {
  este_mes: 'Este mês',
  mes_anterior: 'Mês anterior',
  ultimos_3_meses: 'Últimos 3 meses',
  ultimos_6_meses: 'Últimos 6 meses',
  ultimos_12_meses: 'Últimos 12 meses',
  este_trimestre: 'Este trimestre',
  trimestre_anterior: 'Trimestre anterior',
  este_ano: 'Este ano',
  ano_anterior: 'Ano anterior',
};

export const CRM_PERIODO_DEFAULT: CrmPeriodoId = 'este_mes';

export type CrmPeriodoRange = {
  id: CrmPeriodoId;
  label: string;
  startMes: string;
  endMes: string;
  meses: string[];
  prevStartMes: string;
  prevEndMes: string;
  mesesAnterior: string[];
  mesesGrafico: string[];
  periodoLabel: string;
  periodoAnteriorLabel: string;
};

export function isCrmPeriodoId(value: string): value is CrmPeriodoId {
  return (CRM_PERIODO_IDS as readonly string[]).includes(value);
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
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

export function mesKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function parseMesKey(mes: string): { year: number; month: number } {
  return {
    year: Number(mes.slice(0, 4)),
    month: Number(mes.slice(5, 7)),
  };
}

export function monthLabel(year: number, month: number, short = false): string {
  const d = new Date(Date.UTC(year, month - 1, 15, 12, 0, 0));
  return format(d, short ? 'MMM yy' : 'MMMM yyyy', { locale: ptBR });
}

export function refYearMonth(ref: Date): { year: number; month: number } {
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

export function listMesesInclusive(startMes: string, endMes: string): string[] {
  const start = parseMesKey(startMes);
  const end = parseMesKey(endMes);
  const items: string[] = [];
  let cursor = { ...start };
  const guard = 48;
  for (let i = 0; i < guard; i++) {
    items.push(mesKey(cursor.year, cursor.month));
    if (cursor.year === end.year && cursor.month === end.month) break;
    cursor = shiftMonth(cursor.year, cursor.month, 1);
  }
  return items;
}

export function formatMesRangeLabel(meses: string[]): string {
  if (meses.length === 0) return '';
  const first = parseMesKey(meses[0]);
  if (meses.length === 1) return monthLabel(first.year, first.month);
  const last = parseMesKey(meses[meses.length - 1]);
  return `${monthLabel(first.year, first.month, true)} – ${monthLabel(last.year, last.month)}`;
}

function trimestreStartMonth(month: number): number {
  return Math.floor((month - 1) / 3) * 3 + 1;
}

export function mesesGraficoParaPeriodo(meses: string[], minContext = CRM_HISTORICO_MESES): string[] {
  if (meses.length === 0) return [];
  const start = parseMesKey(meses[0]);
  const end = parseMesKey(meses[meses.length - 1]);
  const before = shiftMonth(start.year, start.month, -1);
  const selectedPlusPrev = [mesKey(before.year, before.month), ...meses];
  if (selectedPlusPrev.length >= minContext) return selectedPlusPrev;

  const out: string[] = [];
  for (let i = minContext - 1; i >= 0; i--) {
    const p = shiftMonth(end.year, end.month, -i);
    out.push(mesKey(p.year, p.month));
  }
  return out;
}

export function resolveCrmPeriodo(id: CrmPeriodoId, ref = new Date()): CrmPeriodoRange {
  const { year, month } = refYearMonth(ref);
  let start = { year, month };
  let end = { year, month };

  switch (id) {
    case 'este_mes':
      start = { year, month };
      end = { year, month };
      break;
    case 'mes_anterior':
      start = shiftMonth(year, month, -1);
      end = start;
      break;
    case 'ultimos_3_meses':
      start = shiftMonth(year, month, -2);
      end = { year, month };
      break;
    case 'ultimos_6_meses':
      start = shiftMonth(year, month, -5);
      end = { year, month };
      break;
    case 'ultimos_12_meses':
      start = shiftMonth(year, month, -11);
      end = { year, month };
      break;
    case 'este_trimestre':
      start = { year, month: trimestreStartMonth(month) };
      end = { year, month };
      break;
    case 'trimestre_anterior': {
      const qStart = trimestreStartMonth(month);
      end = shiftMonth(year, qStart, -1);
      start = shiftMonth(end.year, end.month, -2);
      break;
    }
    case 'este_ano':
      start = { year, month: 1 };
      end = { year, month };
      break;
    case 'ano_anterior':
      start = { year: year - 1, month: 1 };
      end = { year: year - 1, month: 12 };
      break;
  }

  const meses = listMesesInclusive(mesKey(start.year, start.month), mesKey(end.year, end.month));
  const prevEnd = shiftMonth(start.year, start.month, -1);
  const prevStart = shiftMonth(prevEnd.year, prevEnd.month, -(meses.length - 1));
  const mesesAnterior = listMesesInclusive(
    mesKey(prevStart.year, prevStart.month),
    mesKey(prevEnd.year, prevEnd.month),
  );

  return {
    id,
    label: CRM_PERIODO_LABELS[id],
    startMes: meses[0],
    endMes: meses[meses.length - 1],
    meses,
    prevStartMes: mesesAnterior[0],
    prevEndMes: mesesAnterior[mesesAnterior.length - 1],
    mesesAnterior,
    mesesGrafico: mesesGraficoParaPeriodo(meses),
    periodoLabel: formatMesRangeLabel(meses),
    periodoAnteriorLabel: formatMesRangeLabel(mesesAnterior),
  };
}

export function emptyOrigemStats(): ClientesCrmOrigemStats {
  return { manual: 0, formulario: 0, google_contatos: 0 };
}

export function sumOrigemStats(items: ClientesCrmOrigemStats[]): ClientesCrmOrigemStats {
  const out = emptyOrigemStats();
  for (const item of items) {
    out.manual += item.manual;
    out.formulario += item.formulario;
    out.google_contatos += item.google_contatos;
  }
  return out;
}

export function filterHistoricoMeses<T extends { mes: string }>(historico: T[], meses: string[]): T[] {
  const set = new Set(meses);
  return historico.filter((h) => set.has(h.mes));
}

export function orderedHistoricoMeses<T extends { mes: string }>(historico: T[], meses: string[]): T[] {
  const byMes = new Map(historico.map((h) => [h.mes, h]));
  return meses.map((mes) => byMes.get(mes)).filter((h): h is T => Boolean(h));
}

export type CrmPeriodoNovosKpis = {
  novos: number;
  novosAnterior: number;
  variacao: number;
  origem: ClientesCrmOrigemStats;
};

export function aggregateNovosPeriodo(
  historico: ClientesCrmHistoricoMes[],
  range: CrmPeriodoRange,
): CrmPeriodoNovosKpis {
  const atual = filterHistoricoMeses(historico, range.meses);
  const anterior = filterHistoricoMeses(historico, range.mesesAnterior);
  const novos = atual.reduce((s, h) => s + h.novos, 0);
  const novosAnterior = anterior.reduce((s, h) => s + h.novos, 0);
  return {
    novos,
    novosAnterior,
    variacao: novos - novosAnterior,
    origem: sumOrigemStats(atual.map((h) => h.origem ?? emptyOrigemStats())),
  };
}

export type CrmPeriodoMarketingKpis = {
  gasto: number;
  gastoAnterior: number;
  transacoes: number;
  transacoesAnterior: number;
  cac: number | null;
  cacAnterior: number | null;
  variacaoCacPct: number | null;
  receitaMediaPrimeiraSessao: number | null;
  receitaMediaPrimeiraSessaoAnterior: number | null;
  novosComPrimeiraSessao: number;
  novosComPrimeiraSessaoAnterior: number;
  roi: number | null;
  roiAnterior: number | null;
};

function calcCac(gasto: number, novos: number): number | null {
  if (novos <= 0 || gasto <= 0) return null;
  return Math.round((gasto / novos) * 100) / 100;
}

function calcRoi(receitaMedia: number | null, cac: number | null): number | null {
  if (receitaMedia == null || cac == null || cac <= 0) return null;
  return Math.round((receitaMedia / cac) * 100) / 100;
}

function calcVariacaoPct(atual: number | null, anterior: number | null): number | null {
  if (atual == null || anterior == null || anterior <= 0) return null;
  return Math.round(((atual - anterior) / anterior) * 1000) / 10;
}

function aggregateMarketingSlice(
  historico: ClientesCrmMarketingHistoricoMes[],
  meses: string[],
  novos: number,
): {
  gasto: number;
  transacoes: number;
  cac: number | null;
  receitaMedia: number | null;
  novosComPrimeiraSessao: number;
  roi: number | null;
} {
  const slice = filterHistoricoMeses(historico, meses);
  const gasto = slice.reduce((s, h) => s + h.gasto_marketing, 0);
  const transacoes = slice.reduce((s, h) => s + (h.transacoes_marketing ?? 0), 0);
  const somaReceita = slice.reduce((s, h) => s + (h.receita_primeira_sessao_soma ?? 0), 0);
  const novosComPrimeiraSessao = slice.reduce(
    (s, h) => s + (h.novos_com_primeira_sessao ?? 0),
    0,
  );
  const receitaMedia =
    novosComPrimeiraSessao > 0
      ? Math.round((somaReceita / novosComPrimeiraSessao) * 100) / 100
      : null;
  const cac = calcCac(gasto, novos);
  return {
    gasto: Math.round(gasto * 100) / 100,
    transacoes,
    cac,
    receitaMedia,
    novosComPrimeiraSessao,
    roi: calcRoi(receitaMedia, cac),
  };
}

export function aggregateMarketingPeriodo(
  historico: ClientesCrmMarketingHistoricoMes[],
  range: CrmPeriodoRange,
  novos: number,
  novosAnterior: number,
): CrmPeriodoMarketingKpis {
  const atual = aggregateMarketingSlice(historico, range.meses, novos);
  const anterior = aggregateMarketingSlice(historico, range.mesesAnterior, novosAnterior);
  return {
    gasto: atual.gasto,
    gastoAnterior: anterior.gasto,
    transacoes: atual.transacoes,
    transacoesAnterior: anterior.transacoes,
    cac: atual.cac,
    cacAnterior: anterior.cac,
    variacaoCacPct: calcVariacaoPct(atual.cac, anterior.cac),
    receitaMediaPrimeiraSessao: atual.receitaMedia,
    receitaMediaPrimeiraSessaoAnterior: anterior.receitaMedia,
    novosComPrimeiraSessao: atual.novosComPrimeiraSessao,
    novosComPrimeiraSessaoAnterior: anterior.novosComPrimeiraSessao,
    roi: atual.roi,
    roiAnterior: anterior.roi,
  };
}
