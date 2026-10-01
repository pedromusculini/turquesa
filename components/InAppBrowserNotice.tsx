'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, Copy, Check } from 'lucide-react';
import { BRAND } from '@/lib/constants';
import { androidChromeIntentUrl, type InAppBrowserInfo } from '@/lib/inAppBrowser';

const { colors: C } = BRAND;

const APP_LABEL: Record<NonNullable<InAppBrowserInfo['app']>, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  outro: 'aplicativo',
};

export default function InAppBrowserNotice({
  info,
  onContinueAnyway,
}: {
  info: InAppBrowserInfo;
  onContinueAnyway: () => void;
}) {
  const [href, setHref] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setHref(window.location.href);
    if (window.fbq) {
      window.fbq('trackCustom', 'InAppBrowserLogin', { app: info.app, os: info.os });
    }
  }, [info.app, info.os]);

  const appName = info.app ? APP_LABEL[info.app] : 'aplicativo';
  const browserName = info.os === 'ios' ? 'Safari' : 'Chrome';

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      className="mb-6 rounded-2xl border-2 px-5 py-5 text-sm"
      style={{ borderColor: C.primaryHover, backgroundColor: C.primaryBg }}
    >
      <p className="text-base font-bold text-gray-900">
        Abra no {browserName} para entrar com Google
      </p>
      <p className="mt-2 leading-relaxed text-gray-700">
        O Google não permite login dentro do navegador do {appName}. Leva 2 segundos:
      </p>

      {info.os === 'android' && href ? (
        <a
          href={androidChromeIntentUrl(href)}
          className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 font-semibold text-white"
          style={{ backgroundColor: C.primaryHover }}
        >
          <ExternalLink className="h-4 w-4" aria-hidden />
          Abrir no Chrome
        </a>
      ) : (
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-gray-800">
          <li>
            Toque em <strong>•••</strong> no canto superior direito
          </li>
          <li>
            Escolha <strong>Abrir no navegador externo</strong>
          </li>
        </ol>
      )}

      <button
        type="button"
        onClick={copyLink}
        className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border bg-white px-4 font-medium text-gray-800"
        style={{ borderColor: `${C.primaryHover}66` }}
      >
        {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
        {copied ? 'Link copiado — cole no navegador' : 'Copiar link'}
      </button>

      <button
        type="button"
        onClick={onContinueAnyway}
        className="mt-3 w-full text-center text-xs text-gray-500 underline"
      >
        Tentar entrar aqui mesmo assim
      </button>
    </div>
  );
}
