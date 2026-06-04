'use client';

import { signIn, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import Link from 'next/link';
import BrandLogoIcon from '@/components/BrandLogoIcon';
import { BRAND, CANONICAL_APP_URL, DEFAULT_PLAN_ID } from '@/lib/constants';
import ChromeExtensionNotice from '@/components/ChromeExtensionNotice';

type OAuthUrisResponse = {
  redirectUris?: string[];
  baseUrl?: string;
};

const { colors: C, productName, tagline, copy } = BRAND;

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  Configuration:
    `Configuração incompleta na Vercel (AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e AUTH_URL=${CANONICAL_APP_URL}).`,
  AccessDenied: 'Acesso negado pelo Google. Tente outra conta ou aceite as permissões.',
  OAuthSignin: 'Não foi possível iniciar o login com Google.',
  OAuthCallback: 'Falha no retorno do Google. Confira as URIs de redirect no Google Cloud.',
  OAuthAccountNotLinked:
    'Esta conta Google já está vinculada a outro método de login.',
  CallbackRouteError: 'Erro na rota de callback. Confira AUTH_URL e as URIs no Google Cloud.',
  Default: 'Não foi possível entrar. Tente novamente ou contate o suporte.',
};

function LoginContent() {
  const router = useRouter();
  const { status } = useSession();
  const searchParams = useSearchParams();
  const showGoogleOnlyHint = searchParams.get('acesso') === 'google';
  const authError = searchParams.get('error');
  const authErrorMessage = authError
    ? AUTH_ERROR_MESSAGES[authError] ?? AUTH_ERROR_MESSAGES.Default
    : null;
  const [oauthUris, setOauthUris] = useState<OAuthUrisResponse | null>(null);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [legalHint, setLegalHint] = useState('');

  useEffect(() => {
    fetch('/api/auth/oauth-uris')
      .then((r) => r.json())
      .then(setOauthUris)
      .catch(() => setOauthUris(null));
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/auth/google-access/status', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (!data.accessVerified) {
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
    const plan = searchParams.get('plan') || DEFAULT_PLAN_ID;
    const afterVerify = `/onboarding?plan=${plan}&trialStarted=true`;
    signIn('google', {
      callbackUrl: `/auth/verificar-email?callbackUrl=${encodeURIComponent(afterVerify)}`,
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
          <BrandLogoIcon size={56} className="mx-auto h-14 w-14 mb-4" priority />
          <h1 className="text-4xl font-bold text-gray-900">{productName}</h1>
          <p className="text-gray-600 mt-3 text-lg">{tagline}</p>
        </div>

        {authError && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            <p className="font-semibold">Falha ao entrar ({authError})</p>
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

        <ChromeExtensionNotice className="mb-6" />

        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            Erro redirect_uri_mismatch?
          </p>
          <p className="mt-2 text-amber-900/90">
            Não é o e-mail de teste — cadastre estas URIs no{' '}
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline"
            >
              Google Cloud → Credentials → OAuth Client (Web)
            </a>
            , em <strong>Authorized redirect URIs</strong> (sem barra no final):
          </p>
          <ul className="mt-2 space-y-1 font-mono text-xs break-all">
            {oauthUris?.redirectUris?.length ? (
              oauthUris.redirectUris.map((uri) => (
                <li key={uri} className="bg-white/60 rounded px-2 py-1">
                  {uri}
                </li>
              ))
            ) : (
              <li className="text-amber-800">Carregando URIs desta página…</li>
            )}
          </ul>
          <p className="mt-2 text-xs text-amber-800">
            Use a mesma URL no navegador (localhost ou 127.0.0.1). Se mudar de um para outro,
            cadastre as 4 URIs (duas de cada host). Aguarde 1–5 min após salvar.
          </p>
        </div>

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
          Um plano para profissional solo ou equipe — sem tiers médico/clínica.
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
          <BrandLogoIcon size={28} className="h-7 w-7" />
          Continuar com Google
        </button>

        <p className="text-center text-xs text-gray-400 mt-8">
          Erro ao entrar com Google?{' '}
          <a
            href="/api/auth/oauth-uris"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
            style={{ color: C.primaryHover }}
          >
            Ver URIs para cadastrar no Google Cloud
          </a>
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
