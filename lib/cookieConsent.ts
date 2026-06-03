/** Versão do aviso — incremente ao alterar cookies ou texto legal material. */
export const COOKIE_CONSENT_VERSION = '2026-06-03';

export const COOKIE_CONSENT_STORAGE_KEY = 'medsupapp-cookie-consent';

export type StoredCookieConsent = {
  version: string;
  acceptedAt: string;
};

export function readCookieConsent(): StoredCookieConsent | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredCookieConsent;
    if (!parsed?.version || !parsed?.acceptedAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function hasValidCookieConsent(): boolean {
  const stored = readCookieConsent();
  return stored?.version === COOKIE_CONSENT_VERSION;
}

export function saveCookieConsent(): void {
  if (typeof window === 'undefined') return;
  const payload: StoredCookieConsent = {
    version: COOKIE_CONSENT_VERSION,
    acceptedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(payload));
}

export function clearCookieConsent(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(COOKIE_CONSENT_STORAGE_KEY);
}
