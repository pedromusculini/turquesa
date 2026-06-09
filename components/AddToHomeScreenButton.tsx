'use client';

import { useCallback, useEffect, useState } from 'react';
import { PlusSquare, Share, X } from 'lucide-react';
import { isMobileDevice } from '@/lib/openExternalUrl';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIos = /iPhone|iPad|iPod/i.test(ua);
  const isSafari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
  return isIos && isSafari;
}

function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export default function AddToHomeScreenButton() {
  const [visible, setVisible] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isStandalonePwa() || !isMobileDevice()) return;

    setVisible(true);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    setIosHint(isIosSafari());

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
    };
  }, []);

  const handleClick = useCallback(async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      return;
    }
    setGuideOpen(true);
  }, [deferredPrompt]);

  if (!visible) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => void handleClick()}
        className="inline-flex items-center gap-1.5 rounded-xl border border-[#047482]/20 bg-[#eef4f5] px-3 py-2 text-xs font-semibold text-[#047482] hover:bg-[#D9F0F2] touch-manipulation md:hidden"
        aria-label="Adicionar atalho na tela inicial"
      >
        <PlusSquare className="h-4 w-4 shrink-0" />
        Adicionar atalho
      </button>

      {guideOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-4 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="a2hs-title"
          onClick={() => setGuideOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="a2hs-title" className="text-base font-bold text-gray-900">
                  Adicionar atalho na tela inicial
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Acesse o Turquesa Agenda com um toque, como um app.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setGuideOpen(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {iosHint ? (
              <ol className="mt-4 space-y-3 text-sm text-gray-700">
                <li className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#eef4f5] text-xs font-bold text-[#047482]">
                    1
                  </span>
                  <span>
                    Toque em <strong>Compartilhar</strong>{' '}
                    <Share className="inline h-4 w-4 align-text-bottom text-[#047482]" /> na barra
                    do Safari.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#eef4f5] text-xs font-bold text-[#047482]">
                    2
                  </span>
                  <span>
                    Role e escolha <strong>Adicionar à Tela de Início</strong>.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#eef4f5] text-xs font-bold text-[#047482]">
                    3
                  </span>
                  <span>Confirme em <strong>Adicionar</strong>.</span>
                </li>
              </ol>
            ) : (
              <ol className="mt-4 space-y-3 text-sm text-gray-700">
                <li className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#eef4f5] text-xs font-bold text-[#047482]">
                    1
                  </span>
                  <span>
                    Abra o menu do navegador <strong>(⋮)</strong> no canto superior.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#eef4f5] text-xs font-bold text-[#047482]">
                    2
                  </span>
                  <span>
                    Toque em <strong>Instalar app</strong> ou{' '}
                    <strong>Adicionar à tela inicial</strong>.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#eef4f5] text-xs font-bold text-[#047482]">
                    3
                  </span>
                  <span>Confirme para criar o atalho.</span>
                </li>
              </ol>
            )}

            <button
              type="button"
              onClick={() => setGuideOpen(false)}
              className="mt-5 w-full rounded-xl bg-[#047482] py-3 text-sm font-semibold text-white hover:bg-[#3795a1]"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </>
  );
}
