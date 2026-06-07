'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Cloud,
  HardDrive,
  Loader2,
  RefreshCw,
  Users,
  AlertCircle,
  Link2,
} from 'lucide-react';

type Connections = {
  connected: boolean;
  drive: boolean;
  calendar: boolean;
  contacts: boolean;
  needsConnect: boolean;
};

type SyncResult = { ok: boolean; message: string };

export default function GoogleIntegracaoCard() {
  const [conn, setConn] = useState<Connections | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<SyncResult | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/google-connections');
      const data = await res.json();
      if (res.ok) {
        setConn({
          connected: !!data.connected,
          drive: !!data.drive,
          calendar: !!data.calendar,
          contacts: !!data.contacts,
          needsConnect: !!data.needsConnect,
        });
      }
    } catch {
      setConn({
        connected: false,
        drive: false,
        calendar: false,
        contacts: false,
        needsConnect: true,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (
      params.get('google_connected') === 'google' ||
      params.get('google_connected') === 'drive' ||
      params.get('google_connected') === 'calendar' ||
      params.get('google_connected') === 'contacts'
    ) {
      window.history.replaceState({}, '', '/dashboard');
    }
    load();
  }, [load]);

  function connectGoogle() {
    const redirect = encodeURIComponent('/dashboard');
    window.location.href = `/api/auth/google-authorize?scope=all&redirect=${redirect}`;
  }

  async function runSync(
    key: string,
    url: string,
    successLabel: string,
    needsDrive?: boolean,
  ) {
    if (needsDrive && !conn?.drive) {
      setFeedback({
        ok: false,
        message: 'Conecte o Google antes de sincronizar.',
      });
      return;
    }
    setSyncing(key);
    setFeedback(null);
    try {
      const res = await fetch(url, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'DRIVE_NOT_CONNECTED') {
          throw new Error('Conecte o Google no botão acima.');
        }
        if (data.code === 'CONTACTS_NOT_CONNECTED') {
          throw new Error('Conecte o Google para habilitar Contatos.');
        }
        throw new Error(data.error || 'Erro ao sincronizar');
      }
      const n = data.sincronizados ?? data.criados ?? data.importados ?? 0;
      setFeedback({
        ok: true,
        message:
          n > 0
            ? `${successLabel}: ${n} registro(s) atualizado(s).`
            : `${successLabel}: nada pendente no momento.`,
      });
    } catch (e: unknown) {
      setFeedback({
        ok: false,
        message: e instanceof Error ? e.message : 'Erro ao sincronizar',
      });
    } finally {
      setSyncing(null);
    }
  }

  function ServiceBadge({
    ok,
    label,
    icon: Icon,
  }: {
    ok: boolean;
    label: string;
    icon: typeof HardDrive;
  }) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
          ok ? 'bg-[#eef4f5] text-[#047482]' : 'bg-gray-100 text-gray-500'
        }`}
      >
        <Icon className="w-3.5 h-3.5" />
        {label}
        {ok ? (
          <CheckCircle2 className="w-3 h-3" />
        ) : (
          <span className="text-[10px] opacity-70">—</span>
        )}
      </span>
    );
  }

  if (loading) {
    return (
      <div className="mb-6 p-6 rounded-2xl border border-gray-100 bg-white flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#047482]" />
      </div>
    );
  }

  const isConnected = !!conn?.connected;

  return (
    <section className="mb-6 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-5 sm:p-6 border-b border-gray-100 bg-gradient-to-r from-[#eef4f5] to-white">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-[#3795a1]/50">
            <Cloud className="w-6 h-6 text-[#047482]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900">Google</h2>
              <span
                className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                  isConnected
                    ? 'bg-[#eef4f5] text-[#047482]'
                    : 'bg-amber-50 text-amber-800'
                }`}
              >
                {isConnected ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5" />
                )}
                {isConnected ? 'Conectado' : 'Não conectado'}
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-1 leading-relaxed">
              Uma única autorização para Drive, Calendar e Contatos — sem precisar reconectar a
              cada hora.
            </p>
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <ServiceBadge ok={!!conn?.drive} label="Drive" icon={HardDrive} />
          <ServiceBadge ok={!!conn?.calendar} label="Calendar" icon={Calendar} />
          <ServiceBadge ok={!!conn?.contacts} label="Contatos" icon={Users} />
        </div>

        {conn?.needsConnect && (
          <button
            type="button"
            onClick={connectGoogle}
            className="btn-action w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#047482] text-white text-sm font-semibold hover:bg-[#035e6b]"
          >
            <Link2 className="w-4 h-4" />
            Conectar Google
          </button>
        )}

        {!conn?.needsConnect && !conn?.contacts && (
          <p className="text-xs text-gray-500">
            Drive e Calendar ativos. Para importar contatos, reconecte para incluir a permissão de
            Contatos.
          </p>
        )}

        {!conn?.needsConnect && (
          <button
            type="button"
            onClick={connectGoogle}
            className="text-sm text-[#047482] font-medium hover:underline"
          >
            Reconectar Google
          </button>
        )}

        <div className="pt-2 border-t border-gray-100">
          <p className="text-sm font-semibold text-gray-800 mb-3">Sincronizar agora</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              aria-disabled={!!syncing}
              data-muted={syncing ? 'true' : undefined}
              onClick={() => {
                if (syncing) return;
                void runSync(
                  'form',
                  '/api/clientes/sync-formularios',
                  'Cadastros pelo link',
                  true,
                );
              }}
              className="btn-action inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#047482] text-white text-sm font-semibold hover:bg-[#035e6b]"
            >
              {syncing === 'form' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Importar cadastros (formulário)
            </button>
            <button
              type="button"
              aria-disabled={!!syncing}
              data-muted={syncing ? 'true' : undefined}
              onClick={() => {
                if (syncing) return;
                void runSync(
                  'agendamento',
                  '/api/clientes/sync-agendamentos',
                  'Reservas pelo link público',
                  true,
                );
              }}
              className="btn-action inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-[#047482] text-[#047482] text-sm font-semibold hover:bg-[#eef4f5]"
            >
              {syncing === 'agendamento' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Importar agendamentos online
            </button>
            <button
              type="button"
              aria-disabled={!!syncing}
              data-muted={syncing ? 'true' : undefined}
              onClick={() => {
                if (syncing) return;
                if (!conn?.contacts) {
                  setFeedback({
                    ok: false,
                    message: 'Conecte o Google com permissão de Contatos antes de importar.',
                  });
                  return;
                }
                void runSync(
                  'contacts',
                  '/api/clientes/sync-google-contacts',
                  'Contatos Google',
                  true,
                );
              }}
              className="btn-action inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-800 hover:bg-gray-50"
            >
              {syncing === 'contacts' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Users className="w-4 h-4" />
              )}
              Importar contatos Google
            </button>
          </div>
        </div>

        {feedback && (
          <p
            className={`text-sm p-3 rounded-xl ${
              feedback.ok
                ? 'bg-[#eef4f5] text-[#047482]'
                : 'bg-red-50 text-red-700'
            }`}
          >
            {feedback.message}
          </p>
        )}
      </div>
    </section>
  );
}
