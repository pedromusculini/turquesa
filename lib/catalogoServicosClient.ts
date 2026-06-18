/**
 * Cache client-side compartilhado para /api/catalogo/servicos.
 * Evita refetch em cada mount de AtendimentoItensEditor na mesma sessão.
 */

import {
  type CatalogoItemResumo,
  normalizeCatalogoApiRow,
} from '@/lib/atendimentoItens';

export const CATALOGO_SERVICOS_CLIENT_TTL_MS = 5 * 60 * 1000;

let inflight: Promise<CatalogoItemResumo[]> | null = null;
let cached: { items: CatalogoItemResumo[]; at: number } | null = null;

function parseCatalogoRows(rows: Record<string, unknown>[]): CatalogoItemResumo[] {
  return rows
    .map(normalizeCatalogoApiRow)
    .filter((c): c is CatalogoItemResumo => !!c && c.ativo !== false);
}

export function readCatalogoServicosClientCache(): CatalogoItemResumo[] | null {
  if (!cached) return null;
  if (Date.now() - cached.at >= CATALOGO_SERVICOS_CLIENT_TTL_MS) return null;
  return cached.items;
}

export function invalidateCatalogoServicosClientCache(): void {
  inflight = null;
  cached = null;
}

export async function fetchCatalogoServicos(options?: {
  force?: boolean;
}): Promise<CatalogoItemResumo[]> {
  const now = Date.now();
  const stale = cached?.items ?? [];

  if (
    !options?.force &&
    cached &&
    now - cached.at < CATALOGO_SERVICOS_CLIENT_TTL_MS
  ) {
    return cached.items;
  }

  if (!options?.force && inflight) {
    return inflight;
  }

  const promise = fetch('/api/catalogo/servicos')
    .then(async (res) => {
      const data = (await res.json()) as {
        servicos?: Record<string, unknown>[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao carregar catálogo');
      }
      const items = parseCatalogoRows(data.servicos ?? []);
      cached = { items, at: Date.now() };
      return items;
    })
    .catch(() => stale)
    .finally(() => {
      inflight = null;
    });

  inflight = promise;
  return promise;
}
