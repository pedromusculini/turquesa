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

export function trackMetaPageView(): void {
  trackMetaEvent('PageView');
}

/** Intenção de cadastro (CTA landing ou botão Google no login). */
export function trackMetaLead(source: string): void {
  trackMetaEvent('Lead', { content_name: source });
}

/** Titular concluiu onboarding / trial iniciado. */
export function trackMetaCompleteRegistration(eventID?: string): void {
  trackMetaEvent('CompleteRegistration', { content_name: 'onboarding_titular' }, eventID);
}
