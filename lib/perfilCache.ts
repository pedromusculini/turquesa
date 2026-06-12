/**
 * Cache sessionStorage dos campos básicos do perfil usados na agenda.
 */

import { PERFIL_CACHE_TTL_MS, STORAGE_KEY_PERFIL } from '@/lib/constants';

export type PerfilAgendaFields = {
  full_name?: string;
  clinic_name?: string;
  specialty?: string;
  address?: string;
  street?: string;
  address_number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  cep?: string;
};

type CacheEnvelope = {
  profile: PerfilAgendaFields;
  fetchedAt: number;
};

const inflightByOwner = new Map<string, Promise<PerfilAgendaFields | null>>();

function storageKey(ownerEmail: string): string {
  return `${STORAGE_KEY_PERFIL}:${ownerEmail.trim().toLowerCase()}`;
}

function readEnvelope(ownerEmail: string): CacheEnvelope | null {
  if (typeof window === 'undefined' || !ownerEmail) return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey(ownerEmail));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope;
    if (!parsed.profile || typeof parsed.profile !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function isFresh(fetchedAt: number): boolean {
  return Date.now() - fetchedAt < PERFIL_CACHE_TTL_MS;
}

export function readPerfilCache(ownerEmail: string): PerfilAgendaFields | null {
  const envelope = readEnvelope(ownerEmail);
  if (!envelope || !isFresh(envelope.fetchedAt)) return null;
  return envelope.profile;
}

/** Retorna perfil em cache mesmo expirado (stale-while-revalidate). */
export function readPerfilCacheStale(ownerEmail: string): PerfilAgendaFields | null {
  return readEnvelope(ownerEmail)?.profile ?? null;
}

export function writePerfilCache(
  ownerEmail: string,
  profile: PerfilAgendaFields,
): void {
  if (typeof window === 'undefined' || !ownerEmail) return;
  const envelope: CacheEnvelope = { profile, fetchedAt: Date.now() };
  try {
    window.sessionStorage.setItem(storageKey(ownerEmail), JSON.stringify(envelope));
  } catch {
    /* quota exceeded — ignora */
  }
}

export function invalidatePerfilCache(ownerEmail?: string): void {
  inflightByOwner.clear();
  if (typeof window === 'undefined') return;

  if (ownerEmail) {
    window.sessionStorage.removeItem(storageKey(ownerEmail));
    return;
  }

  const prefix = `${STORAGE_KEY_PERFIL}:`;
  for (let i = window.sessionStorage.length - 1; i >= 0; i--) {
    const key = window.sessionStorage.key(i);
    if (key?.startsWith(prefix)) window.sessionStorage.removeItem(key);
  }
}

function extractProfile(data: Record<string, unknown>): PerfilAgendaFields | null {
  const p = (data.profile ?? data) as PerfilAgendaFields;
  if (!p || typeof p !== 'object') return null;
  return p;
}

export async function fetchPerfilAgenda(
  ownerEmail: string,
  options?: { force?: boolean },
): Promise<PerfilAgendaFields | null> {
  if (!ownerEmail) return null;

  const envelope = readEnvelope(ownerEmail);
  const stale = envelope?.profile ?? null;

  if (!options?.force && envelope && isFresh(envelope.fetchedAt)) {
    return envelope.profile;
  }

  const existingInflight = inflightByOwner.get(ownerEmail);
  if (!options?.force && existingInflight) {
    return existingInflight;
  }

  const promise = fetch('/api/perfil')
    .then(async (res) => {
      if (!res.ok) return stale;
      const data = (await res.json()) as Record<string, unknown>;
      const profile = extractProfile(data);
      if (profile) writePerfilCache(ownerEmail, profile);
      return profile;
    })
    .catch(() => stale)
    .finally(() => {
      inflightByOwner.delete(ownerEmail);
    });

  inflightByOwner.set(ownerEmail, promise);
  return promise;
}
