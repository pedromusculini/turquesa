import { supabaseAdmin } from '@/lib/supabaseClient';
import type { CategoriaSaida } from '@/lib/configCategoriasSaida';
import { sortCategoriasByUsage } from '@/lib/categoriasSaidaOrder';

/** Conta saídas por categoria (id) no financeiro do titular. */
export async function fetchCategoriaSaidaUsageCounts(
  ownerEmail: string,
): Promise<Record<string, number>> {
  const email = ownerEmail.toLowerCase().trim();
  const { data, error } = await supabaseAdmin
    .from('financeiro_transacoes')
    .select('categoria')
    .eq('owner_email', email)
    .eq('tipo', 'saida');

  if (error) {
    console.error('[categoriasSaidaUsage] count:', error);
    return {};
  }

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const id = (row.categoria as string | null)?.trim();
    if (!id) continue;
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}

export async function loadCategoriasSaidaForOwner(
  ownerEmail: string,
  stored: unknown,
  sanitize: (raw: unknown) => CategoriaSaida[],
  sortByUsage: boolean,
): Promise<{
  categorias: CategoriaSaida[];
  usageById: Record<string, number>;
}> {
  const categorias = sanitize(stored);
  const usageById = await fetchCategoriaSaidaUsageCounts(ownerEmail);
  const ordered = sortByUsage
    ? sortCategoriasByUsage(categorias, usageById)
    : categorias;
  return { categorias: ordered, usageById };
}
