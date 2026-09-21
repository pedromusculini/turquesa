'use client';

import Link from 'next/link';
import { BookOpen, ArrowRight } from 'lucide-react';

export default function GuiaFuncionalidadesCard() {
  return (
    <Link
      href="/dashboard/guia"
      data-tour="guia-funcionalidades"
      className="mb-4 flex items-center gap-3 rounded-2xl border border-[var(--brand-primary)]/20 bg-[var(--brand-bg-onboarding)]/50 p-4 shadow-sm transition hover:border-[var(--brand-primary)]/40 hover:shadow-md group sm:mb-6 sm:gap-4 sm:p-5"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
        <BookOpen className="h-6 w-6 text-[var(--brand-primary)]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-gray-900">Guia de funcionalidades</p>
        <p className="hidden text-sm text-gray-600 sm:block">
          Todas as features do sistema e como configurar — agenda, financeiro, WhatsApp, Google e mais.
        </p>
        <p className="text-sm text-gray-600 sm:hidden">Como usar agenda, WhatsApp e Google</p>
      </div>
      <ArrowRight className="h-5 w-5 shrink-0 text-[var(--brand-primary)] opacity-70 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
    </Link>
  );
}
