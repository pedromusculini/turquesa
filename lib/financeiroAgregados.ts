import {
  differenceInCalendarDays,
  format,
  parseISO,
  startOfWeek,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { AtendimentoItemLinha } from '@/lib/atendimentoItens';
import { normalizeCatalogoItensBody } from '@/lib/atendimentoItens';
import { ATENDIMENTO_LABEL } from '@/lib/constants';
import { MERGE_CLIENTES_OWNER_EMAIL } from '@/lib/clientesUnificar';
import { extractClienteFromDescricao } from '@/lib/financeiroClientes';

/** Conta com histórico em observacao/descricao antes de catalogo_itens estruturado. */
export const FINANCEIRO_LEGACY_CATALOGO_OWNER =
  process.env.FINANCEIRO_LEGACY_CATALOGO_OWNER?.toLowerCase().trim() ||
  MERGE_CLIENTES_OWNER_EMAIL;

export type TransacaoAgregavel = {
  tipo: 'entrada' | 'saida';
  data: string;
  valor: number;
  valor_bruto?: number | null;
  forma_pagamento?: string | null;
  medico?: string | null;
  valor_profissional?: number | null;
  observacao?: string | null;
  descricao?: string | null;
  catalogo_itens?: unknown;
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

export type CatalogoItemBar = {
  nome: string;
  quantidade: number;
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

function valorTransacaoEntrada(t: TransacaoAgregavel): number {
  const bruto = t.valor_bruto != null ? Number(t.valor_bruto) : NaN;
  if (Number.isFinite(bruto) && bruto > 0) return bruto;
  return Number(t.valor) || 0;
}

const IMPORT_TAG_RE = /^\[import:marrissa[^\]]*\]\s*/i;
const PAGAMENTO_PREFIX_RE = /^Pagamento:\s*/i;
const CATALOGO_PREFIX_RE = /^(Serviço|Produto):/i;
const EMBEDDED_CATALOGO_RE =
  /(Serviço|Produto):\s*(?:(\d+)x\s+)?(.+)/gi;

const BLOCKLIST_NOMES = new Set(
  [
    'atendimento',
    'sessão',
    'sessao',
    'retorno',
    'retorno de sessão',
    'nova sessão',
    'exame',
    'procedimento',
    'outro',
    'pix',
    'dinheiro',
    'cartão crédito',
    'cartao credito',
    'cartão débito',
    'cartao debito',
    'convênio',
    'convenio',
    'transferência',
    'transferencia',
    'permuta',
    'pagamento',
    'não informado',
    'nao informado',
    ...Object.values(ATENDIMENTO_LABEL).map((l) => l.toLowerCase()),
  ].map((s) => s.toLowerCase()),
);

function isBlocklistedNome(nome: string, clienteExcluir?: string | null): boolean {
  const n = nome.trim().toLowerCase();
  if (!n) return true;
  if (BLOCKLIST_NOMES.has(n)) return true;
  if (PAGAMENTO_PREFIX_RE.test(nome)) return true;
  if (clienteExcluir && n === clienteExcluir.trim().toLowerCase()) return true;
  return false;
}

/** Primeiro segmento útil após "Serviço:/Produto:" — ignora cliente, forma de pagamento e ruído. */
function trimNomeCatalogo(nome: string, clienteExcluir?: string | null): string | null {
  const segments = nome.split(/\s+[-—]\s+/).map((s) => s.trim()).filter(Boolean);
  for (const seg of segments) {
    if (CATALOGO_PREFIX_RE.test(seg)) continue;
    if (isBlocklistedNome(seg, clienteExcluir)) continue;
    return seg;
  }
  return null;
}

function parseSegmentoItem(
  seg: string,
  clienteExcluir?: string | null,
): AtendimentoItemLinha | null {
  const trimmed = seg.trim();
  if (!trimmed || IMPORT_TAG_RE.test(trimmed) || PAGAMENTO_PREFIX_RE.test(trimmed)) {
    return null;
  }
  const m = trimmed.match(/^(Serviço|Produto):\s*(?:(\d+)x\s+)?(.+)$/i);
  if (!m) return null;
  const nome = trimNomeCatalogo(m[3] ?? '', clienteExcluir);
  if (!nome) return null;
  const tipo = m[1].toLowerCase().startsWith('prod') ? 'produto' : 'servico';
  const quantidade = Math.max(1, parseInt(m[2] ?? '1', 10) || 1);
  return {
    key: `legacy-${tipo}-${nome}`,
    catalogoId: '',
    nome,
    tipo,
    precoCentavos: 0,
    quantidade,
  };
}

function splitFonteItens(fonte: string): string[] {
  return fonte
    .split(/\s*·\s*|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function observacaoTemItensCatalogo(observacao: string): boolean {
  return /(?:^|[\s·\n])(Serviço|Produto):/i.test(observacao);
}

function extractItemsFromText(
  text: string,
  clienteExcluir?: string | null,
): AtendimentoItemLinha[] {
  const seen = new Set<string>();
  const items: AtendimentoItemLinha[] = [];

  const add = (item: AtendimentoItemLinha | null) => {
    if (!item) return;
    const chave = `${item.tipo}:${item.nome.toLowerCase()}`;
    if (seen.has(chave)) return;
    seen.add(chave);
    items.push(item);
  };

  const segmentsToScan = new Set<string>();
  for (const parte of splitFonteItens(text)) {
    segmentsToScan.add(parte);
    for (const sub of parte.split(/\s+-\s+/)) {
      const s = sub.trim();
      if (s) segmentsToScan.add(s);
    }
  }

  for (const seg of segmentsToScan) {
    add(parseSegmentoItem(seg, clienteExcluir));
    const re = new RegExp(EMBEDDED_CATALOGO_RE.source, 'gi');
    let m: RegExpExecArray | null;
    while ((m = re.exec(seg)) !== null) {
      const tipo = m[1];
      const qtd = m[2];
      const nomeRaw = (m[3] ?? '').trim();
      const prefix = qtd ? `${qtd}x ` : '';
      add(parseSegmentoItem(`${tipo}: ${prefix}${nomeRaw}`, clienteExcluir));
    }
  }

  return items;
}

/** Marrissa import: descricao "Procedimento — Cliente" sem prefixo Serviço:. */
function parseImportDescricaoServico(
  descricao: string,
  clienteExcluir?: string | null,
): AtendimentoItemLinha[] {
  for (const sep of [' — ', ' - ']) {
    const parts = descricao.split(sep);
    if (parts.length < 2) continue;
    const proc = parts[0]?.trim();
    if (
      !proc ||
      CATALOGO_PREFIX_RE.test(proc) ||
      isBlocklistedNome(proc, clienteExcluir)
    ) {
      continue;
    }
    return [
      {
        key: `legacy-servico-${proc}`,
        catalogoId: '',
        nome: proc,
        tipo: 'servico',
        precoCentavos: 0,
        quantidade: 1,
      },
    ];
  }
  return [];
}

/** Extrai linhas de catálogo a partir de observacao/descricao (formato formatItensResumo). */
export function parseItensFromObservacao(
  observacao?: string | null,
  descricao?: string | null,
): AtendimentoItemLinha[] {
  const clienteExcluir = descricao
    ? extractClienteFromDescricao(descricao, 'entrada')
    : null;

  const obs = observacao?.trim() ?? '';
  const desc = descricao?.trim() ?? '';

  if (obs && observacaoTemItensCatalogo(obs)) {
    const fromObs = extractItemsFromText(obs, clienteExcluir);
    if (fromObs.length > 0) return fromObs;
  }

  if (!desc) return [];

  const fromDesc = extractItemsFromText(desc, clienteExcluir);
  if (fromDesc.length > 0) return fromDesc;

  return parseImportDescricaoServico(desc, clienteExcluir);
}

function normalizeItensFromJson(raw: unknown): AtendimentoItemLinha[] {
  return normalizeCatalogoItensBody(raw).filter((i) => i.nome);
}

/** Usa JSON estruturado; fallback parse só para conta legacy (Marrissa). */
export function extractItensFromTransacao(
  t: TransacaoAgregavel,
  ownerEmail?: string | null,
): AtendimentoItemLinha[] {
  const fromJson = normalizeItensFromJson(t.catalogo_itens);
  if (fromJson.length > 0) return fromJson;

  const owner = ownerEmail?.toLowerCase().trim() ?? '';
  if (owner !== FINANCEIRO_LEGACY_CATALOGO_OWNER) return [];

  return parseItensFromObservacao(t.observacao, t.descricao);
}

function alocarValorPorItens(
  itens: AtendimentoItemLinha[],
  valorTotal: number,
): number[] {
  if (itens.length === 0) return [];
  const pesos = itens.map((i) => {
    const sub = i.precoCentavos * Math.max(1, i.quantidade);
    return sub > 0 ? sub : Math.max(1, i.quantidade);
  });
  const totalPeso = pesos.reduce((a, b) => a + b, 0) || itens.length;
  return pesos.map((p) => (valorTotal * p) / totalPeso);
}

function agregarPorTipoCatalogo(
  transacoes: TransacaoAgregavel[],
  tipo: 'servico' | 'produto',
  ownerEmail?: string | null,
): CatalogoItemBar[] {
  const porNome: Record<string, { quantidade: number; valor: number }> = {};

  for (const t of transacoes) {
    if (t.tipo !== 'entrada') continue;
    const itens = extractItensFromTransacao(t, ownerEmail).filter((i) => i.tipo === tipo);
    if (itens.length === 0) continue;

    const valores = alocarValorPorItens(itens, valorTransacaoEntrada(t));
    itens.forEach((item, idx) => {
      const nome = item.nome.trim();
      if (!nome) return;
      if (!porNome[nome]) porNome[nome] = { quantidade: 0, valor: 0 };
      porNome[nome].quantidade += Math.max(1, item.quantidade);
      porNome[nome].valor += valores[idx] ?? 0;
    });
  }

  return Object.entries(porNome)
    .map(([nome, { quantidade, valor }]) => ({
      nome,
      quantidade,
      valor: Math.round(valor * 100) / 100,
    }))
    .sort((a, b) => b.valor - a.valor);
}

/** Faturamento e quantidade vendida por serviço. */
export function agregarPorServico(
  transacoes: TransacaoAgregavel[],
  ownerEmail?: string | null,
): CatalogoItemBar[] {
  return agregarPorTipoCatalogo(transacoes, 'servico', ownerEmail);
}

/** Faturamento e quantidade vendida por produto. */
export function agregarPorProduto(
  transacoes: TransacaoAgregavel[],
  ownerEmail?: string | null,
): CatalogoItemBar[] {
  return agregarPorTipoCatalogo(transacoes, 'produto', ownerEmail);
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
  porServico?: CatalogoItemBar[];
  porProduto?: CatalogoItemBar[];
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

  if (data.porServico && data.porServico.length > 0) {
    linhas.push('');
    linhas.push('=== FATURAMENTO POR SERVIÇO ===');
    linhas.push('Serviço;Quantidade;Valor (R$)');
    for (const s of data.porServico) {
      linhas.push(`${s.nome};${s.quantidade};${s.valor.toFixed(2)}`);
    }
  }

  if (data.porProduto && data.porProduto.length > 0) {
    linhas.push('');
    linhas.push('=== FATURAMENTO POR PRODUTO ===');
    linhas.push('Produto;Quantidade;Valor (R$)');
    for (const p of data.porProduto) {
      linhas.push(`${p.nome};${p.quantidade};${p.valor.toFixed(2)}`);
    }
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

/** Seções de serviço/produto para backup CSV (mesmo formato dos gráficos). */
export function gerarCsvSecoesCatalogo(
  transacoes: TransacaoAgregavel[],
  ownerEmail?: string | null,
): string[] {
  const porServico = agregarPorServico(transacoes, ownerEmail);
  const porProduto = agregarPorProduto(transacoes, ownerEmail);
  const linhas: string[] = [];

  if (porServico.length > 0) {
    linhas.push('');
    linhas.push('=== FATURAMENTO POR SERVIÇO ===');
    linhas.push('Serviço;Quantidade;Valor (R$)');
    for (const s of porServico) {
      linhas.push(`${s.nome};${s.quantidade};${s.valor.toFixed(2)}`);
    }
  }

  if (porProduto.length > 0) {
    linhas.push('');
    linhas.push('=== FATURAMENTO POR PRODUTO ===');
    linhas.push('Produto;Quantidade;Valor (R$)');
    for (const p of porProduto) {
      linhas.push(`${p.nome};${p.quantidade};${p.valor.toFixed(2)}`);
    }
  }

  return linhas;
}
