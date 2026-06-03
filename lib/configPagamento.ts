/** Meios de pagamento configuráveis e cálculo de taxas — Turquesa Agenda */

export type MetodoPagamentoId =
  | 'pix'
  | 'debito'
  | 'credito_1x'
  | 'credito_2x'
  | 'credito_3x'
  | 'credito_4x'
  | 'credito_5x'
  | 'credito_6x'
  | 'credito_7x'
  | 'credito_8x'
  | 'credito_9x'
  | 'credito_10x'
  | 'credito_11x'
  | 'credito_12x'
  | 'dinheiro'
  | 'transferencia';

export type MetodoPagamentoConfig =
  | { tipo: 'fixo'; valor_centavos: number }
  | { tipo: 'percentual'; percentual: number };

export type ConfigPagamentoMetodos = Partial<Record<MetodoPagamentoId, MetodoPagamentoConfig>>;

export const METODOS_PAGAMENTO_LABELS: Record<MetodoPagamentoId, string> = {
  pix: 'PIX',
  debito: 'Cartão débito',
  credito_1x: 'Crédito à vista (1x)',
  credito_2x: 'Crédito 2x',
  credito_3x: 'Crédito 3x',
  credito_4x: 'Crédito 4x',
  credito_5x: 'Crédito 5x',
  credito_6x: 'Crédito 6x',
  credito_7x: 'Crédito 7x',
  credito_8x: 'Crédito 8x',
  credito_9x: 'Crédito 9x',
  credito_10x: 'Crédito 10x',
  credito_11x: 'Crédito 11x',
  credito_12x: 'Crédito 12x',
  dinheiro: 'Dinheiro',
  transferencia: 'Transferência',
};

/** Mapeia forma_pagamento do atendimento + parcelas → id de config */
export function metodoIdFromForma(
  formaPagamento: string,
  parcelas: number,
): MetodoPagamentoId | null {
  if (formaPagamento === 'pix') return 'pix';
  if (formaPagamento === 'dinheiro') return 'dinheiro';
  if (formaPagamento === 'transferencia') return 'transferencia';
  if (formaPagamento === 'cartao_debito') return 'debito';
  if (formaPagamento === 'cartao_credito') {
    const p = Math.min(12, Math.max(1, parcelas || 1));
    return `credito_${p}x` as MetodoPagamentoId;
  }
  return null;
}

export function defaultConfigPagamento(): ConfigPagamentoMetodos {
  return {
    pix: { tipo: 'fixo', valor_centavos: 0 },
    debito: { tipo: 'percentual', percentual: 1.5 },
    credito_1x: { tipo: 'percentual', percentual: 2.5 },
    credito_2x: { tipo: 'percentual', percentual: 3.0 },
    credito_3x: { tipo: 'percentual', percentual: 3.2 },
    credito_4x: { tipo: 'percentual', percentual: 3.4 },
    credito_5x: { tipo: 'percentual', percentual: 3.6 },
    credito_6x: { tipo: 'percentual', percentual: 3.8 },
    credito_7x: { tipo: 'percentual', percentual: 4.0 },
    credito_8x: { tipo: 'percentual', percentual: 4.2 },
    credito_9x: { tipo: 'percentual', percentual: 4.4 },
    credito_10x: { tipo: 'percentual', percentual: 4.6 },
    credito_11x: { tipo: 'percentual', percentual: 4.8 },
    credito_12x: { tipo: 'percentual', percentual: 5.0 },
    dinheiro: { tipo: 'fixo', valor_centavos: 0 },
    transferencia: { tipo: 'fixo', valor_centavos: 0 },
  };
}

/** Calcula taxa em reais sobre valor bruto */
export function calcularTaxaPagamento(
  valorBruto: number,
  metodoId: MetodoPagamentoId | null,
  config: ConfigPagamentoMetodos,
): number {
  if (!metodoId || valorBruto <= 0) return 0;
  const metodo = config[metodoId];
  if (!metodo) return 0;
  if (metodo.tipo === 'fixo') return metodo.valor_centavos / 100;
  return (valorBruto * metodo.percentual) / 100;
}

export type ResultadoRepasse = {
  valorBruto: number;
  taxaPagamento: number;
  valorLiquido: number;
  percentualProfissional: number;
  valorProfissional: number;
  valorSalao: number;
};

/**
 * Regra: valor bruto → desconta taxa (se repasse ativo) → % profissional sobre o restante.
 * Ex.: R$100, taxa 3,6% = R$96,40 líquido; profissional 50% = R$48,20; salão = R$48,20.
 */
export function calcularRepasseProfissional(
  valorBruto: number,
  taxaPagamento: number,
  percentualProfissional: number,
  repassarCusto: boolean,
): ResultadoRepasse {
  const bruto = Math.max(0, valorBruto);
  const taxa = repassarCusto ? Math.max(0, taxaPagamento) : 0;
  const liquido = Math.max(0, bruto - taxa);
  const pct = Math.min(100, Math.max(0, percentualProfissional));
  const valorProfissional = (liquido * pct) / 100;
  const valorSalao = liquido - valorProfissional;
  return {
    valorBruto: bruto,
    taxaPagamento: taxa,
    valorLiquido: liquido,
    percentualProfissional: pct,
    valorProfissional,
    valorSalao,
  };
}
