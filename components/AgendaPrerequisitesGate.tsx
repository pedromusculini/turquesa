'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Link2,
  Loader2,
  UserPlus,
} from 'lucide-react';
import type { ProfissionalOption } from '@/lib/loadMedicosOptions';
import type { GoogleConnectionsResponse } from '@/lib/useGoogleConnectionHealth';
import { googleAuthorizeUrl } from '@/lib/useGoogleConnectionHealth';

type Props = {
  userEmail: string;
  medicosLoading: boolean;
  profissionais: ProfissionalOption[];
  isClinica: boolean;
  google: GoogleConnectionsResponse | null;
  googleLoading: boolean;
  blocked: boolean;
};

export default function AgendaPrerequisitesGate({
  userEmail,
  medicosLoading,
  profissionais,
  isClinica: _isClinica,
  google,
  googleLoading,
  blocked,
}: Props) {
  const [setupBusy, setSetupBusy] = useState(false);
  const [setupError, setSetupError] = useState('');

  const needsProfissional = profissionais.length === 0;
  const googleBlocked =
    !googleLoading &&
    !!google &&
    (google.needsConnect ||
      google.needsReconnect ||
      google.healthy === false ||
      google.driveHealthy === false ||
      google.calendarHealthy === false);

  async function handleUsarEmailLogin() {
    setSetupBusy(true);
    setSetupError('');
    try {
      const res = await fetch('/api/onboarding/setup-titular-profissional', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === 'string'
            ? data.error
            : 'Não foi possível cadastrar.',
        );
      }
      window.location.reload();
    } catch (err) {
      setSetupError(
        err instanceof Error ? err.message : 'Erro ao configurar. Tente de novo.',
      );
    } finally {
      setSetupBusy(false);
    }
  }

  if (medicosLoading || googleLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f8f9fa] p-8">
        <div className="flex flex-col items-center gap-3 text-slate-600">
          <Loader2 className="h-8 w-8 animate-spin text-[#047482]" />
          <p className="text-sm">Verificando requisitos da agenda…</p>
        </div>
      </main>
    );
  }

  if (!blocked) return null;

  const googleOk = !googleBlocked;
  // Já tem profissional (ex.: e-mail de login): só mostra o bloqueio do Google, se houver.
  const onlyGoogle = !needsProfissional && googleBlocked;

  return (
    <main className="min-h-screen bg-[#f8f9fa] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-10 shadow-sm">
          <div className="mb-6 flex items-start gap-3">
            <div className="rounded-xl bg-amber-100 p-2.5">
              <AlertCircle className="h-7 w-7 text-amber-700" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#047482]">
                Agenda indisponível
              </p>
              <h1 className="mt-1 text-2xl font-bold text-slate-950">
                {onlyGoogle
                  ? 'Reconecte o Google para usar a agenda'
                  : 'Configure antes de usar a agenda'}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {onlyGoogle ? (
                  <>
                    Sua profissional já está cadastrada. Falta só o{' '}
                    <strong>Google Drive + Calendar</strong> do estabelecimento ativos.
                  </>
                ) : (
                  <>
                    A agenda funciona com o <strong>Google Calendar</strong> do estabelecimento e
                    exige pelo menos uma <strong>profissional</strong> (pode ser você com o e-mail
                    de login).
                  </>
                )}
              </p>
              {userEmail && (
                <p className="mt-2 text-xs text-slate-500">Conta: {userEmail}</p>
              )}
            </div>
          </div>

          <ol className="space-y-4">
            <li
              className={`rounded-2xl border p-4 ${
                googleBlocked
                  ? 'border-amber-200 bg-amber-50'
                  : 'border-emerald-200 bg-emerald-50'
              }`}
            >
              <div className="flex items-start gap-3">
                <Calendar
                  className={`mt-0.5 h-5 w-5 shrink-0 ${
                    googleBlocked ? 'text-amber-700' : 'text-emerald-700'
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">
                    {onlyGoogle ? '' : '1. '}
                    Google Drive + Calendar conectados
                    {googleOk ? ' ✓' : ''}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {googleBlocked
                      ? google?.summary ||
                        'Conecte ou reconecte sua conta Google. Clientes ficam no Drive; sessões no Calendar.'
                      : 'Google verificado e pronto para uso.'}
                  </p>
                  {googleBlocked && (
                    <a
                      href={googleAuthorizeUrl('/agenda')}
                      className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#047482] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#035e6b]"
                    >
                      <Link2 className="h-4 w-4" />
                      {google?.needsConnect ? 'Conectar Google' : 'Reconectar Google'}
                    </a>
                  )}
                </div>
              </div>
            </li>

            {needsProfissional && (
              <li className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <UserPlus className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">
                      2. Pelo menos uma profissional na equipe
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Use o e-mail de login como profissional (recomendado) ou cadastre a equipe em
                      Configurações → Equipe. A agenda usa o Google do estabelecimento.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={setupBusy || !googleOk}
                        onClick={() => void handleUsarEmailLogin()}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#047482] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#035e6b] disabled:opacity-50"
                      >
                        {setupBusy ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <UserPlus className="h-4 w-4" />
                        )}
                        Usar meu e-mail de login
                      </button>
                      <Link
                        href="/dashboard/configuracoes/equipe"
                        className="inline-flex items-center gap-2 rounded-xl border-2 border-[#047482] bg-white px-4 py-2.5 text-sm font-semibold text-[#047482] hover:bg-[#eef4f5]"
                      >
                        Cadastrar outra profissional
                      </Link>
                    </div>
                    {setupError && (
                      <p className="mt-2 text-sm text-red-600">{setupError}</p>
                    )}
                  </div>
                </div>
              </li>
            )}
          </ol>

          <div className="mt-8 flex flex-wrap gap-3 border-t border-slate-100 pt-6">
            <Link
              href="/dashboard"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Voltar ao Dashboard
            </Link>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200"
            >
              Já configurei — atualizar
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
