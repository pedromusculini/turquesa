/**
 * Cache client-side da lista completa de clientes (/api/clientes?all=1).
 * Stale-while-revalidate: exibe cache imediatamente e atualiza em background.
 */

import {
  CLIENTES_LIST_CACHE_TTL_MS,
  STORAGE_KEY_CLIENTES_LIST,
} from '@/lib/constants';

export type ClienteListItem = {
  id: string;
  nome: string;
  telefone?: string | null;
  email?: string | null;
  cpf?: string | null;
  data_nascimento?: string | null;
  convenio?: string | null;
};

type CacheEnvelope = {
  clientes: ClienteListItem[];
  fetchedAt: number;
};

const inflightByOwner = new Map<string, Promise<ClienteListItem[]>>();

function storageKey(ownerEmail: string): string {
  return `${STORAGE_KEY_CLIENTES_LIST}:${ownerEmail.trim().toLowerCase()}`;
}

function readEnvelope(ownerEmail: string): CacheEnvelope | null {
  if (typeof window === 'undefined' || !ownerEmail) return null;
  try {
    const raw = window.localStorage.getItem(storageKey(ownerEmail));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope;
    if (!Array.isArray(parsed.clientes)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function isFresh(fetchedAt: number): boolean {
  return Date.now() - fetchedAt < CLIENTES_LIST_CACHE_TTL_MS;
}

export function readClientesListCache(ownerEmail: string): ClienteListItem[] | null {
  return readEnvelope(ownerEmail)?.clientes ?? null;
}

export function writeClientesListCache(
  ownerEmail: string,
  clientes: ClienteListItem[],
): void {
  if (typeof window === 'undefined' || !ownerEmail) return;
  const envelope: CacheEnvelope = { clientes, fetchedAt: Date.now() };
  try {
    window.localStorage.setItem(storageKey(ownerEmail), JSON.stringify(envelope));
  } catch {
    /* quota exceeded — ignora */
  }
}

export function invalidateClientesListCache(ownerEmail?: string): void {
  inflightByOwner.clear();
  if (typeof window === 'undefined') return;

  if (ownerEmail) {
    window.localStorage.removeItem(storageKey(ownerEmail));
    return;
  }

  const prefix = `${STORAGE_KEY_CLIENTES_LIST}:`;
  for (let i = window.localStorage.length - 1; i >= 0; i--) {
    const key = window.localStorage.key(i);
    if (key?.startsWith(prefix)) window.localStorage.removeItem(key);
  }
}

export async function fetchClientesListAll(
  ownerEmail: string,
  options?: { force?: boolean },
): Promise<ClienteListItem[]> {
  if (!ownerEmail) return [];

  const envelope = readEnvelope(ownerEmail);
  const stale = envelope?.clientes ?? [];

  if (!options?.force && envelope && isFresh(envelope.fetchedAt)) {
    return envelope.clientes;
  }

  const existingInflight = inflightByOwner.get(ownerEmail);
  if (!options?.force && existingInflight) {
    return existingInflight;
  }

  const promise = fetch('/api/clientes?all=1')
    .then(async (res) => {
      const data = (await res.json()) as { clientes?: ClienteListItem[] };
      if (!res.ok || !Array.isArray(data.clientes)) {
        return stale;
      }
      writeClientesListCache(ownerEmail, data.clientes);
      return data.clientes;
    })
    .catch(() => stale)
    .finally(() => {
      inflightByOwner.delete(ownerEmail);
    });

  inflightByOwner.set(ownerEmail, promise);
  return promise;
}
