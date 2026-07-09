import type { CategoriaSaida } from '@/lib/configCategoriasSaida';

const store = new Map<string, CategoriaSaida[]>();

export function devCategoriasSaidaGet(email: string): CategoriaSaida[] | null {
  return store.get(email.toLowerCase().trim()) ?? null;
}

export function devCategoriasSaidaSet(
  email: string,
  categorias: CategoriaSaida[],
): void {
  store.set(email.toLowerCase().trim(), categorias);
}
