export type CatalogoItemResumo = {
  id: string;
  nome: string;
  tipo: 'servico' | 'produto';
  preco_centavos: number;
  duracao_minutos?: number | null;
  estoque?: number | null;
  ativo?: boolean;
};

export type AtendimentoItemLinha = {
  key: string;
  catalogoId: string;
  nome: string;
  tipo: 'servico' | 'produto';
  precoCentavos: number;
  quantidade: number;
};

export function newItemKey(): string {
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function linhaFromCatalogo(item: CatalogoItemResumo, quantidade = 1): AtendimentoItemLinha {
  return {
    key: newItemKey(),
    catalogoId: item.id,
    nome: item.nome,
    tipo: item.tipo === 'produto' ? 'produto' : 'servico',
    precoCentavos: item.preco_centavos,
    quantidade: Math.max(1, quantidade),
  };
}

export function calcularTotalItens(itens: AtendimentoItemLinha[]): number {
  const centavos = itens.reduce(
    (acc, i) => acc + i.precoCentavos * Math.max(1, i.quantidade),
    0,
  );
  return Math.round(centavos) / 100;
}

export function formatItensResumo(itens: AtendimentoItemLinha[]): string {
  if (!itens.length) return '';
  return itens
    .map((i) => {
      const qtd = i.quantidade > 1 ? `${i.quantidade}x ` : '';
      const tipo = i.tipo === 'produto' ? 'Produto' : 'Serviço';
      return `${tipo}: ${qtd}${i.nome}`;
    })
    .join(' · ');
}

export function formatObservacaoAtendimento(
  observacoes: string,
  itens: AtendimentoItemLinha[],
): string {
  const parts: string[] = [];
  const itensTxt = formatItensResumo(itens);
  if (itensTxt) parts.push(itensTxt);
  const obs = observacoes.trim();
  if (obs) parts.push(obs);
  return parts.join('\n\n');
}

const GENERIC_SERVICE = /^(atendimento|retorno|retorno de sessão|nova sessão)$/i;

export function prefillItensFromConsulta(
  catalog: CatalogoItemResumo[],
  consulta: { service?: string; catalogoItens?: AtendimentoItemLinha[] },
): AtendimentoItemLinha[] {
  if (consulta.catalogoItens?.length) {
    return consulta.catalogoItens.map((i) => ({ ...i, key: i.key || newItemKey() }));
  }

  const svc = consulta.service?.trim();
  if (!svc || GENERIC_SERVICE.test(svc)) return [];

  const lower = svc.toLowerCase();
  const exact = catalog.find((c) => c.nome.toLowerCase() === lower);
  if (exact) return [linhaFromCatalogo(exact)];

  const partial = catalog.find(
    (c) => lower.includes(c.nome.toLowerCase()) || c.nome.toLowerCase().includes(lower),
  );
  if (partial) return [linhaFromCatalogo(partial)];

  return [];
}

/** Normaliza itens do catálogo enviados pelo cliente (API). */
export function normalizeCatalogoItensBody(raw: unknown): AtendimentoItemLinha[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      const r = row as Record<string, unknown>;
      const catalogoId = String(r.catalogoId ?? r.catalogo_id ?? '').trim();
      const nome = String(r.nome ?? '').trim();
      if (!catalogoId || !nome) return null;
      return {
        key: String(r.key ?? catalogoId),
        catalogoId,
        nome,
        tipo: r.tipo === 'produto' ? 'produto' : 'servico',
        precoCentavos: Math.max(0, Math.round(Number(r.precoCentavos ?? r.preco_centavos) || 0)),
        quantidade: Math.max(1, Math.round(Number(r.quantidade) || 1)),
      } satisfies AtendimentoItemLinha;
    })
    .filter((i): i is AtendimentoItemLinha => i != null);
}

export function normalizeCatalogoApiRow(raw: Record<string, unknown>): CatalogoItemResumo | null {
  const id = String(raw.id ?? '').trim();
  const nome = String(raw.nome ?? '').trim();
  if (!id || !nome) return null;
  return {
    id,
    nome,
    tipo: raw.tipo === 'produto' ? 'produto' : 'servico',
    preco_centavos: Math.max(0, Math.round(Number(raw.preco_centavos) || 0)),
    duracao_minutos: raw.duracao_minutos == null ? null : Number(raw.duracao_minutos),
    estoque: raw.estoque == null ? null : Number(raw.estoque),
    ativo: raw.ativo !== false,
  };
}
