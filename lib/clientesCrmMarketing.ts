import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CATEGORIA_LABEL } from '@/lib/constants';
import {
  defaultCategoriasSaida,
  sanitizeCategoriasSaidaInput,
  type CategoriaSaida,
} from '@/lib/configCategoriasSaida';
import type { ClientesCrmStats } from '@/lib/clientesCrmStats';
import type { ClienteDriveRecord, ClientesDriveStore } from '@/lib/clientesDrive';
import { supabaseAdmin } from '@/lib/supabaseClient';

const MARKETING_ID = 'marketing';
const TZ = 'America/Sao_Paulo';

export type ClientesCrmMarketingHistoricoMes = {
  mes: string;
  label: string;
  label_curto: string;
  novos: number;
  gasto_marketing: number;
  cac: number | null;
};

export type ClientesCrmMarketingStats = {
  gasto_mes: number;
  gasto_mes_anterior: number;
  transacoes_mes: number;
  transacoes_mes_anterior: number;
  cac_mes: number | null;
  cac_mes_anterior: number | null;
  variacao_cac_pct: number | null;
  receita_media_primeira_sessao_mes: number | null;
  novos_com_primeira_sessao_mes: number;
  roi_primeira_sessao: number | null;
  historico: ClientesCrmMarketingHistoricoMes[];
};

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

function monthDateRange(year: number, month: number): { start: string; end: string } {
  const mm = String(month).padStart(2, '0');
  const endDay = new Date(year, month, 0).getDate();
  return {
    start: `${year}-${mm}-01`,
    end: `${year}-${mm}-${String(endDay).padStart(2, '0')}`,
  };
}

function monthLabel(year: number, month: number, short = false): string {
  const d = new Date(Date.UTC(year, month - 1, 15, 12, 0, 0));
  return format(d, short ? 'MMM yy' : 'MMMM yyyy', { locale: ptBR });
}

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

function mesKeyFromIso(iso: string): string | null {
  if (!iso?.trim()) return null;
  const { year, month } = brYearMonth(iso);
  if (!year || !month) return null;
  return `${year}-${String(month).padStart(2, '0')}`;
}

function isMarketingCategoriaId(id: string, categorias: CategoriaSaida[]): boolean {
  if (id === MARKETING_ID) return true;
  const cat = categorias.find((c) => c.id === id);
  if (!cat) return false;
  const text = `${cat.id} ${cat.label}`.toLowerCase();
  return /marketing|publicidade|agencia|agência|anuncio|anúncio|meta ads|google ads|tráfego|trafego/.test(
    text,
  );
}

async function loadMarketingCategoriaIds(owner: string): Promise<string[]> {
  const ids = new Set<string>([MARKETING_ID]);

  const { data, error } = await supabaseAdmin
    .from('onboarding_profiles')
    .select('categorias_saida')
    .eq('email', owner)
    .maybeSingle();

  const categorias = !error && data?.categorias_saida
    ? sanitizeCategoriasSaidaInput(data.categorias_saida)
    : defaultCategoriasSaida();

  for (const c of categorias) {
    if (isMarketingCategoriaId(c.id, categorias)) ids.add(c.id);
  }

  return Array.from(ids);
}

async function sumMarketingGasto(
  owner: string,
  categoriaIds: string[],
  start: string,
  end: string,
): Promise<{ total: number; count: number }> {
  if (categoriaIds.length === 0) return { total: 0, count: 0 };

  const { data, error } = await supabaseAdmin
    .from('financeiro_transacoes')
    .select('valor, categoria')
    .eq('owner_email', owner)
    .eq('tipo', 'saida')
    .in('categoria', categoriaIds)
    .gte('data', start)
    .lte('data', end);

  if (error) {
    if (error.code === 'PGRST205') return { total: 0, count: 0 };
    throw error;
  }

  let total = 0;
  let count = 0;
  for (const row of data ?? []) {
    const v = Number(row.valor);
    if (!Number.isFinite(v) || v <= 0) continue;
    total += v;
    count += 1;
  }

  return { total: Math.round(total * 100) / 100, count };
}

async function sumMarketingGastoByMonth(
  owner: string,
  categoriaIds: string[],
  start: string,
  end: string,
): Promise<Map<string, number>> {
  const byMes = new Map<string, number>();
  if (categoriaIds.length === 0) return byMes;

  const { data, error } = await supabaseAdmin
    .from('financeiro_transacoes')
    .select('valor, data')
    .eq('owner_email', owner)
    .eq('tipo', 'saida')
    .in('categoria', categoriaIds)
    .gte('data', start)
    .lte('data', end);

  if (error) {
    if (error.code === 'PGRST205') return byMes;
    throw error;
  }

  for (const row of data ?? []) {
    const v = Number(row.valor);
    if (!Number.isFinite(v) || v <= 0) continue;
    const mes = String(row.data ?? '').slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(mes)) continue;
    byMes.set(mes, Math.round(((byMes.get(mes) ?? 0) + v) * 100) / 100);
  }

  return byMes;
}

function calcCac(gasto: number, novos: number): number | null {
  if (novos <= 0 || gasto <= 0) return null;
  return Math.round((gasto / novos) * 100) / 100;
}

function calcVariacaoPct(atual: number | null, anterior: number | null): number | null {
  if (atual == null || anterior == null || anterior <= 0) return null;
  return Math.round(((atual - anterior) / anterior) * 1000) / 10;
}

function calcRoi(receitaMedia: number | null, cac: number | null): number | null {
  if (receitaMedia == null || cac == null || cac <= 0) return null;
  return Math.round((receitaMedia / cac) * 100) / 100;
}

