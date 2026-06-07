/**
 * Abre URL externa de forma compatível com Safari iOS.
 * window.open após await é bloqueado — pré-abra a aba na gestura do usuário.
 */
export function preOpenExternalTab(): Window | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.open('', '_blank');
  } catch {
    return null;
  }
}

export function navigatePreOpened(preOpened: Window | null, url: string): void {
  if (preOpened && !preOpened.closed) {
    preOpened.location.href = url;
    return;
  }
  window.location.assign(url);
}
