/** GA4 + Microsoft Clarity — só após consentimento (mesmo banner do Meta Pixel). */

export const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || '';

export const GOOGLE_ADS_TAG_ID =
  process.env.NEXT_PUBLIC_GOOGLE_ADS_TAG_ID?.trim() || 'AW-974421375';

export const GOOGLE_ADS_CONVERSION_LABEL =
  process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL?.trim() ||
  'AW-974421375/CKrACI-ewOkcEP_60dAD';

export const CLARITY_PROJECT_ID =
  process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID?.trim() || '';

export function isGa4Configured(): boolean {
  return /^G-[A-Z0-9]+$/i.test(GA_MEASUREMENT_ID);
}

export function isGoogleAdsTagConfigured(): boolean {
  return /^AW-[0-9]+$/i.test(GOOGLE_ADS_TAG_ID);
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
  if (typeof window === 'undefined') return;
  if (!window.gtag) return;
  if (isGa4Configured()) {
    window.gtag('event', 'page_view', {
      page_path: path,
    });
  }
}

/** Dispara evento de conversão do Google Ads quando o onboarding/cadastro é concluído */
export function trackGoogleAdsSignupConversion(): void {
  if (typeof window === 'undefined') return;
  if (!window.gtag || !isGoogleAdsTagConfigured()) return;
  window.gtag('event', 'conversion', {
    send_to: GOOGLE_ADS_CONVERSION_LABEL,
  });
}
