'use client';

import { Map } from 'lucide-react';
import { usePrimeirosPassosTour } from '@/lib/PrimeirosPassosTourContext';

type VerTourNovamenteButtonProps = {
  variant?: 'button' | 'link';
  className?: string;
};

export default function VerTourNovamenteButton({
  variant = 'button',
  className = '',
}: VerTourNovamenteButtonProps) {
  const { startTour } = usePrimeirosPassosTour();

  if (variant === 'link') {
    return (
      <button
        type="button"
        onClick={startTour}
        className={`inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand-primary)] hover:underline ${className}`}
      >
        <Map className="h-4 w-4" />
        Ver tour novamente
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={startTour}
      className={`inline-flex items-center gap-2 rounded-xl border border-[var(--brand-primary)]/30 bg-white px-4 py-2.5 text-sm font-semibold text-[var(--brand-primary)] transition hover:bg-[var(--brand-bg-onboarding)] ${className}`}
    >
      <Map className="h-4 w-4" />
      Ver tour novamente
    </button>
  );
}
