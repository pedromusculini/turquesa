'use client';

import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import {
  COOKIE_CONSENT_STORAGE_KEY,
  hasValidCookieConsent,
} from '@/lib/cookieConsent';
import { isMetaPixelConfigured, META_PIXEL_ID, trackMetaPageView } from '@/lib/metaPixel';

function MetaPixelRouteViews() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const skipInitial = useRef(true);

  useEffect(() => {
    if (skipInitial.current) {
      skipInitial.current = false;
      return;
    }
    trackMetaPageView();
  }, [pathname, searchParams]);

  return null;
}

/**
 * Meta Pixel — só inicializa após consentimento no banner de cookies (LGPD).
 */
export default function MetaPixel() {
  const [consented, setConsented] = useState(false);

  useEffect(() => {
    if (!isMetaPixelConfigured()) return;

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
  }, []);

  if (!isMetaPixelConfigured() || !consented) return null;

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${META_PIXEL_ID}');
          fbq('track', 'PageView');
        `}
      </Script>
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: 'none' }}
          alt=""
          src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
        />
      </noscript>
      <Suspense fallback={null}>
        <MetaPixelRouteViews />
      </Suspense>
    </>
  );
}
