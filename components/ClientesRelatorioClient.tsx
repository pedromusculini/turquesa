'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BarChart3, Loader2, Users } from 'lucide-react';
import ClientesCrmInsights from '@/components/ClientesCrmInsights';
import GoogleConnectionAlert from '@/components/GoogleConnectionAlert';
import type { ClientesCrmStats } from '@/lib/clientesCrmStats';

export default function ClientesRelatorioClient() {
  const router = useRouter();
  const [stats, setStats] = useState<ClientesCrmStats | null>(null);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/clientes/crm');
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'DRIVE_NOT_CONNECTED') setDriveError(data.error);
        throw new Error(data.error || 'Erro ao carregar relatório');
      }
      setDriveError(null);
      setStats(data.stats as ClientesCrmStats);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  function connectDrive() {
    const redirect = encodeURIComponent('/clientes/relatorio');
    window.location.href = `/api/auth/google-authorize?scope=drive&redirect=${redirect}`;
  }

  return (
    <div className="mx-auto max-w-[1200px] p-6 lg:p-8">
      <GoogleConnectionAlert
        context="clientes"
        redirectPath="/clientes/relatorio"
        className="mb-6"
      />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <BarChart3 className="h-7 w-7 text-[#047482]" aria-hidden />
            Relatório de clientes
          </h1>
          <p className="mt-1 text-gray-500">
            Novos cadastros, origem e quem está sumida — para cuidar da base com calma
          </p>
        </div>
        <Link
          href="/clientes"
          className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-[#047482]/30 bg-[#eef4f5] px-4 py-2.5 text-sm font-medium text-[#047482] hover:bg-[#e3eff1] transition"
        >
          <Users className="h-4 w-4" aria-hidden />
          Ir para cadastros
        </Link>
      </div>

      {driveError && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="font-medium text-amber-900">Google Drive não conectado</p>
          <p className="mt-1 text-sm text-amber-800">{driveError}</p>
          <button
            type="button"
            onClick={connectDrive}
            className="mt-3 rounded-lg bg-[#047482] px-4 py-2 text-sm font-medium text-white"
          >
            Conectar Drive
          </button>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          Carregando relatório…
        </div>
      )}

      {!loading && error && !driveError && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      {!loading && stats && (
        <ClientesCrmInsights
          stats={stats}
          onSelectCliente={(id) => router.push(`/clientes?cliente=${encodeURIComponent(id)}`)}
        />
      )}
    </div>
  );
}
