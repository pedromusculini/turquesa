'use client';

import { Share, X } from 'lucide-react';

type AddToHomeScreenGuideProps = {
  open: boolean;
  iosHint: boolean;
  onClose: () => void;
};

export default function AddToHomeScreenGuide({
  open,
  iosHint,
  onClose,
}: AddToHomeScreenGuideProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-4 md:hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="a2hs-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="a2hs-title" className="text-base font-bold text-gray-900">
              Adicionar à tela inicial
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Acesse o Turquesa Agenda com um toque, como um app nativo.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
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
                <Share className="inline h-4 w-4 align-text-bottom text-[#047482]" /> na barra do
                Safari.
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
              <span>
                Confirme em <strong>Adicionar</strong> — o ícone do Turquesa aparecerá na tela
                inicial.
              </span>
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
              <span>Confirme para criar o atalho com o ícone do Turquesa.</span>
            </li>
          </ol>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-xl bg-[#047482] py-3 text-sm font-semibold text-white hover:bg-[#3795a1]"
        >
          Entendi
        </button>
      </div>
    </div>
  );
}
