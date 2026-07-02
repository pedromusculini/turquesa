'use client';

import { signIn, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import BrandLogoIcon from '@/components/BrandLogoIcon';
import { BRAND, DEFAULT_PLAN_ID } from '@/lib/constants';
import ChromeExtensionNotice from '@/components/ChromeExtensionNotice';

type OAuthUrisResponse = {
  redirectUris?: string[];
  baseUrl?: string;
};

const { colors: C, productName, tagline, copy } = BRAND;

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  Configuration:
    'Não foi possível iniciar o login. Tente de novo em alguns minutos ou use uma janela anônima.',
  AccessDenied: 'Acesso negado pelo Google. Tente outra conta ou aceite as permissões solicitadas.',
  OAuthSignin: 'Não foi possível abrir o login do Google. Tente de novo ou use uma janela anônima.',
  OAuthCallback:
    'Não foi possível concluir o login com o Google. Tente em uma janela anônima (Ctrl+Shift+N).',
  OAuthAccountNotLinked:
    'Esta conta Google já está vinculada a outro método de login.',
  CallbackRouteError:
    'Não foi possível concluir o login. Tente de novo ou use uma janela anônima.',
  Default: 'Não foi possível entrar. Tente novamente ou contate o suporte.',
};

/** Erros em que mostramos detalhes técnicos de URIs (só após falha real). */
const OAUTH_SETUP_ERROR_CODES = new Set([
  'Configuration',
  'OAuthSignin',
  'OAuthCallback',
  'CallbackRouteError',
]);