function atendimentoSortKey(data: string): number {
  const d = data.includes('T') ? data : `${data}T12:00:00`;
  const t = new Date(d).getTime();
  return Number.isFinite(t) ? t : Number.MAX_SAFE_INTEGER;
}

function firstRealizadoAtendimento(c: ClienteDriveRecord) {
  let first: (typeof c.atendimentos)[number] | null = null;
  let firstKey = Number.MAX_SAFE_INTEGER;
  for (const a of c.atendimentos ?? []) {
    if (a.status !== 'realizado') continue;
    const key = atendimentoSortKey(a.data);
    if (key < firstKey) {
      firstKey = key;
      first = a;
    }
  }
  return first;
}

function computePrimeiraSessaoNovosMes(
  store: ClientesDriveStore,
  mesReferencia: string,
  novosMes: number,
): Pick<
  ClientesCrmMarketingStats,
  'receita_media_primeira_sessao_mes' | 'novos_com_primeira_sessao_mes'
> {
  const valores: number[] = [];

  for (const c of store.clientes) {
    if (!c.created_at) continue;
    const mesKey = mesKeyFromIso(c.created_at);
    if (mesKey !== mesReferencia) continue;

    const first = firstRealizadoAtendimento(c);
    if (!first) continue;

    const valor = typeof first.valor === 'number' && first.valor > 0 ? first.valor : null;
    if (valor == null) continue;
    valores.push(valor);
  }

  const novosComSessao = valores.length;
  const receitaMedia =
    valores.length > 0
      ? Math.round((valores.reduce((s, v) => s + v, 0) / valores.length) * 100) / 100
      : null;

  return {
    receita_media_primeira_sessao_mes: receitaMedia,
    novos_com_primeira_sessao_mes: novosComSessao,
  };
}

function buildMarketingHistorico(
  stats: ClientesCrmStats,
  gastoPorMes: Map<string, number>,
): ClientesCrmMarketingHistoricoMes[] {
  return stats.historico_meses.map((h) => {
    const gasto = gastoPorMes.get(h.mes) ?? 0;
    return {
      mes: h.mes,
      label: h.label,
      label_curto: h.label_curto,
      novos: h.novos,
      gasto_marketing: gasto,
      cac: calcCac(gasto, h.novos),
    };
  });
}

export async function getClientesCrmMarketingStats(
  ownerEmail: string,
  stats: ClientesCrmStats,
  store?: ClientesDriveStore,
): Promise<ClientesCrmMarketingStats> {
  const owner = ownerEmail.toLowerCase().trim();
  const [refYear, refMonth] = stats.mes_referencia.split('-').map(Number);
  const { year: prevYear, month: prevMonth } = shiftMonth(refYear, refMonth, -1);

  const categoriaIds = await loadMarketingCategoriaIds(owner);
  const mesAtual = monthDateRange(refYear, refMonth);
  const mesAnterior = monthDateRange(prevYear, prevMonth);

  const firstHist = stats.historico_meses[0];
  const lastHist = stats.historico_meses[stats.historico_meses.length - 1];
  const histStart = firstHist
    ? monthDateRange(
        Number(firstHist.mes.slice(0, 4)),
        Number(firstHist.mes.slice(5, 7)),
      ).start
    : mesAtual.start;
  const histEnd = lastHist
    ? monthDateRange(Number(lastHist.mes.slice(0, 4)), Number(lastHist.mes.slice(5, 7))).end
    : mesAtual.end;

  const [atual, anterior, gastoPorMes] = await Promise.all([
    sumMarketingGasto(owner, categoriaIds, mesAtual.start, mesAtual.end),
    sumMarketingGasto(owner, categoriaIds, mesAnterior.start, mesAnterior.end),
    sumMarketingGastoByMonth(owner, categoriaIds, histStart, histEnd),
  ]);

  const cacMes = calcCac(atual.total, stats.novos_mes);
  const cacAnterior = calcCac(anterior.total, stats.novos_mes_anterior);

  const primeiraSessao = store
    ? computePrimeiraSessaoNovosMes(store, stats.mes_referencia, stats.novos_mes)
    : {
        receita_media_primeira_sessao_mes: null,
        novos_com_primeira_sessao_mes: 0,
      };

  return {
    gasto_mes: atual.total,
    gasto_mes_anterior: anterior.total,
    transacoes_mes: atual.count,
    transacoes_mes_anterior: anterior.count,
    cac_mes: cacMes,
    cac_mes_anterior: cacAnterior,
    variacao_cac_pct: calcVariacaoPct(cacMes, cacAnterior),
    receita_media_primeira_sessao_mes: primeiraSessao.receita_media_primeira_sessao_mes,
    novos_com_primeira_sessao_mes: primeiraSessao.novos_com_primeira_sessao_mes,
    roi_primeira_sessao: calcRoi(primeiraSessao.receita_media_primeira_sessao_mes, cacMes),
    historico: buildMarketingHistorico(stats, gastoPorMes),
  };
}

export function marketingCategoriaLabel(): string {
  return CATEGORIA_LABEL[MARKETING_ID] ?? 'Marketing';
}

export async function enrichClientesCrmStatsWithMarketing(
  ownerEmail: string,
  stats: ClientesCrmStats,
  store?: ClientesDriveStore,
): Promise<ClientesCrmStats> {
  const marketing = await getClientesCrmMarketingStats(ownerEmail, stats, store);
  return { ...stats, marketing };
}
