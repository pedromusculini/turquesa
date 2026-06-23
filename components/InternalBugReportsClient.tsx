'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { ADMIN_API_PREFIX, ADMIN_PANEL_PATH } from '@/lib/constants';
import { InternalShell } from '@/components/InternalOpsClient';

type BugReport = {
  id: string;
  reporter_email: string;
  description: string;
  page_url: string | null;
  created_at: string;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

export default function InternalBugReportsClient() {
  const [reports, setReports] = useState<BugReport[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${ADMIN_API_PREFIX}/bug-reports?limit=50`);
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports ?? []);
        setTotal(data.total ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <InternalShell
      title="Relatos de bug"
      subtitle={`${total} registro(s) — metadados do formulário in-app`}
      onRefresh={load}
      loading={loading}
    >
      <main className="max-w-[1400px] mx-auto px-4 md:px-8 py-6 space-y-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-red-500" />
          </div>
        ) : reports.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-12">Nenhum relato ainda.</p>
        ) : (
          <ul className="space-y-3">
            {reports.map((r) => (
              <li
                key={r.id}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4 md:p-5 text-sm space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={`${ADMIN_PANEL_PATH}/tenant/${encodeURIComponent(r.reporter_email)}`}
                    className="font-semibold text-red-300 hover:underline"
                  >
                    {r.reporter_email}
                  </Link>
                  <time className="text-xs text-zinc-500">{formatDate(r.created_at)}</time>
                </div>
                {r.page_url && (
                  <p className="text-xs text-zinc-500 break-all">
                    Página: <span className="text-zinc-400">{r.page_url}</span>
                  </p>
                )}
                <p className="text-zinc-300 whitespace-pre-wrap leading-relaxed">{r.description}</p>
              </li>
            ))}
          </ul>
        )}
      </main>
    </InternalShell>
  );
}
