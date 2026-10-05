'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { formatCurrency } from '@/lib/constants';
import { fetchAtivacao, type AtivacaoResponse } from '@/lib/ativacaoClient';

/** A partir de quantos dias restantes o resumo do teste aparece no painel. */
const DIAS_PARA_MOSTRAR = 7;

/** Resumo do que o salão fez no teste + convite para assinar, antes do bloqueio. */
export default function TrialResumoCard() {
  const [data, setData] = useState<AtivacaoResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchAtivacao().then((d) => {
      if (!cancelled) setData(d);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const sub = data?.subscription;
  if (!sub || sub.status !== 'trial' || sub.daysLeftTrial == null) return null;
  if (sub.daysLeftTrial > DIAS_PARA_MOSTRAR) return null;

  const { resumo } = data;
  const dias = Math.max(0, sub.daysLeftTrial);
  const itens = [
    { valor: String(resumo.sessoes), label: resumo.sessoes === 1 ? 'sessão na agenda' : 'sessões na agenda' },
    {
      valor: String(resumo.agendamentosPeloLink),
      label: 'marcadas pelo link',
    },
    { valor: formatCurrency(resumo.entradas), label: 'registrados no financeiro' },
  ];

  return (
    <div className="mb-5 rounded-2xl border border-[#c69c6c]/50 bg-gradient-to-br from-[#fff8ef] to-white p-4 sm:p-5">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#8a6a3f]">
        <Sparkles className="h-4 w-4" aria-hidden />
        {dias === 0 ? 'Último dia de teste' : `Faltam ${dias} dia${dias === 1 ? '' : 's'} de teste`}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-900">Seu salão no Turquesa até agora</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {itens.map((i) => (
          <div key={i.label} className="rounded-xl bg-white p-2.5 text-center shadow-sm ring-1 ring-black/5">
            <p className="text-base font-bold text-[#047482] sm:text-lg">{i.valor}</p>
            <p className="mt-0.5 text-[11px] leading-tight text-slate-500">{i.label}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-600">
        Assine agora para não perder o ritmo — a agenda e as fichas continuam no seu Google. No anual
        você ganha 2 meses.
      </p>
      <Link
        href="/dashboard/conta"
        className="mt-3 flex min-h-11 w-full items-center justify-center rounded-xl bg-[#047482] text-sm font-semibold text-white hover:opacity-90"
      >
        Ver planos e assinar
      </Link>
    </div>
  );
}
