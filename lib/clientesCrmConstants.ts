/** Janela padrão do gráfico quando o período selecionado é curto. */
export const CRM_HISTORICO_MESES = 6;
/** Meses retornados na API para o seletor de períodos (ano anterior + comparação). */
export const CRM_HISTORICO_MESES_MAX = 36;
export const CRM_DIAS_SEM_RETORNO = 60;
export const CRM_SEM_RETORNO_PAGE_SIZE = 20;
export const CRM_SEM_RETORNO_PAGE_SIZE_MAX = 50;

export type SemRetornoSort = 'desc' | 'asc';

export type ClienteSemRetorno = {
  id: string;
  nome: string;
  telefone: string | null;
  ultimo_atendimento: string;
  dias_sem_retorno: number;
};
