"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import type { ClientesCrmStats } from "@/lib/clientesCrmStats";

export default function ClientesCrmDashboardCard() {
  const [stats, setStats] = useState<ClientesCrmStats | null>(null);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/clientes/crm");
        const data = await res.json();
        if (!res.ok) {
          if (data.code === "DRIVE_NOT_CONNECTED") {
            if (!cancelled) setDriveError(data.error);
          }
          return;
        }
        if (!cancelled && data.stats) setStats(data.stats as ClientesCrmStats);
      } catch {
        /* silencioso no dashboard */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return null;
  if (driveError || !stats) return null;

  return (
    <Link
      href="/clientes/relatorio"
      className="mb-6 flex items-center gap-4 rounded-2xl border border-[#047482]/20 bg-[#eef4f5] p-5 shadow-sm transition hover:border-[#047482]/40 hover:bg-[#e3eff1] group"
    >
      <div className="rounded-xl bg-[#047482] p-3 text-white">
        <BarChart3 className="h-6 w-6" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-[#035e6b]">Relatório de clientes</p>
        <p className="text-sm text-[#047482]/90">
          <span className="font-semibold">{stats.novos_mes}</span> novas este mês
          {stats.variacao_vs_mes_anterior !== 0 && (
            <>
              {" "}
              (
              {stats.variacao_vs_mes_anterior > 0 ? "+" : ""}
              {stats.variacao_vs_mes_anterior} vs mês anterior)
            </>
          )}
          {stats.sem_retorno.total > 0 && (
            <>
              {" "}
              · <span className="font-semibold">{stats.sem_retorno.total}</span> sem retorno
            </>
          )}
        </p>
      </div>
      <span className="shrink-0 text-sm font-semibold text-[#047482] group-hover:translate-x-0.5 transition-transform">
        Ver relatório →
      </span>
    </Link>
  );
}
