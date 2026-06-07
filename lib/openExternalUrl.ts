/**
 * Abre URL externa de forma compatível com Safari iOS.
 * window.open após await é bloqueado — pré-abra a aba na gestura do usuário.
 */
export function preOpenExternalTab(): Window | null {
  if (typeof window === 'undefined') return null;
  if (isMobileDevice()) return null;
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

/** Detecta navegador mobile (touch / UA) — popups após await quebram deep links. */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const narrow = window.matchMedia('(max-width: 768px)').matches;
  const mobileUa = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );
  return mobileUa || (coarse && narrow);
}

/**
 * Abre link WhatsApp: no mobile usa deep link direto (intent/whatsapp://);
 * no desktop usa aba pré-aberta ou nova aba com api.whatsapp.com.
 */
export function openWhatsAppUrl(
  webUrl: string,
  options?: {
    appUrl?: string;
    androidUrl?: string;
    preOpened?: Window | null;
  },
): void {
  if (typeof window === 'undefined') return;

  if (isMobileDevice()) {
    // Mesma aba: popups após fetch quebram deep link no Safari/Chrome mobile.
    // Android: intent → WhatsApp Business; fallback whatsapp:// (evita api.whatsapp.com → download).
    const isAndroid = /Android/i.test(navigator.userAgent);
    const target = isAndroid
      ? options?.androidUrl || options?.appUrl || webUrl
      : options?.appUrl || webUrl;
    window.location.assign(target);
    return;
  }

  if (options?.preOpened) {
    navigatePreOpened(options.preOpened, webUrl);
    return;
  }

  window.open(webUrl, '_blank', 'noopener,noreferrer');
}
