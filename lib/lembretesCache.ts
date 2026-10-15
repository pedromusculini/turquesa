/**
 * Última lista de lembretes WhatsApp no aparelho: o cartão abre na hora e
 * atualiza em segundo plano. Vale só no mesmo dia (a lista é relativa a hoje).
 */

import { STORAGE_KEY_LEMBRETES } from '@/lib/constants';

type CacheEnvelope<T> = { dia: string; data: T };

function hojeBr(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function storageKey(ownerEmail: string): string {
  return `${STORAGE_KEY_LEMBRETES}:${ownerEmail.trim().toLowerCase()}`;
}

export function readLembretesCache<T>(ownerEmail: string): T | null {
  if (typeof window === 'undefined' || !ownerEmail) return null;
  try {
    const raw = window.localStorage.getItem(storageKey(ownerEmail));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    return parsed.dia === hojeBr() ? parsed.data : null;
  } catch {
    return null;
  }
}

export function writeLembretesCache<T>(ownerEmail: string, data: T): void {
  if (typeof window === 'undefined' || !ownerEmail) return;
  try {
    const envelope: CacheEnvelope<T> = { dia: hojeBr(), data };
    window.localStorage.setItem(storageKey(ownerEmail), JSON.stringify(envelope));
  } catch {
    /* quota exceeded — ignora */
  }
}
