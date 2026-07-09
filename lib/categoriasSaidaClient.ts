import {
  defaultCategoriasSaida,
  type CategoriaSaida,
} from '@/lib/configCategoriasSaida';

const CACHE_TTL_MS = 10 * 60 * 1000;

type CacheEntry = {
  categorias: CategoriaSaida[];
  at: number;
};

const cacheByOwner = new Map<string, CacheEntry>();

export function readCategoriasSaidaCache(ownerEmail: string): CategoriaSaida[] | null {
  const key = ownerEmail.toLowerCase().trim();
  const entry = cacheByOwner.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > CACHE_TTL_MS) {
    cacheByOwner.delete(key);
    return null;
  }
  return entry.categorias;
}

export function writeCategoriasSaidaCache(
  ownerEmail: string,
  categorias: CategoriaSaida[],
): void {
  cacheByOwner.set(ownerEmail.toLowerCase().trim(), {
    categorias,
    at: Date.now(),
  });
}

export function invalidateCategoriasSaidaCache(ownerEmail?: string): void {
  if (!ownerEmail) {
    cacheByOwner.clear();
    return;
  }
  cacheByOwner.delete(ownerEmail.toLowerCase().trim());
}

export async function fetchCategoriasSaida(
  ownerEmail?: string,
): Promise<CategoriaSaida[]> {
  if (ownerEmail) {
    const cached = readCategoriasSaidaCache(ownerEmail);
    if (cached) return cached;
  }

  try {
    const res = await fetch('/api/config/categorias-saida', {
      cache: 'no-store',
    });
    if (!res.ok) return defaultCategoriasSaida();
    const data = (await res.json()) as { categorias?: CategoriaSaida[] };
    const categorias =
      Array.isArray(data.categorias) && data.categorias.length > 0
        ? data.categorias
        : defaultCategoriasSaida();
    if (ownerEmail) writeCategoriasSaidaCache(ownerEmail, categorias);
    return categorias;
  } catch {
    return defaultCategoriasSaida();
  }
}
