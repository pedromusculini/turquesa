'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Copy, Globe, Loader2 } from 'lucide-react';
import { landingUrlOnCurrentOrigin } from '@/lib/salonLanding';

export default function PresencaSalaoCard() {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/presenca/config', { cache: 'no-store', credentials: 'include' });
        const json = await res.json();
        if (cancelled || !res.ok) return;
        const site = json.public?.urls?.site as string | undefined;
        setUrl(site ? landingUrlOnCurrentOrigin(site) : null);
      } catch {
        /* silêncio — card só some o link */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function copiar() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-[#eef4f5] p-2.5 text-[#047482]">
          <Globe className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900">Site do salão</p>
          <p className="mt-0.5 text-sm text-gray-500">
            Página pública com capa, cores, catálogo e agendamento — tudo num link.
          </p>
          {loading ? (
            <p className="mt-2 flex items-center gap-2 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando…
            </p>
          ) : url ? (
            <p className="mt-2 truncate font-mono text-xs text-gray-600">{url}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/dashboard/configuracoes/presenca"
              className="rounded-lg bg-[#047482] px-3 py-2 text-sm font-medium text-white"
            >
              Personalizar
            </Link>
            {url ? (
              <button
                type="button"
                onClick={() => void copiar()}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700"
              >
                <Copy className="h-4 w-4" />
                {copied ? 'Copiado' : 'Copiar link'}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
