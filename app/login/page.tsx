'use client';

import { signIn, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Stethoscope, Building2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { CANONICAL_APP_URL } from '@/lib/constants';
import ChromeExtensionNotice from '@/components/ChromeExtensionNotice';

type OAuthUrisResponse = {
  redirectUris?: string[];
  baseUrl?: string;
};

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

  const handleLogin = (type: 'medico' | 'clinica') => {
    if (!legalAccepted) {
      setLegalHint('Marque o aceite da Política de Privacidade e dos Termos de Uso antes de continuar.');
      return;
    }
    setLegalHint('');
    const plan = type === 'medico' ? 'medico-pix' : 'clinica-5-pix';
    const afterVerify = `/onboarding?role=${type}&plan=${plan}&trialStarted=true`;
    signIn('google', {
      callbackUrl: `/auth/verificar-email?callbackUrl=${encodeURIComponent(afterVerify)}`,
      redirect: true,
    });
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-6">
      <div className="relative z-10 isolate max-w-md w-full bg-white rounded-3xl shadow-2xl p-10">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-bold text-gray-900">MedSupAPP</h1>
          <p className="text-gray-600 mt-3 text-lg">Gestão simples para clínicas</p>
        </div>

        {authError && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            <p className="font-semibold">Falha ao entrar ({authError})</p>
            <p className="mt-1">{authErrorMessage}</p>
          </div>
        )}

        {!authError && showGoogleOnlyHint && (
          <div className="mb-6 rounded-2xl border border-[#90EE90] bg-[#f4fff4] px-4 py-3 text-sm text-[#2d652d]">
            <p>
              O acesso ao MedSupAPP é feito somente com conta Google (agenda, Drive e
              backup integrados).
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
            Use a mesma URL no navegador (localhost ou 127.0.0.1). Se mudar de um para
            outro, cadastre as 4 URIs (duas de cada host). Aguarde 1–5 min após salvar.
          </p>
        </div>

        <h2 className="text-2xl font-semibold text-center mb-2">Entrar com Google</h2>
        <p className="text-center text-sm text-gray-500 mb-8">
          Escolha seu perfil para começar ou continuar
        </p>

        <div className="flex items-start gap-3 mb-2 text-sm text-gray-600">
          <input
            id="login-legal"
            type="checkbox"
            checked={legalAccepted}
            onChange={(e) => {
              setLegalAccepted(e.target.checked);
              if (e.target.checked) setLegalHint('');
            }}
            className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 text-[#228B22] focus:ring-[#90EE90]"
          />
          <label htmlFor="login-legal" className="cursor-pointer leading-snug">
            Li e aceito a{' '}
            <Link
              href="/privacidade"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#228B22] font-medium hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              Política de Privacidade
            </Link>{' '}
            e os{' '}
            <Link
              href="/termos"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#228B22] font-medium hover:underline"
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

        <div className="space-y-4 mb-6">
          <button
            type="button"
            onClick={() => handleLogin('medico')}
            aria-disabled={!legalAccepted}
            data-muted={!legalAccepted ? 'true' : undefined}
            className="btn-action w-full flex items-center gap-5 border-2 border-[#90EE90] hover:bg-[#f0f9f0] p-6 rounded-2xl transition-all"
          >
            <Stethoscope className="w-10 h-10 text-[#228B22]" />
            <div className="text-left">
              <div className="font-semibold text-xl">Médico Solo</div>
              <p className="text-sm text-gray-500">Google Calendar · Drive · agenda</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleLogin('clinica')}
            aria-disabled={!legalAccepted}
            data-muted={!legalAccepted ? 'true' : undefined}
            className="btn-action w-full flex items-center gap-5 border-2 border-[#90EE90] hover:bg-[#f0f9f0] p-6 rounded-2xl transition-all"
          >
            <Building2 className="w-10 h-10 text-[#228B22]" />
            <div className="text-left">
              <div className="font-semibold text-xl">Clínica</div>
              <p className="text-sm text-gray-500">Google Calendar · Drive · agenda</p>
            </div>
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 mt-8">
          Erro ao entrar com Google?{' '}
          <a
            href="/api/auth/oauth-uris"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#228B22] hover:underline"
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
        <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">
          Carregando...
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
