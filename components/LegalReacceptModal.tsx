'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { PRIVACY_POLICY_VERSION, TERMS_VERSION } from '@/lib/legal';

export default function LegalReacceptModal() {
  const [visible, setVisible] = useState(false);
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const check = useCallback(async () => {
    try {
      const res = await fetch('/api/legal/consent-status');
      if (!res.ok) return;
      const data = await res.json();
      if (data.needsReaccept === true) setVisible(true);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  async function accept() {
    if (!checked) {
      setError('Marque que leu e concorda com os documentos atualizados.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/legal/accept', { method: 'POST' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || 'Não foi possível registrar o aceite.');
        return;
      }
      setVisible(false);
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
        role="dialog"
        aria-labelledby="legal-reaccept-title"
      >
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-[#eef4f5] p-2">
            <ShieldCheck className="h-6 w-6 text-[#047482]" />
          </div>
          <div>
            <h2 id="legal-reaccept-title" className="text-lg font-bold text-gray-900">
              Termos e Privacidade atualizados
            </h2>
            <p className="mt-2 text-sm text-gray-600 leading-relaxed">
              Atualizamos nossos documentos legais (v. {TERMS_VERSION} /{' '}
              {PRIVACY_POLICY_VERSION}) em conformidade com a LGPD. Para continuar usando o
              Turquesa Agenda, leia e aceite as novas versões.
            </p>
          </div>
        </div>

        <p className="mt-4 text-sm text-gray-600">
          <Link
            href="/termos"
            target="_blank"
            className="font-medium text-[#047482] hover:underline"
          >
            Termos de Uso
          </Link>
          {' · '}
          <Link
            href="/privacidade"
            target="_blank"
            className="font-medium text-[#047482] hover:underline"
          >
            Política de Privacidade
          </Link>
        </p>

        <label className="mt-5 flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-[#047482]"
          />
          <span className="text-sm text-gray-700">
            Li e concordo com os Termos de Uso e a Política de Privacidade vigentes.
          </span>
        </label>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <button
          type="button"
          onClick={() => void accept()}
          disabled={submitting}
          className="mt-5 w-full rounded-xl bg-[#047482] py-3 text-sm font-semibold text-white hover:bg-[#3795a1] disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Aceitar e continuar
        </button>
      </div>
    </div>
  );
}
