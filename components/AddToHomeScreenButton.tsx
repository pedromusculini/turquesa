'use client';

import { PlusSquare, Smartphone } from 'lucide-react';
import { useAddToHomeScreen } from '@/lib/useAddToHomeScreen';

type AddToHomeScreenButtonProps = {
  variant?: 'compact' | 'inline';
};

export default function AddToHomeScreenButton({
  variant = 'compact',
}: AddToHomeScreenButtonProps) {
  const { visible, handleInstall, canNativeInstall, installButtonLabel } = useAddToHomeScreen();

  if (!visible) return null;

  if (variant === 'inline') {
    return (
      <button
        type="button"
        onClick={() => void handleInstall()}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#047482] px-4 py-3 text-sm font-semibold text-white hover:bg-[#3795a1] touch-manipulation"
      >
        <PlusSquare className="h-4 w-4 shrink-0" />
        {installButtonLabel}
      </button>
    );
  }

  return (
    <button
      type="button"
      data-tour="pwa-install"
      onClick={() => void handleInstall()}
      className={`inline-flex h-9 shrink-0 items-center justify-center rounded-xl border border-[#047482]/20 bg-[#eef4f5] text-[#047482] hover:bg-[#D9F0F2] touch-manipulation ${
        canNativeInstall ? 'gap-1.5 px-3' : 'w-9 md:hidden'
      }`}
      aria-label={installButtonLabel}
      title={installButtonLabel}
    >
      <Smartphone className="h-4 w-4 shrink-0" />
      {canNativeInstall && (
        <span className="hidden text-sm font-semibold sm:inline">{installButtonLabel}</span>
      )}
    </button>
  );
}
