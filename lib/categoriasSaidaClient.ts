import {
  defaultCategoriasSaida,
  type CategoriaSaida,
} from '@/lib/configCategoriasSaida';

const CACHE_TTL_MS = 10 * 60 * 1000;

type CacheEntry = {
  categorias: CategoriaSaida[];
  usageById: Record<string, number>;
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

export function readCategoriasSaidaUsageCache(
  ownerEmail: string,
): Record<string, number> | null {
  const key = ownerEmail.toLowerCase().trim();
  const entry = cacheByOwner.get(key);
  if (!entry || Date.now() - entry.at > CACHE_TTL_MS) return null;
  return entry.usageById;
}

export function writeCategoriasSaidaCache(
  ownerEmail: string,
  categorias: CategoriaSaida[],
  usageById: Record<string, number> = {},
): void {
  cacheByOwner.set(ownerEmail.toLowerCase().trim(), {
    categorias,
    usageById,
    at: Date.now(),
  });
}

export type CategoriasSaidaPayload = {
  categorias: CategoriaSaida[];
  usageById: Record<string, number>;
};

export async function fetchCategoriasSaida(
  ownerEmail?: string,
): Promise<CategoriasSaidaPayload> {
  const defaults = defaultCategoriasSaida();
  if (ownerEmail) {
    const cached = readCategoriasSaidaCache(ownerEmail);
    const usage = readCategoriasSaidaUsageCache(ownerEmail);
    if (cached) {
      return { categorias: cached, usageById: usage ?? {} };
    }
  }

  try {
    const res = await fetch('/api/config/categorias-saida', {
      cache: 'no-store',
    });
    if (!res.ok) {
      return { categorias: defaults, usageById: {} };
    }
    const data = (await res.json()) as {
      categorias?: CategoriaSaida[];
      usageById?: Record<string, number>;
    };
    const categorias =
      Array.isArray(data.categorias) && data.categorias.length > 0
        ? data.categorias
        : defaults;
    const usageById =
      data.usageById && typeof data.usageById === 'object' ? data.usageById : {};
    if (ownerEmail) writeCategoriasSaidaCache(ownerEmail, categorias, usageById);
    return { categorias, usageById };
  } catch {
    return { categorias: defaults, usageById: {} };
  }
}

export function invalidateCategoriasSaidaCache(ownerEmail?: string): void {
  if (!ownerEmail) {
    cacheByOwner.clear();
    return;
  }
  cacheByOwner.delete(ownerEmail.toLowerCase().trim());
}
