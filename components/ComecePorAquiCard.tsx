'use client';

import Link from 'next/link';
import { BookOpen, Calendar, Clock, X } from 'lucide-react';
import { usePrimeirosPassosTour } from '@/lib/PrimeirosPassosTourContext';

const STEPS = [
  {
    href: '/dashboard/catalogo',
    icon: BookOpen,
    title: 'Cadastre os serviços',
    detail: 'Nome, preço e duração. Sem isso a agenda não abre horários.',
  },
  {
    href: '/dashboard/configuracoes',
    icon: Clock,
    title: 'Defina os horários',
    detail: 'Dias e intervalos em que o salão atende.',
  },
  {
    href: '/agenda',
    icon: Calendar,
    title: 'Marque a primeira sessão',
    detail: 'Com serviço e horário prontos, use a grade da agenda.',
  },
] as const;

/** Checklist curto no dashboard para o salão configurar o sistema de verdade. */
export default function ComecePorAquiCard() {
  const { isHintDismissed, dismissHint, tourActive } = usePrimeirosPassosTour();

  if (tourActive || isHintDismissed('hint-comece-por-aqui')) return null;

  return (
    <div className="mb-6 rounded-2xl border border-[#047482]/20 bg-[#eef4f5] p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#047482]">
            Comece por aqui
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Três passos para o sistema funcionar no dia a dia.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void dismissHint('hint-comece-por-aqui')}
          className="shrink-0 rounded-lg p-1 text-gray-400 hover:bg-white/80 hover:text-gray-600"
          aria-label="Dispensar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <ol className="space-y-2">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          return (
            <li key={step.href}>
              <Link
                href={step.href}
                className="flex items-start gap-3 rounded-xl bg-white px-3 py-3 shadow-sm ring-1 ring-black/5 transition hover:ring-[#047482]/30"
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#047482] text-xs font-bold text-white">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                    <Icon className="h-4 w-4 text-[#047482]" aria-hidden />
                    {step.title}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">{step.detail}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
