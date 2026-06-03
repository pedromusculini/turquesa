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
} from 'lucide-react';

type Connections = {
  drive: boolean;
  calendar: boolean;
  contacts: boolean;
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
          drive: !!data.drive,
          calendar: !!data.calendar,
          contacts: !!data.contacts,
        });
      }
    } catch {
      setConn({ drive: false, calendar: false, contacts: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (
      params.get('google_connected') === 'drive' ||
      params.get('google_connected') === 'calendar' ||
      params.get('google_connected') === 'contacts'
    ) {
      window.history.replaceState({}, '', '/dashboard');
    }
    load();
  }, [load]);

  function connect(scope: 'drive' | 'calendar' | 'contacts') {
    const redirect = encodeURIComponent('/dashboard');
    window.location.href = `/api/auth/google-authorize?scope=${scope}&redirect=${redirect}`;
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
        message: 'Conecte o Google Drive antes de sincronizar.',
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
          throw new Error('Conecte o Google Drive no botão acima.');
        }
        if (data.code === 'CONTACTS_NOT_CONNECTED') {
          throw new Error('Conecte os Contatos Google no botão acima.');
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

  function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
    return (
      <span
        className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
          ok ? 'bg-[#f4fff4] text-[#228B22]' : 'bg-amber-50 text-amber-800'
        }`}
      >
        {ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
        {label}
      </span>
    );
  }

  if (loading) {
    return (
      <div className="mb-6 p-6 rounded-2xl border border-gray-100 bg-white flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#228B22]" />
      </div>
    );
  }

  return (
    <section className="mb-6 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-5 sm:p-6 border-b border-gray-100 bg-gradient-to-r from-[#f4fff4] to-white">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-[#90EE90]/50">
            <Cloud className="w-6 h-6 text-[#228B22]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Google — conectar e sincronizar</h2>
            <p className="text-sm text-gray-600 mt-1 leading-relaxed">
              Tudo em um lugar: pacientes no Drive, agenda no Calendar e importações sem ir em
              Backup.
            </p>
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="p-4 rounded-xl border border-gray-100 bg-[#fafafa] flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-sm text-gray-900 flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-[#228B22]" />
                Drive
              </span>
              <StatusBadge ok={!!conn?.drive} label={conn?.drive ? 'Conectado' : 'Pendente'} />
            </div>
            <p className="text-xs text-gray-500">Clientes, cadastros e financeiro na sua nuvem.</p>
            {!conn?.drive && (
              <button
                type="button"
                onClick={() => connect('drive')}
                className="btn-action mt-auto w-full py-2.5 rounded-lg bg-[#013a01] text-white text-sm font-semibold hover:bg-[#025201]"
              >
                Conectar Drive
              </button>
            )}
          </div>

          <div className="p-4 rounded-xl border border-gray-100 bg-[#fafafa] flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-sm text-gray-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#228B22]" />
                Calendar
              </span>
              <StatusBadge
                ok={!!conn?.calendar}
                label={conn?.calendar ? 'Conectado' : 'Pendente'}
              />
            </div>
            <p className="text-xs text-gray-500">Sincronizar consultas com sua agenda Google.</p>
            {!conn?.calendar && (
              <button
                type="button"
                onClick={() => connect('calendar')}
                className="btn-action mt-auto w-full py-2.5 rounded-lg border-2 border-[#228B22] text-[#228B22] text-sm font-semibold hover:bg-[#f4fff4]"
              >
                Conectar Calendar
              </button>
            )}
          </div>

          <div className="p-4 rounded-xl border border-gray-100 bg-[#fafafa] flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-sm text-gray-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-[#228B22]" />
                Contatos
              </span>
              <StatusBadge
                ok={!!conn?.contacts}
                label={conn?.contacts ? 'Conectado' : 'Opcional'}
              />
            </div>
            <p className="text-xs text-gray-500">Importar telefones da agenda do Google.</p>
            {!conn?.contacts && (
              <button
                type="button"
                onClick={() => connect('contacts')}
                className="btn-action mt-auto w-full py-2.5 rounded-lg border border-gray-200 text-gray-800 text-sm font-medium hover:bg-white"
              >
                Conectar Contatos
              </button>
            )}
          </div>
        </div>

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
              className="btn-action inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#013a01] text-white text-sm font-semibold hover:bg-[#025201]"
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
              className="btn-action inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-[#228B22] text-[#228B22] text-sm font-semibold hover:bg-[#f4fff4]"
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
                    message: 'Conecte os Contatos Google no botão acima antes de importar.',
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
                ? 'bg-[#f4fff4] text-[#228B22]'
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
