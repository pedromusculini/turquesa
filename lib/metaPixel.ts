/** Meta Pixel (Facebook) — métricas de anúncios; carregar só após consentimento (LGPD). */
export const META_PIXEL_ID =
  process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() || '2631118973956450';

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
): void {
  if (typeof window === 'undefined' || !isMetaPixelConfigured()) return;
  if (!window.fbq) return;
  if (params) {
    window.fbq('track', event, params);
  } else {
    window.fbq('track', event);
  }
}

export function trackMetaPageView(): void {
  trackMetaEvent('PageView');
}
