import { META_PIXEL_ID_DEFAULT } from '@/lib/metaIds';

/** Meta Pixel (Facebook) — métricas de anúncios; carregar só após consentimento (LGPD). */
export const META_PIXEL_ID =
  process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() || META_PIXEL_ID_DEFAULT;

export function isMetaPixelConfigured(): boolean {
  return META_PIXEL_ID.length > 0;
}

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

export function trackMetaEvent(
  event: string,
  params?: Record<string, unknown>,
  eventID?: string,
): void {
  if (typeof window === 'undefined' || !isMetaPixelConfigured()) return;
  if (!window.fbq) return;
  const payload = params ?? {};
  if (eventID) {
    window.fbq('track', event, payload, { eventID });
    return;
  }
  if (params) {
    window.fbq('track', event, params);
    return;
  }
  window.fbq('track', event);
}

const FBCLID_STORAGE_KEY = 'turquesa_fbclid';
const FBC_MAX_AGE_SECONDS = 90 * 24 * 60 * 60;

/** Guarda o fbclid da URL só na sessão do navegador (nada é enviado antes do consentimento). */
export function captureMetaClickId(): void {
  if (typeof window === 'undefined') return;
  try {
    const fbclid = new URLSearchParams(window.location.search).get('fbclid')?.trim();
    if (fbclid && /^[\w.-]+$/.test(fbclid)) {
      window.sessionStorage.setItem(FBCLID_STORAGE_KEY, fbclid);
    }
  } catch {
    /* sessionStorage indisponível */
  }
}

/**
 * Após consentimento, grava `_fbc` com o fbclid capturado — o Pixel só cria o cookie
 * se o fbclid ainda estiver na URL no momento em que carrega.
 */
export function persistMetaFbcCookie(): void {
  if (typeof document === 'undefined') return;
  let fbclid: string | null = null;
  try {
    fbclid = window.sessionStorage.getItem(FBCLID_STORAGE_KEY);
  } catch {
    return;
  }
  if (!fbclid) return;

  const current = document.cookie
    .split('; ')
    .find((c) => c.startsWith('_fbc='))
    ?.slice('_fbc='.length);
  if (current?.endsWith(`.${fbclid}`)) return;

  const value = `fb.1.${Date.now()}.${fbclid}`;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `_fbc=${value}; Max-Age=${FBC_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
}

export function trackMetaPageView(): void {
  trackMetaEvent('PageView');
}

/**
 * Clique no CTA da landing — evento custom, não `Lead`.
 * `Lead` é só server-side (CAPI) no primeiro login Google, com event_id próprio.
 */
export function trackMetaCtaClick(source: string): void {
  if (typeof window === 'undefined' || !isMetaPixelConfigured()) return;
  if (!window.fbq) return;
  window.fbq('trackCustom', 'CtaCadastroClick', { content_name: source });
}

/**
 * Titular concluiu o primeiro onboarding. Exige o event_id do servidor (dedup com CAPI);
 * sem ele (re-save do perfil) não dispara, para não contar conversão duplicada.
 */
export function trackMetaCompleteRegistration(eventID: string): void {
  trackMetaEvent('CompleteRegistration', { content_name: 'onboarding_titular' }, eventID);
}
