'use client';

import Link from 'next/link';
import { BookOpen } from 'lucide-react';

export default function GuiaFuncionalidadesHeaderButton() {
  return (
    <Link
      href="/dashboard/guia"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-gray-600 transition hover:border-[var(--brand-primary)]/25 hover:bg-[var(--brand-bg-onboarding)] hover:text-[var(--brand-primary)]"
      title="Guia de funcionalidades"
      aria-label="Abrir guia de funcionalidades"
    >
      <BookOpen className="h-5 w-5" />
    </Link>
  );
}
