import type { ConfigPagamentoMetodos } from '@/lib/configPagamento';

/** Cache em memória para dev bypass quando Supabase não está disponível. */
const store = new Map<
  string,
  { config: ConfigPagamentoMetodos; repassar: boolean }
>();

export function devConfigPagamentoGet(email: string) {
  return store.get(email.toLowerCase().trim());
}

export function devConfigPagamentoSet(
  email: string,
  config: ConfigPagamentoMetodos,
  repassar: boolean,
) {
  store.set(email.toLowerCase().trim(), { config, repassar });
}
