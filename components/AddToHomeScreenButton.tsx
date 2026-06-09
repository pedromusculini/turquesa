'use client';

import { PlusSquare, Smartphone } from 'lucide-react';
import { useAddToHomeScreen } from '@/lib/useAddToHomeScreen';

type AddToHomeScreenButtonProps = {
  variant?: 'compact' | 'inline';
};

export default function AddToHomeScreenButton({
  variant = 'compact',
}: AddToHomeScreenButtonProps) {
  const { visible, handleInstall } = useAddToHomeScreen();

  if (!visible) return null;

  if (variant === 'inline') {
    return (
      <button
        type="button"
        onClick={() => void handleInstall()}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#047482] px-4 py-3 text-sm font-semibold text-white hover:bg-[#3795a1] touch-manipulation"
      >
        <PlusSquare className="h-4 w-4 shrink-0" />
        Adicionar à tela inicial
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void handleInstall()}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#047482]/20 bg-[#eef4f5] text-[#047482] hover:bg-[#D9F0F2] touch-manipulation md:hidden"
      aria-label="Instalar app na tela inicial"
      title="Instalar app"
    >
      <Smartphone className="h-4 w-4 shrink-0" />
    </button>
  );
}
