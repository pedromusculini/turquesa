'use client';

import { CircleHelp } from 'lucide-react';
import { usePrimeirosPassosTour } from '@/lib/PrimeirosPassosTourContext';

export default function PrimeirosPassosHelpButton() {
  const { startTour, tourActive } = usePrimeirosPassosTour();

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
