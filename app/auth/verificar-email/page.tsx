'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Loader2, Mail, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { waitForEmailVerified } from '@/lib/waitForEmailVerified';
import { VERIFICATION_CODE_DIGITS } from '@/lib/constants';
import ChromeExtensionNotice from '@/components/ChromeExtensionNotice';

const RESEND_COOLDOWN_SEC = 60;

function VerificarEmailGoogleContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status, update } = useSession();
  const callbackUrl = searchParams.get('callbackUrl') || '/onboarding';

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [reverify, setReverify] = useState(false);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const sentOnMount = useRef(false);
  const redirecting = useRef(false);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const email = session?.user?.email ?? '';

  const startResendCooldown = useCallback(() => {
    if (cooldownRef.current) {
      clearInterval(cooldownRef.current);
      cooldownRef.current = null;
    }
    setCooldown(RESEND_COOLDOWN_SEC);
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownRef.current) {
            clearInterval(cooldownRef.current);
            cooldownRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const sendCode = useCallback(async () => {
    if (cooldown > 0 || sending) return;
    setError('');
    setSending(true);
    try {
      const res = await fetch('/api/auth/google-access/send-code', {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar código');
      setInfo(
        data.message ||
          `Código enviado para ${email}. Verifique a caixa de entrada e o spam.`,
      );
      startResendCooldown();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar código');
    } finally {
      setSending(false);
    }
  }, [cooldown, email, sending, startResendCooldown]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
      return;
    }
    if (status !== 'authenticated' || redirecting.current) return;

    void (async () => {
      try {
        const r = await fetch('/api/auth/google-access/status');
        const data = await r.json();
        if (data.reverifyDueToInactivity) setReverify(true);

        if (data.accessVerified) {
          redirecting.current = true;
          await update();
          window.location.replace(callbackUrl);
          return;
        }

        if (!sentOnMount.current) {
          sentOnMount.current = true;
          const sendRes = await fetch('/api/auth/google-access/send-code', {
            method: 'POST',
          });
          const sendData = await sendRes.json();
          if (!sendRes.ok) throw new Error(sendData.error || 'Erro ao enviar');
          setInfo(
            sendData.message ||
              `Código enviado para ${email}. Verifique a caixa de entrada e o spam.`,
          );
          startResendCooldown();
        }
      } catch (err: unknown) {
        if (!sentOnMount.current) {
          setError(
            err instanceof Error
              ? err.message
              : 'Não foi possível enviar o código. Use reenviar.',
          );
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, callbackUrl, update, email, startResendCooldown]);

  useEffect(() => {
    return () => {
      if (cooldownRef.current) {
        clearInterval(cooldownRef.current);
        cooldownRef.current = null;
      }
    };
  }, []);

  const canSubmit = code.length === VERIFICATION_CODE_DIGITS && legalAccepted && !loading;

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (code.length !== VERIFICATION_CODE_DIGITS) {
      setError(`Digite os ${VERIFICATION_CODE_DIGITS} dígitos do código.`);
      return;
    }
    if (!legalAccepted) {
      setError('Marque a caixa: aceite a Política de Privacidade e os Termos de Uso.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/google-access/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, privacyConsent: true }),
      });
      const text = await res.text();
      let data: { error?: string; trialConsumed?: boolean } = {};
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error('Resposta inválida do servidor.');
        }
      }
      if (!res.ok) throw new Error(data.error || 'Código inválido');

      redirecting.current = true;
      const verified = await waitForEmailVerified();
      if (!verified) {
        throw new Error(
          'Código aceito, mas a confirmação ainda não apareceu. Aguarde e clique em Confirmar novamente.',
        );
      }
      await update();

      const dest = data.trialConsumed ? '/planos?trial=used' : callbackUrl;
      window.location.replace(dest);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao verificar');
    } finally {
      setLoading(false);
    }
  }

  if (status === 'loading' || !email) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa]">
        <Loader2 className="w-8 h-8 animate-spin text-[#228B22]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-6">
      <div className="relative z-10 max-w-md w-full bg-white rounded-3xl shadow-2xl p-10 isolate">
        <div className="text-center mb-6">
          <ShieldCheck className="w-12 h-12 text-[#228B22] mx-auto mb-3" />
          <h1 className="text-3xl font-bold text-gray-900">Confirme seu e-mail</h1>
          <p className="text-gray-600 mt-2 text-sm">
            {reverify
              ? 'Faz mais de 30 dias desde o último acesso. Por segurança, confirme novamente o e-mail da sua conta Google.'
              : `Enviamos um código de ${VERIFICATION_CODE_DIGITS} dígitos. Sem essa confirmação você não acessa agenda, clientes nem dashboard.`}
          </p>
        </div>

        <div className="rounded-2xl bg-[#f4fff4] border border-[#90EE90]/40 px-4 py-3 flex items-center gap-3 mb-6">
          <Mail className="w-5 h-5 text-[#228B22] shrink-0" />
          <p className="text-sm text-gray-800 break-all">
            <strong>{email}</strong>
          </p>
        </div>

        <ChromeExtensionNotice className="mb-6" />

        {info && (
          <p className="text-sm text-emerald-700 bg-emerald-50 rounded-xl px-3 py-2 mb-4">
            {info}
          </p>
        )}
        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2 mb-4">{error}</p>
        )}

        <form onSubmit={handleVerify} className="space-y-4">
          <label className="block text-sm font-medium text-gray-700">
            Código de {VERIFICATION_CODE_DIGITS} dígitos
            <input
              type="text"
              inputMode="numeric"
              maxLength={VERIFICATION_CODE_DIGITS}
              value={code}
              onChange={(e) =>
                setCode(
                  e.target.value.replace(/\D/g, '').slice(0, VERIFICATION_CODE_DIGITS),
                )
              }
              className="mt-2 w-full text-center text-3xl tracking-[0.35em] font-bold rounded-xl border border-gray-200 px-4 py-3 focus:border-[#90EE90] focus:ring-2 focus:ring-[#90EE90]/30 outline-none"
              placeholder="000000"
              autoComplete="one-time-code"
            />
          </label>

          <div className="flex items-start gap-3 text-sm text-gray-600">
            <input
              id="verificar-legal"
              type="checkbox"
              checked={legalAccepted}
              onChange={(e) => setLegalAccepted(e.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 text-[#228B22] focus:ring-[#90EE90]"
            />
            <label htmlFor="verificar-legal" className="cursor-pointer leading-snug">
              Aceito a{' '}
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

          {!canSubmit && !loading && (
            <p className="text-xs text-gray-500">
              {code.length !== VERIFICATION_CODE_DIGITS
                ? `Informe o código de ${VERIFICATION_CODE_DIGITS} dígitos do e-mail.`
                : 'Marque o aceite da política e dos termos para continuar.'}
            </p>
          )}

          <button
            type="submit"
            aria-disabled={!canSubmit}
            data-muted={!canSubmit ? 'true' : undefined}
            className="btn-action w-full rounded-2xl bg-[#013a01] text-white font-semibold py-3 hover:bg-[#025201] transition"
          >
            {loading ? 'Verificando...' : 'Confirmar e continuar'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            if (sending || cooldown > 0) return;
            void sendCode();
          }}
          aria-disabled={sending || cooldown > 0}
          data-muted={sending || cooldown > 0 ? 'true' : undefined}
          className={`btn-action mt-4 w-full text-sm font-medium hover:underline ${
            sending || cooldown > 0 ? 'text-gray-400 no-underline' : 'text-[#228B22]'
          }`}
        >
          {sending
            ? 'Enviando...'
            : cooldown > 0
              ? `Reenviar em ${cooldown}s`
              : 'Reenviar código'}
        </button>

        <p className="mt-6 text-xs text-center text-gray-400">
          Código válido por 5 minutos · Enviado de naoresponda@medsupapp.com.br
        </p>
      </div>
    </div>
  );
}

export default function VerificarEmailGooglePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">Carregando...</div>
      }
    >
      <VerificarEmailGoogleContent />
    </Suspense>
  );
}
