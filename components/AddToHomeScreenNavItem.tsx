'use client';

import { Smartphone } from 'lucide-react';
import { useAddToHomeScreen } from '@/lib/useAddToHomeScreen';

export default function AddToHomeScreenNavItem() {
  const { visible, handleInstall } = useAddToHomeScreen();

  if (!visible) return null;

  return (
    <li className="shrink-0">
      <button
        type="button"
        onClick={() => void handleInstall()}
        className="flex min-w-[4.25rem] flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-center text-gray-600 transition hover:bg-white touch-manipulation"
      >
        <Smartphone className="h-5 w-5 text-[#047482]" />
        <span className="text-[10px] font-semibold leading-tight text-[#047482]">Instalar</span>
      </button>
    </li>
  );
}
