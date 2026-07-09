'use client';

import Link from 'next/link';
import { AlertCircle, Calendar, HardDrive, Link2, Loader2, Users } from 'lucide-react';
import {
  googleAuthorizeUrl,
  useGoogleConnectionHealth,
} from '@/lib/useGoogleConnectionHealth';

type Props = {
  /** Caminho para voltar após OAuth (ex.: /clientes, /dashboard) */
  redirectPath?: string;
  className?: string;
  /** Mensagem extra contextual (ex.: Clientes, Agenda) */
  context?: 'clientes' | 'agenda' | 'geral';
};

const CONTEXT_COPY: Record<NonNullable<Props['context']>, string> = {
  geral:
    'O Turquesa Agenda depende do Google Drive e do Google Calendar. Sem conexão ativa, cadastros e agenda não são salvos.',
  clientes:
    'Clientes e atendimentos ficam no seu Google Drive. Reconecte o Google para salvar e listar cadastros.',
  agenda:
    'A agenda usa o Google Calendar. Reconecte o Google para criar e sincronizar sessões.',
};

export default function GoogleConnectionAlert({
  redirectPath = '/dashboard',
  className = '',
  context = 'geral',
}: Props) {
  const { data, loading, showAlert } = useGoogleConnectionHealth();

  if (loading) {
    return (
      <div
        className={`flex items-center gap-2 rounded-xl border border-gray-100 bg-white px-4 py-3 text-sm text-gray-500 ${className}`}
      >
        <Loader2 className="h-4 w-4 animate-spin text-[#047482]" />
        Verificando conexão Google…
      </div>
    );
  }

  if (!showAlert || !data) return null;

  const reconnect = data.needsConnect || data.needsReconnect || data.healthy === false;

  return (
    <div
      className={`rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 sm:p-5 shadow-sm ${className}`}
      role="alert"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex flex-1 gap-3">
          <AlertCircle className="mt-0.5 h-6 w-6 shrink-0 text-amber-700" />
          <div className="min-w-0">
            <p className="font-semibold text-amber-950">
              {data.needsConnect
                ? 'Google não conectado'
                : 'Conexão Google precisa ser refeita'}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-amber-900">
              {data.summary || CONTEXT_COPY[context]}
            </p>
            <p className="mt-2 text-xs text-amber-800">{CONTEXT_COPY[context]}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                  data.driveHealthy ?? data.drive
                    ? 'bg-[#eef4f5] text-[#047482]'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                <HardDrive className="h-3.5 w-3.5" />
                Drive
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                  data.calendarHealthy ?? data.calendar
                    ? 'bg-[#eef4f5] text-[#047482]'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                <Calendar className="h-3.5 w-3.5" />
                Calendar
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                  data.contacts ? 'bg-[#eef4f5] text-[#047482]' : 'bg-gray-100 text-gray-600'
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                Contatos
              </span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          {reconnect && (
            <a
              href={googleAuthorizeUrl(redirectPath)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#047482] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#035e6b]"
            >
              <Link2 className="h-4 w-4" />
              {data.needsConnect ? 'Conectar Google' : 'Reconectar Google'}
            </a>
          )}
          <Link
            href="/dashboard"
            className="text-center text-xs font-medium text-[#047482] hover:underline"
          >
            Ver integração no Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
