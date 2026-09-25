'use client';

import { useEffect, useState } from 'react';
import { Package } from 'lucide-react';
import type { ClientePacote } from '@/lib/types';

function restantes(p: ClientePacote): number {
  return Math.max(0, p.sessoes_total - p.usos.length);
}

function disponivel(p: ClientePacote): boolean {
  const hoje = new Date().toISOString().slice(0, 10);
  return p.status === 'ativo' && restantes(p) > 0 && !(p.validade && p.validade < hoje);
}

/**
 * Lista pacotes com saldo da cliente. Selecionar um = sessão paga pelo pacote (valor 0, sem
 * nova entrada no financeiro). Some quando a cliente não tem pacote disponível.
 */
export default function PacoteSessaoSelector({
  clienteId,
  pacotes: pacotesProp,
  value,
  onChange,
  disabled,
}: {
  clienteId?: string | null;
  pacotes?: ClientePacote[];
  value: string | null;
  onChange: (pacoteId: string | null) => void;
  disabled?: boolean;
}) {
  const [fetched, setFetched] = useState<ClientePacote[]>([]);

  useEffect(() => {
    if (pacotesProp || !clienteId) return;
    let cancelled = false;
    fetch(`/api/clientes/${encodeURIComponent(clienteId)}/pacotes`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && Array.isArray(d?.pacotes)) setFetched(d.pacotes);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [clienteId, pacotesProp]);

  const lista = (pacotesProp ?? fetched).filter(disponivel);
  if (lista.length === 0) return null;

  return (
    <div className="rounded-xl border border-[#047482]/30 bg-[#eef4f5] p-3">
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900">
        <Package className="h-4 w-4 text-[#047482]" aria-hidden />
        Cliente tem pacote
      </p>
      <div className="space-y-1.5">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="radio"
            name="pacote-sessao"
            checked={value == null}
            onChange={() => onChange(null)}
            disabled={disabled}
          />
          Cobrar normalmente
        </label>
        {lista.map((p) => (
          <label key={p.id} className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="radio"
              name="pacote-sessao"
              checked={value === p.id}
              onChange={() => onChange(p.id)}
              disabled={disabled}
            />
            <span>
              Usar sessão de <strong>{p.nome}</strong> — restam {restantes(p)} de {p.sessoes_total}
            </span>
          </label>
        ))}
      </div>
      {value && (
        <p className="mt-2 text-xs text-gray-600">
          Sessão já paga no pacote: valor R$ 0 e sem nova entrada no financeiro.
        </p>
      )}
    </div>
  );
}
