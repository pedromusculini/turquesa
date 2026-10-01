/**
 * Navegadores embutidos (Instagram, Facebook, TikTok…). O Google bloqueia OAuth
 * nesses WebViews (erro 403 disallowed_useragent), então o login precisa abrir
 * no navegador do sistema.
 */

export type InAppBrowserInfo = {
  inApp: boolean;
  app: 'instagram' | 'facebook' | 'tiktok' | 'outro' | null;
  os: 'android' | 'ios' | 'outro';
};

export function detectInAppBrowser(ua: string): InAppBrowserInfo {
  const os = /android/i.test(ua) ? 'android' : /iphone|ipad|ipod/i.test(ua) ? 'ios' : 'outro';
  if (/Instagram/i.test(ua)) return { inApp: true, app: 'instagram', os };
  if (/FBAN|FBAV|FB_IAB|FBIOS|FB4A|Messenger/i.test(ua)) return { inApp: true, app: 'facebook', os };
  if (/TikTok|musical_ly|BytedanceWebview/i.test(ua)) return { inApp: true, app: 'tiktok', os };
  if (/Line\/|Snapchat|LinkedInApp|Twitter/i.test(ua)) return { inApp: true, app: 'outro', os };
  if (os === 'android' && /; wv\)/.test(ua)) return { inApp: true, app: 'outro', os };
  return { inApp: false, app: null, os };
}

/** Android: abre a mesma URL no Chrome; se não houver Chrome, cai no navegador padrão. */
export function androidChromeIntentUrl(href: string): string {
  const url = new URL(href);
  return `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(href)};end`;
}