function LoginContent() {
  const router = useRouter();
  const { status } = useSession();
  const searchParams = useSearchParams();
  const showGoogleOnlyHint = searchParams.get('acesso') === 'google';
  const authError = searchParams.get('error');
  const authErrorMessage = authError
    ? AUTH_ERROR_MESSAGES[authError] ?? AUTH_ERROR_MESSAGES.Default
    : null;
  const showOAuthSetupHelp =
    !!authError && OAUTH_SETUP_ERROR_CODES.has(authError);
  const [oauthUris, setOauthUris] = useState<OAuthUrisResponse | null>(null);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [legalHint, setLegalHint] = useState('');

  useEffect(() => {
    if (!showOAuthSetupHelp) return;
    fetch('/api/auth/oauth-uris')
      .then((r) => r.json())
      .then(setOauthUris)
      .catch(() => setOauthUris(null));
  }, [showOAuthSetupHelp]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/auth/google-access/status', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (!data.accessVerified && !data.equipeProfissional) {
          const cb = searchParams.get('callbackUrl');
          const verify = cb
            ? `/auth/verificar-email?callbackUrl=${encodeURIComponent(cb)}`
            : '/auth/verificar-email?callbackUrl=%2Fonboarding';
          router.replace(verify);
          return;
        }
        const cb = searchParams.get('callbackUrl');
        router.replace(cb && cb.startsWith('/') ? cb : '/dashboard');
      })
      .catch(() => {});
  }, [status, router, searchParams]);

  const handleLogin = () => {
    if (!legalAccepted) {
      setLegalHint('Marque o aceite da Política de Privacidade e dos Termos de Uso antes de continuar.');
      return;
    }
    setLegalHint('');
    const callbackUrl = searchParams.get('callbackUrl');
    const plan = searchParams.get('plan') || DEFAULT_PLAN_ID;
    const afterAuth =
      callbackUrl && callbackUrl.startsWith('/')
        ? callbackUrl
        : `/onboarding?plan=${plan}&trialStarted=true`;
    signIn('google', {
      callbackUrl: `/auth/verificar-email?callbackUrl=${encodeURIComponent(afterAuth)}`,
      redirect: true,
    });
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ backgroundColor: C.bgPage }}
    >
      <div className="relative z-10 isolate max-w-md w-full bg-white rounded-3xl shadow-2xl p-10">
        <div className="text-center mb-10">
          <BrandLogoIcon size={56} className="mx-auto h-14 w-auto mb-4" priority />
          <h1 className="text-4xl font-bold text-gray-900">{productName}</h1>
          <p className="text-gray-600 mt-3 text-lg">{tagline}</p>
        </div>

        {authError && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            <p className="font-semibold">Não foi possível entrar</p>
            <p className="mt-1">{authErrorMessage}</p>
          </div>
        )}

        {!authError && showGoogleOnlyHint && (
          <div
            className="mb-6 rounded-2xl border px-4 py-3 text-sm"
            style={{ borderColor: `${C.primaryHover}55`, backgroundColor: C.primaryBg, color: C.primaryDark }}
          >
            <p>
              O acesso ao {productName} é feito somente com conta Google (agenda, Drive e backup
              integrados).
            </p>
          </div>
        )}

        <ChromeExtensionNotice variant="compact" className="mb-6" />

        {showOAuthSetupHelp && (
          <details className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <summary className="cursor-pointer font-medium text-slate-800">
              Detalhes técnicos (suporte / administrador)
            </summary>
            <p className="mt-3 text-slate-600">
              Se o erro persistir, confira se estas URIs estão em{' '}
              <strong>Authorized redirect URIs</strong> no{' '}
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline"
                style={{ color: C.primaryHover }}
              >
                Google Cloud → Credentials → OAuth Client (Web)
              </a>
              :
            </p>
            <ul className="mt-2 space-y-1 font-mono text-xs break-all text-slate-600">
              {oauthUris?.redirectUris?.length ? (
                oauthUris.redirectUris.map((uri) => (
                  <li key={uri} className="bg-white rounded px-2 py-1 border border-slate-100">
                    {uri}
                  </li>
                ))
              ) : (
                <li>Carregando URIs…</li>
              )}
            </ul>
          </details>
        )}

        <div
          className="mb-6 rounded-2xl border px-4 py-3 text-center text-sm"
          style={{ borderColor: `${C.primaryHover}40`, backgroundColor: C.primaryBg }}
        >
          <p className="font-semibold text-gray-900">{copy.planDisplayName}</p>
          <p className="mt-1 text-gray-600">
            {copy.trialDays} dias grátis · {copy.planPriceLabel} após o trial
          </p>
          <Link
            href="/planos"
            className="mt-2 inline-block text-sm font-medium hover:underline"
            style={{ color: C.primaryHover }}
          >
            Ver detalhes do plano
          </Link>
        </div>

        <h2 className="text-2xl font-semibold text-center mb-2">Entrar com Google</h2>
        <p className="text-center text-sm text-gray-500 mb-6">
          Login seguro com sua conta Google — agenda e clientes integrados.
        </p>

        <div className="flex items-start gap-3 mb-4 text-sm text-gray-600">
          <input
            id="login-legal"
            type="checkbox"
            checked={legalAccepted}
            onChange={(e) => {
              setLegalAccepted(e.target.checked);
              if (e.target.checked) setLegalHint('');
            }}
            className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300"
            style={{ accentColor: C.primaryHover }}
          />
          <label htmlFor="login-legal" className="cursor-pointer leading-snug">
            Li e aceito a{' '}
            <Link
              href="/privacidade"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium hover:underline"
              style={{ color: C.primaryHover }}
              onClick={(e) => e.stopPropagation()}
            >
              Política de Privacidade
            </Link>{' '}
            e os{' '}
            <Link
              href="/termos"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium hover:underline"
              style={{ color: C.primaryHover }}
              onClick={(e) => e.stopPropagation()}
            >
              Termos de Uso
            </Link>
            .
          </label>
        </div>
        {legalHint && (
          <p className="mb-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            {legalHint}
          </p>
        )}

        <button
          type="button"
          onClick={handleLogin}
          aria-disabled={!legalAccepted}
          data-muted={!legalAccepted ? 'true' : undefined}
          className="btn-action w-full flex items-center justify-center gap-3 border-2 p-5 rounded-2xl transition-all text-white font-semibold text-lg hover:opacity-90"
          style={{
            borderColor: C.primaryHover,
            backgroundColor: C.primaryHover,
          }}
        >
          <BrandLogoIcon size={28} className="h-7 w-auto" />
          Continuar com Google
        </button>

        <p className="text-center text-xs text-gray-400 mt-8">
          Dificuldade para entrar? Tente uma janela anônima ou outro navegador.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ backgroundColor: BRAND.colors.bgPage }}
        >
          Carregando...
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
