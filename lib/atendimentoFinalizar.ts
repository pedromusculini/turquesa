import type { ClienteAtendimento } from '@/lib/types';
import { calcularValorComDesconto } from '@/lib/consultations';

export const DIAS_RETORNO_ATENDIMENTO = 30;

export const FORMAS_PAGAMENTO_ATENDIMENTO = [
  { id: 'pix', label: 'PIX' },
  { id: 'cartao_credito', label: 'Cartão de crédito' },
  { id: 'cartao_debito', label: 'Cartão de débito' },
  { id: 'dinheiro', label: 'Dinheiro' },
  { id: 'permuta', label: 'Permuta' },
] as const;

export type FormaPagamentoAtendimento = (typeof FORMAS_PAGAMENTO_ATENDIMENTO)[number]['id'];

export function classificarTipoAtendimento(
  atendimentos: ClienteAtendimento[],
  dataRef: string,
  tipoForcado?: string | null,
): 'consulta' | 'retorno' {
  if (tipoForcado === 'retorno' || tipoForcado === 'consulta') {
    return tipoForcado;
  }

  const ref = new Date(dataRef);
  const limite = new Date(ref);
  limite.setDate(limite.getDate() - DIAS_RETORNO_ATENDIMENTO);

  const ultimo = atendimentos
    .filter((a) => a.status === 'realizado')
    .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())[0];

  if (!ultimo) return 'consulta';

  const dataUltimo = new Date(ultimo.data);
  return dataUltimo >= limite ? 'retorno' : 'consulta';
}

export function calcularValorAtendimento(
  valorBase: number,
  descontoPercent: number,
  descontoValor: number,
): number {
  return calcularValorComDesconto(valorBase, descontoPercent, descontoValor);
}
