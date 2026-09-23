'use client';

import { CircleHelp } from 'lucide-react';
import { usePrimeirosPassosTour } from '@/lib/PrimeirosPassosTourContext';

export default function PrimeirosPassosHelpButton({
  variant = 'icon',
}: {
  variant?: 'icon' | 'row';
}) {
  const { startTour, tourActive } = usePrimeirosPassosTour();

  if (variant === 'row') {
    return (
      <button
        type="button"
        onClick={startTour}
        disabled={tourActive}
        className="flex min-h-12 w-full items-center gap-3 px-1 text-left disabled:opacity-50"
        aria-label="Abrir tour de primeiros passos"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-bg-onboarding)] text-[var(--brand-primary)]">
          <CircleHelp className="h-5 w-5" />
        </span>
        <span>
          <span className="block text-sm font-semibold text-[var(--app-text)]">Primeiros passos</span>
          <span className="block text-xs text-[var(--app-muted)]">Tour guiado das telas</span>
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={startTour}
      disabled={tourActive}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--brand-primary)]/25 text-[var(--brand-primary)] transition hover:bg-[var(--brand-bg-onboarding)] disabled:opacity-50"
      title="Primeiros passos"
      aria-label="Abrir tour de primeiros passos"
    >
      <CircleHelp className="h-5 w-5" />
    </button>
  );
}
