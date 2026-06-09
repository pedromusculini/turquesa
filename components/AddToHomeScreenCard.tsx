'use client';

import { Smartphone } from 'lucide-react';
import { useAddToHomeScreen } from '@/lib/useAddToHomeScreen';

export default function AddToHomeScreenCard() {
  const { visible, handleInstall, canNativeInstall } = useAddToHomeScreen();

  if (!visible) return null;

  return (
    <section
        className="mb-6 md:hidden rounded-2xl border border-[#047482]/25 bg-gradient-to-br from-[#eef4f5] via-white to-[#F8FAFC] p-4 shadow-sm"
        aria-label="Instalar aplicativo"
      >
        <div className="flex items-start gap-3.5">
          <img
            src="/apple-icon.png"
            alt=""
            width={56}
            height={56}
            className="h-14 w-14 shrink-0 rounded-2xl shadow-md ring-1 ring-[#047482]/10"
          />
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-gray-900">Instalar Turquesa Agenda</h2>
            <p className="mt-0.5 text-sm text-gray-600">
              Adicione à tela inicial e use como um app nativo — com nosso ícone.
            </p>
            <button
              type="button"
              onClick={() => void handleInstall()}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#047482] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#3795a1] touch-manipulation"
            >
              <Smartphone className="h-4 w-4 shrink-0" />
              {canNativeInstall ? 'Instalar app' : 'Adicionar à tela inicial'}
            </button>
          </div>
        </div>
    </section>
  );
}
