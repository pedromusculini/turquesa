/**
 * Cache em memória dos contatos Google por dono da conta (e-mail do tenant).
 * Reduz chamadas à People API (quota "Critical read requests").
 */

import {
  fetchGoogleContacts,
  isGoogleContactsQuotaError,
  type GoogleContactImport,
} from '@/lib/googleContacts';

/** TTL do cache server-side (minutos). */
export const GOOGLE_CONTACTS_CACHE_TTL_MS = 10 * 60 * 1000;

/** Após quota 429, não tenta de novo antes deste intervalo. */
const QUOTA_BACKOFF_MS = 60 * 1000;

const QUOTA_MSG =
  'Contatos Google temporariamente indisponíveis — tente em 1 minuto';

type CacheEntry = {
  contacts: GoogleContactImport[];
  fetchedAt: number;
  quotaExceededUntil?: number;
};

const cache = new Map<string, CacheEntry>();

function cacheKey(ownerEmail: string): string {
  return ownerEmail.trim().toLowerCase();
}

export function invalidateGoogleContactsCache(ownerEmail: string): void {
  cache.delete(cacheKey(ownerEmail));
}

export type GoogleContactsCachedResult = {
  contacts: GoogleContactImport[];
  fromCache: boolean;
  quotaExceeded?: boolean;
  error?: string;
};

export async function getGoogleContactsCached(
  ownerEmail: string,
  accessToken: string,
  options?: { force?: boolean },
): Promise<GoogleContactsCachedResult> {
  const key = cacheKey(ownerEmail);
  const now = Date.now();
  const existing = cache.get(key);

  if (!options?.force && existing) {
    if (existing.quotaExceededUntil && existing.quotaExceededUntil > now) {
      return {
        contacts: existing.contacts,
        fromCache: true,
        quotaExceeded: true,
        error: QUOTA_MSG,
      };
    }
    if (now - existing.fetchedAt < GOOGLE_CONTACTS_CACHE_TTL_MS) {
      return { contacts: existing.contacts, fromCache: true };
    }
  }

  try {
    const contacts = await fetchGoogleContacts(accessToken);
    cache.set(key, { contacts, fetchedAt: now });
    return { contacts, fromCache: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isGoogleContactsQuotaError(429, message)) {
      const stale = existing?.contacts ?? [];
      cache.set(key, {
        contacts: stale,
        fetchedAt: existing?.fetchedAt ?? now,
        quotaExceededUntil: now + QUOTA_BACKOFF_MS,
      });
      return {
        contacts: stale,
        fromCache: !!existing,
        quotaExceeded: true,
        error: QUOTA_MSG,
      };
    }
    throw err;
  }
}
