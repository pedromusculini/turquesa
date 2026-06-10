import type { ClienteAtendimento } from '@/lib/types';
import { calcularValorComDesconto } from '@/lib/consultations';

export const FORMAS_PAGAMENTO_ATENDIMENTO = [
  { id: 'pix', label: 'PIX' },
  { id: 'dinheiro', label: 'Dinheiro' },
  { id: 'cartao_credito', label: 'Cartão de crédito' },
  { id: 'cartao_debito', label: 'Cartão de débito' },
  { id: 'permuta', label: 'Permuta' },
] as const;

export type FormaPagamentoAtendimento = (typeof FORMAS_PAGAMENTO_ATENDIMENTO)[number]['id'];

/** @deprecated Retorno removido — sempre sessão (consulta). Mantido para dados legados. */
export function classificarTipoAtendimento(
  _atendimentos: ClienteAtendimento[],
  _dataRef: string,
  _tipoForcado?: string | null,
): 'consulta' | 'retorno' {
  return 'consulta';
}

export function calcularValorAtendimento(
  valorBase: number,
  descontoPercent: number,
  descontoValor: number,
): number {
  return calcularValorComDesconto(valorBase, descontoPercent, descontoValor);
}
