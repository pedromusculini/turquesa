'use client';

import { Smartphone, X } from 'lucide-react';
import { useAddToHomeScreen } from '@/lib/useAddToHomeScreen';

export default function AddToHomeScreenCard() {
  const { visible, handleInstall, dismiss, canNativeInstall, installButtonLabel, installCardDescription } =
    useAddToHomeScreen();

  if (!visible) return null;

  return (
    <section
      data-tour="pwa-install"
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
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-base font-bold text-gray-900">Instalar Turquesa Agenda</h2>
            <button
              type="button"
              onClick={dismiss}
              className="shrink-0 rounded-lg p-1 text-gray-400 hover:bg-gray-100 touch-manipulation"
              aria-label="Fechar aviso de instalação"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-0.5 text-sm text-gray-600">{installCardDescription}</p>
          <button
            type="button"
            onClick={() => void handleInstall()}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#047482] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#3795a1] touch-manipulation"
          >
            <Smartphone className="h-4 w-4 shrink-0" />
            {installButtonLabel}
          </button>
          {!canNativeInstall && (
            <button
              type="button"
              onClick={dismiss}
              className="mt-2 w-full text-center text-xs text-gray-500 hover:text-gray-700 touch-manipulation"
            >
              Agora não
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
