'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { ADMIN_API_PREFIX, ADMIN_PANEL_PATH } from '@/lib/constants';
import { InternalShell } from '@/components/InternalOpsClient';

type WebhookEvent = {
  id: string;
  event_type: string;
  owner_email: string | null;
  asaas_payment_id: string | null;
  created_at: string;
};

type AuditRow = {
  id: string;
  admin_email: string;
  action: string;
  target_owner_email: string | null;
  created_at: string;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

export default function InternalMonitorClient() {
  const [webhooks, setWebhooks] = useState<WebhookEvent[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [whRes, auRes] = await Promise.all([
        fetch(`${ADMIN_API_PREFIX}/webhook-events?limit=40`),
        fetch(`${ADMIN_API_PREFIX}/audit-log?limit=40`),
      ]);
      if (whRes.ok) {
        const data = await whRes.json();
        setWebhooks(data.events ?? []);
      }
      if (auRes.ok) {
        const data = await auRes.json();
        setAudit(data.rows ?? []);
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
      title="Monitor operacional"
      subtitle="Webhooks Asaas e auditoria global — sem payloads sensíveis"
      onRefresh={load}
      loading={loading}
    >
      <main className="max-w-[1400px] mx-auto px-4 md:px-8 py-6 space-y-8">
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4 md:p-6">
          <h2 className="text-sm font-bold text-zinc-100 mb-3">Últimos webhooks Asaas</h2>
          {loading ? (
            <Loader2 className="w-6 h-6 animate-spin text-red-500" />
          ) : webhooks.length === 0 ? (
            <p className="text-sm text-zinc-500">Nenhum evento registrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[720px]">
                <thead className="text-zinc-500 border-b border-zinc-800">
                  <tr>
                    <th className="text-left py-2 pr-3">Quando</th>
                    <th className="text-left py-2 pr-3">Evento</th>
                    <th className="text-left py-2 pr-3">Conta</th>
                    <th className="text-left py-2">Payment ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80 text-zinc-300">
                  {webhooks.map((e) => (
                    <tr key={e.id}>
                      <td className="py-2 pr-3 whitespace-nowrap">{formatDate(e.created_at)}</td>
                      <td className="py-2 pr-3 font-mono text-red-200/90">{e.event_type}</td>
                      <td className="py-2 pr-3">
                        {e.owner_email ? (
                          <Link
                            href={`${ADMIN_PANEL_PATH}/tenant/${encodeURIComponent(e.owner_email)}`}
                            className="text-red-400 hover:underline"
                          >
                            {e.owner_email}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-2 font-mono text-zinc-500">{e.asaas_payment_id ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4 md:p-6">
          <h2 className="text-sm font-bold text-zinc-100 mb-3">Auditoria global (admin)</h2>
          {loading ? (
            <Loader2 className="w-6 h-6 animate-spin text-red-500" />
          ) : audit.length === 0 ? (
            <p className="text-sm text-zinc-500">Sem registros.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[800px]">
                <thead className="text-zinc-500 border-b border-zinc-800">
                  <tr>
                    <th className="text-left py-2 pr-3">Quando</th>
                    <th className="text-left py-2 pr-3">Admin</th>
                    <th className="text-left py-2 pr-3">Ação</th>
                    <th className="text-left py-2">Conta alvo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80 text-zinc-300">
                  {audit.map((row) => (
                    <tr key={row.id}>
                      <td className="py-2 pr-3 whitespace-nowrap">{formatDate(row.created_at)}</td>
                      <td className="py-2 pr-3">{row.admin_email}</td>
                      <td className="py-2 pr-3 font-mono">{row.action}</td>
                      <td className="py-2">
                        {row.target_owner_email ? (
                          <Link
                            href={`${ADMIN_PANEL_PATH}/tenant/${encodeURIComponent(row.target_owner_email)}`}
                            className="text-red-400 hover:underline"
                          >
                            {row.target_owner_email}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </InternalShell>
  );
}
