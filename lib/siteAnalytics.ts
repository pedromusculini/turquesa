/** GA4 + Microsoft Clarity — só após consentimento (mesmo banner do Meta Pixel). */

export const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || '';

export const CLARITY_PROJECT_ID =
  process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID?.trim() || '';

export function isGa4Configured(): boolean {
  return /^G-[A-Z0-9]+$/i.test(GA_MEASUREMENT_ID);
}

export function isClarityConfigured(): boolean {
  return CLARITY_PROJECT_ID.length > 0;
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    clarity?: (...args: unknown[]) => void;
  }
}

export function trackGa4Event(
  event: string,
  params?: Record<string, unknown>,
): void {
  if (typeof window === 'undefined' || !isGa4Configured()) return;
  if (!window.gtag) return;
  if (params) {
    window.gtag('event', event, params);
  } else {
    window.gtag('event', event);
  }
}

export function trackGa4PageView(path: string): void {
  if (typeof window === 'undefined' || !isGa4Configured()) return;
  if (!window.gtag) return;
  window.gtag('event', 'page_view', {
    page_path: path,
  });
}
