'use client';

import { Lightbulb, X } from 'lucide-react';
import { usePrimeirosPassosTour } from '@/lib/PrimeirosPassosTourContext';

type PrimeirosPassosHintProps = {
  hintId: string;
  title: string;
  message: string;
  className?: string;
};

export default function PrimeirosPassosHint({
  hintId,
  title,
  message,
  className = '',
}: PrimeirosPassosHintProps) {
  const { isHintDismissed, dismissHint, tourActive } = usePrimeirosPassosTour();

  if (tourActive || isHintDismissed(hintId)) return null;

  return (
    <div
      className={`mb-4 flex items-start gap-3 rounded-xl border border-[var(--brand-primary)]/20 bg-[var(--brand-bg-onboarding)]/80 px-4 py-3 ${className}`}
      role="note"
    >
      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-primary)]" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        <p className="mt-0.5 text-sm text-gray-600">{message}</p>
      </div>
      <button
        type="button"
        onClick={() => void dismissHint(hintId)}
        className="shrink-0 rounded-lg p-1 text-gray-400 hover:bg-white/80 hover:text-gray-600"
        aria-label="Dispensar dica"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
