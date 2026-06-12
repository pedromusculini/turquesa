/**
 * Cache client-side das transações financeiras (/api/financeiro).
 * Stale-while-revalidate: exibe cache imediatamente e atualiza em background.
 */

import {
  FINANCEIRO_CACHE_TTL_MS,
  STORAGE_KEY_FINANCEIRO,
} from '@/lib/constants';

export type FinanceiroTransacao = {
  id: string;
  tipo: 'entrada' | 'saida';
  descricao: string;
  data: string;
  valor: number;
  categoria: string | null;
  medico: string | null;
  observacao: string | null;
  created_at: string;
  splits: unknown[];
  valor_bruto?: number | null;
  taxa_pagamento?: number | null;
  valor_liquido?: number | null;
  percentual_profissional?: number | null;
  valor_profissional?: number | null;
  valor_salao?: number | null;
  forma_pagamento?: string | null;
  catalogo_itens?: unknown;
};

export type FinanceiroCacheFilters = {
  start?: string;
  end?: string;
  type?: 'todas' | 'entrada' | 'saida';
  medicos?: string[];
};

type CacheEnvelope = {
  transacoes: FinanceiroTransacao[];
  fetchedAt: number;
};

const inflightByKey = new Map<string, Promise<FinanceiroTransacao[]>>();

function ownerKey(ownerEmail: string): string {
  return ownerEmail.trim().toLowerCase();
}

function filtersKey(filters: FinanceiroCacheFilters): string {
  const type = filters.type ?? 'todas';
  const medicos = [...(filters.medicos ?? [])].sort().join(',');
  return `${filters.start ?? ''}|${filters.end ?? ''}|${type}|${medicos}`;
}

function storageKey(ownerEmail: string, filters: FinanceiroCacheFilters): string {
  return `${STORAGE_KEY_FINANCEIRO}:${ownerKey(ownerEmail)}:${filtersKey(filters)}`;
}

function readEnvelope(
  ownerEmail: string,
  filters: FinanceiroCacheFilters,
): CacheEnvelope | null {
  if (typeof window === 'undefined' || !ownerEmail) return null;
  try {
    const raw = window.localStorage.getItem(storageKey(ownerEmail, filters));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope;
    if (!Array.isArray(parsed.transacoes)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function isFresh(fetchedAt: number): boolean {
  return Date.now() - fetchedAt < FINANCEIRO_CACHE_TTL_MS;
}

function buildApiParams(filters: FinanceiroCacheFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.start) params.set('start', filters.start);
  if (filters.end) params.set('end', filters.end);
  if (filters.type && filters.type !== 'todas') params.set('type', filters.type);
  if (filters.medicos?.length) params.set('medicos', filters.medicos.join(','));
  return params;
}

export function readFinanceiroCache(
  ownerEmail: string,
  filters: FinanceiroCacheFilters,
): FinanceiroTransacao[] | null {
  return readEnvelope(ownerEmail, filters)?.transacoes ?? null;
}

export function writeFinanceiroCache(
  ownerEmail: string,
  filters: FinanceiroCacheFilters,
  transacoes: FinanceiroTransacao[],
): void {
  if (typeof window === 'undefined' || !ownerEmail) return;
  const envelope: CacheEnvelope = { transacoes, fetchedAt: Date.now() };
  try {
    window.localStorage.setItem(
      storageKey(ownerEmail, filters),
      JSON.stringify(envelope),
    );
  } catch {
    /* quota exceeded — ignora */
  }
}

export function invalidateFinanceiroCache(ownerEmail?: string): void {
  inflightByKey.clear();
  if (typeof window === 'undefined') return;

  const prefix = ownerEmail
    ? `${STORAGE_KEY_FINANCEIRO}:${ownerKey(ownerEmail)}:`
    : `${STORAGE_KEY_FINANCEIRO}:`;

  for (let i = window.localStorage.length - 1; i >= 0; i--) {
    const key = window.localStorage.key(i);
    if (key?.startsWith(prefix)) window.localStorage.removeItem(key);
  }
}

export async function revalidateFinanceiroCache(
  ownerEmail: string,
  filters: FinanceiroCacheFilters,
  options?: { force?: boolean },
): Promise<FinanceiroTransacao[]> {
  if (!ownerEmail) return [];

  const cacheKey = `${ownerKey(ownerEmail)}:${filtersKey(filters)}`;
  const envelope = readEnvelope(ownerEmail, filters);
  const stale = envelope?.transacoes ?? [];

  if (!options?.force && envelope && isFresh(envelope.fetchedAt)) {
    return envelope.transacoes;
  }

  const existingInflight = inflightByKey.get(cacheKey);
  if (!options?.force && existingInflight) {
    return existingInflight;
  }

  const params = buildApiParams(filters);
  const promise = fetch(`/api/financeiro?${params.toString()}`)
    .then(async (res) => {
      const data = (await res.json()) as FinanceiroTransacao[] | { error?: string };
      if (!res.ok || !Array.isArray(data)) {
        const errMsg =
          !Array.isArray(data) && data.error
            ? data.error
            : 'Erro ao carregar transações';
        throw new Error(errMsg);
      }
      writeFinanceiroCache(ownerEmail, filters, data);
      return data;
    })
    .catch((err: unknown) => {
      if (stale.length > 0) return stale;
      throw err instanceof Error ? err : new Error('Erro ao carregar transações');
    })
    .finally(() => {
      inflightByKey.delete(cacheKey);
    });

  inflightByKey.set(cacheKey, promise);
  return promise;
}
