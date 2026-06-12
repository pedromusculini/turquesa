/**
 * Cache em memória do clientes.json (Google Drive) por dono da conta.
 * Reduz leituras repetidas ao Drive em GET /api/clientes e rotas relacionadas.
 */

import type { ClientesDriveStore } from '@/lib/clientesDrive';

/** TTL do cache server-side (minutos). */
export const CLIENTES_DRIVE_CACHE_TTL_MS = 4 * 60 * 1000;

type CacheEntry = {
  store: ClientesDriveStore;
  fetchedAt: number;
};

const cache = new Map<string, CacheEntry>();

function cacheKey(ownerEmail: string): string {
  return ownerEmail.trim().toLowerCase();
}

export function getClientesDriveCache(ownerEmail: string): ClientesDriveStore | null {
  const key = cacheKey(ownerEmail);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt >= CLIENTES_DRIVE_CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.store;
}

export function setClientesDriveCache(
  ownerEmail: string,
  store: ClientesDriveStore,
): void {
  cache.set(cacheKey(ownerEmail), { store, fetchedAt: Date.now() });
}

export function invalidateClientesDriveCache(ownerEmail: string): void {
  cache.delete(cacheKey(ownerEmail));
}
