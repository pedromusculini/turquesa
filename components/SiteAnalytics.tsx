'use client';

import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import {
  COOKIE_CONSENT_STORAGE_KEY,
  hasValidCookieConsent,
} from '@/lib/cookieConsent';
import {
  CLARITY_PROJECT_ID,
  GA_MEASUREMENT_ID,
  GOOGLE_ADS_TAG_ID,
  isClarityConfigured,
  isGa4Configured,
  isGoogleAdsTagConfigured,
  trackGa4PageView,
} from '@/lib/siteAnalytics';

function Ga4RouteViews() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const skipInitial = useRef(true);

  useEffect(() => {
    if (skipInitial.current) {
      skipInitial.current = false;
      return;
    }
    const qs = searchParams?.toString();
    trackGa4PageView(qs ? `${pathname}?${qs}` : pathname);
  }, [pathname, searchParams]);

  return null;
}

/**
 * GA4 + Clarity — só após consentimento no banner de cookies (LGPD).
 * IDs via NEXT_PUBLIC_GA_MEASUREMENT_ID e NEXT_PUBLIC_CLARITY_PROJECT_ID.
 */
export default function SiteAnalytics() {
  const [consented, setConsented] = useState(false);
  const ga = isGa4Configured();
  const googleAds = isGoogleAdsTagConfigured();
  const clarity = isClarityConfigured();
  const primaryGtagId = ga ? GA_MEASUREMENT_ID : googleAds ? GOOGLE_ADS_TAG_ID : '';

  useEffect(() => {
    if (!ga && !googleAds && !clarity) return;

    const sync = () => setConsented(hasValidCookieConsent());
    sync();

    const onConsent = () => sync();
    window.addEventListener('turquesa-cookie-consent', onConsent);

    const onStorage = (event: StorageEvent) => {
      if (event.key === COOKIE_CONSENT_STORAGE_KEY) sync();
    };
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener('turquesa-cookie-consent', onConsent);
      window.removeEventListener('storage', onStorage);
    };
  }, [ga, googleAds, clarity]);

  if ((!ga && !googleAds && !clarity) || !consented) return null;

  return (
    <>
      {primaryGtagId ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${primaryGtagId}`}
            strategy="afterInteractive"
          />
          <Script id="google-tags-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              ${ga ? `gtag('config', '${GA_MEASUREMENT_ID}', { send_page_view: true });` : ''}
              ${googleAds ? `gtag('config', '${GOOGLE_ADS_TAG_ID}');` : ''}
            `}
          </Script>
          {ga ? (
            <Suspense fallback={null}>
              <Ga4RouteViews />
            </Suspense>
          ) : null}
        </>
      ) : null}

      {clarity ? (
        <Script id="ms-clarity" strategy="afterInteractive">
          {`
            (function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "${CLARITY_PROJECT_ID}");
          `}
        </Script>
      ) : null}
    </>
  );
}
