'use client';

import { useEffect, useState } from 'react';
import { Bug, Loader2, X } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { ADMIN_PANEL_PATH } from '@/lib/constants';

export default function ReportarBugButton() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [reporterEmail, setReporterEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const isInternalOps =
    pathname === ADMIN_PANEL_PATH || pathname?.startsWith(`${ADMIN_PANEL_PATH}/`);
  const sessionEmail = session?.user?.email?.toLowerCase().trim() ?? '';
  const showEmailField = status !== 'authenticated' || !sessionEmail;

  useEffect(() => {
    if (sessionEmail) setReporterEmail(sessionEmail);
  }, [sessionEmail]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  if (isInternalOps) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);

    const email = (sessionEmail || reporterEmail).trim().toLowerCase();
    if (!email) {
      setFeedback({ type: 'err', text: 'Informe seu e-mail para contato.' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/bug-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          description,
          reporterEmail: email,
          pageUrl: typeof window !== 'undefined' ? window.location.href : undefined,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 202) {
        setFeedback({
          type: 'err',
          text: typeof data.error === 'string' ? data.error : 'Não foi possível enviar.',
        });
        return;
      }
      setFeedback({
        type: 'ok',
        text:
          typeof data.message === 'string'
            ? data.message
            : 'Relatório registrado. Obrigado!',
      });
      setDescription('');
      if (!sessionEmail) setReporterEmail('');
    } catch {
      setFeedback({ type: 'err', text: 'Falha de conexão. Tente novamente.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setFeedback(null);
        }}
        className="fixed bottom-5 right-4 z-[90] inline-flex items-center gap-2 rounded-full border border-[#047482]/30 bg-white px-4 py-2.5 text-sm font-semibold text-[#047482] shadow-lg shadow-gray-900/10 hover:bg-[#047482]/5 transition pointer-events-auto"
        aria-label="Reportar problema"
        title="Reportar problema"
      >
        <Bug className="h-4 w-4 shrink-0" aria-hidden />
        <span className="hidden sm:inline">Reportar problema</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-4 bg-black/40"
          role="presentation"
          onClick={() => !submitting && setOpen(false)}
        >
          <div
            role="dialog"
            aria-labelledby="reportar-problema-title"
            aria-modal="true"
            className="w-full max-w-lg rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
              <div>
                <h2 id="reportar-problema-title" className="text-lg font-semibold text-gray-900">
                  Reportar problema
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Descreva o que aconteceu. Enviaremos ao time com seu e-mail de contato.
                </p>
              </div>
              <button
                type="button"
                onClick={() => !submitting && setOpen(false)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
              {showEmailField && (
                <div>
                  <label htmlFor="bug-reporter-email" className="block text-sm font-medium text-gray-700 mb-1">
                    Seu e-mail
                  </label>
                  <input
                    id="bug-reporter-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={reporterEmail}
                    onChange={(e) => setReporterEmail(e.target.value)}
                    placeholder="voce@exemplo.com"
                    className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-[#047482] focus:outline-none focus:ring-2 focus:ring-[#047482]/20"
                  />
                </div>
              )}

              {!showEmailField && sessionEmail && (
                <p className="text-sm text-gray-600">
                  Enviando como <strong>{sessionEmail}</strong>
                </p>
              )}

              <div>
                <label htmlFor="bug-description" className="block text-sm font-medium text-gray-700 mb-1">
                  O que deu errado?
                </label>
                <textarea
                  id="bug-description"
                  required
                  minLength={10}
                  maxLength={5000}
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex.: Ao clicar em Salvar na agenda, aparece erro…"
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm resize-y focus:border-[#047482] focus:outline-none focus:ring-2 focus:ring-[#047482]/20"
                />
              </div>

              {feedback && (
                <p
                  className={`text-sm rounded-xl px-3 py-2 ${
                    feedback.type === 'ok'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}
                >
                  {feedback.text}
                </p>
              )}

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={submitting}
                  className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#047482] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#035e6b] disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      Enviando…
                    </>
                  ) : (
                    'Enviar relatório'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
