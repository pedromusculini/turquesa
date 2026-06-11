import { supabaseAdmin } from '@/lib/supabaseClient';

const PAGE_SIZE = 1000;

export type FinanceiroListFilters = {
  start?: string | null;
  end?: string | null;
  type?: 'entrada' | 'saida' | null;
  medicos?: string[] | null;
};

function applyFinanceiroFilters(
  email: string,
  filters: FinanceiroListFilters,
) {
  let query = supabaseAdmin
    .from('financeiro_transacoes')
    .select('*')
    .eq('owner_email', email)
    .order('data', { ascending: false });

  if (filters.start) query = query.gte('data', filters.start);
  if (filters.end) query = query.lte('data', filters.end);
  if (filters.type) query = query.eq('tipo', filters.type);
  if (filters.medicos?.length) query = query.in('medico', filters.medicos);

  return query;
}

/** PostgREST limita 1000 linhas por request — pagina até carregar tudo. */
export async function listFinanceiroTransacoes(
  email: string,
  filters: FinanceiroListFilters = {},
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await applyFinanceiroFilters(email, filters).range(
      from,
      from + PAGE_SIZE - 1,
    );
    if (error) throw error;
    const chunk = (data ?? []) as Record<string, unknown>[];
    rows.push(...chunk);
    if (chunk.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}

/** Splits em lotes (`.in()` também tem limite prático). */
export async function listSplitsForTransacoes(
  transacaoIds: string[],
): Promise<Record<string, unknown>[]> {
  if (transacaoIds.length === 0) return [];

  const BATCH = 500;
  const all: Record<string, unknown>[] = [];

  for (let i = 0; i < transacaoIds.length; i += BATCH) {
    const batch = transacaoIds.slice(i, i + BATCH);
    const { data, error } = await supabaseAdmin
      .from('financeiro_splits')
      .select('*')
      .in('transacao_id', batch);
    if (error) throw error;
    all.push(...((data ?? []) as Record<string, unknown>[]));
  }

  return all;
}
