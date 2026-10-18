/** Flag de primeiro uso no aparelho (sobrevive ao OAuth do Google). */
const KEY = 'turquesa:primeiro-uso';

export function markPrimeiroUsoPendente(): void {
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {
    /* ignore quota / private mode */
  }
}

export function isPrimeiroUsoPendente(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function clearPrimeiroUsoPendente(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
