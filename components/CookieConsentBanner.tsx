'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  COOKIE_CONSENT_VERSION,
  hasValidCookieConsent,
  saveCookieConsent,
} from '@/lib/cookieConsent';

/**
 * Aviso de cookies essenciais (LGPD / transparência ANPD).
 * Não carrega scripts de marketing — só registra ciência do usuário.
 */
export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setVisible(!hasValidCookieConsent());
  }, []);

  if (!mounted || !visible) return null;

  function accept() {
    saveCookieConsent();
    setVisible(false);
  }

  return (
    <div
      role="dialog"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-desc"
      className="fixed bottom-0 left-0 right-0 z-[100] p-4 md:p-6 pointer-events-none"
    >
      <div className="mx-auto max-w-4xl pointer-events-auto rounded-2xl border border-gray-200 bg-white shadow-lg shadow-gray-900/10 px-4 py-4 md:px-6 md:py-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 text-sm text-gray-700 leading-relaxed">
            <p id="cookie-consent-title" className="font-semibold text-gray-900">
              Cookies e armazenamento local
            </p>
            <p id="cookie-consent-desc" className="mt-2">
              Usamos cookies <strong>essenciais</strong> para manter sua sessão segura (login
              Google) e, se você autorizar, conectar Calendar, Drive e Contatos. Também
              guardamos sua preferência neste aviso no navegador (
              <code className="text-xs bg-gray-100 px-1 rounded">localStorage</code>
              ). <strong>Não</strong> usamos cookies de publicidade ou rastreamento de
              marketing. Saiba mais na{' '}
              <Link
                href="/privacidade#cookies"
                className="text-[#228B22] font-medium hover:underline"
              >
                Política de Privacidade
              </Link>
              .
            </p>
            <p className="mt-2 text-xs text-gray-500">Versão do aviso: {COOKIE_CONSENT_VERSION}</p>
          </div>
          <div className="flex shrink-0 flex-col sm:flex-row gap-2 md:pt-0.5">
            <Link
              href="/privacidade#cookies"
              className="inline-flex items-center justify-center rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              Detalhes
            </Link>
            <button
              type="button"
              onClick={accept}
              className="inline-flex items-center justify-center rounded-xl bg-[#013a01] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#025201] transition"
            >
              Entendi e continuar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
