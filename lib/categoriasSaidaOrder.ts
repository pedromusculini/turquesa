import type { CategoriaSaida } from '@/lib/configCategoriasSaida';

/** Ordena categorias: mais usadas primeiro; empate mantém ordem salva. */
export function sortCategoriasByUsage(
  categorias: CategoriaSaida[],
  usageById: Record<string, number>,
): CategoriaSaida[] {
  return categorias
    .map((c, index) => ({
      c,
      index,
      count: usageById[c.id] ?? 0,
    }))
    .sort((a, b) => b.count - a.count || a.index - b.index)
    .map((x) => x.c);
}

export function moveCategoria(
  categorias: CategoriaSaida[],
  fromIndex: number,
  toIndex: number,
): CategoriaSaida[] {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= categorias.length ||
    toIndex >= categorias.length ||
    fromIndex === toIndex
  ) {
    return categorias;
  }
  const next = [...categorias];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}
