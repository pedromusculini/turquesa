'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, MonitorDown, Share, Smartphone } from 'lucide-react';
import { BRAND } from '@/lib/visual/brand';
import { isMobileDevice } from '@/lib/openExternalUrl';
import {
  getInstallButtonLabel,
  getInstallCardDescription,
  isStandalonePwa,
  useAddToHomeScreen,
} from '@/lib/useAddToHomeScreen';

const { colors: C, productName, tagline } = BRAND;

type Platform = 'ios' | 'android' | 'desktop' | 'installed';

function detectPlatform(iosHint: boolean): Platform {
  if (isStandalonePwa()) return 'installed';
  if (iosHint) return 'ios';
  if (isMobileDevice()) return 'android';
  return 'desktop';
}

function StepList({ children }: { children: React.ReactNode }) {
  return <ol className="mt-6 space-y-3 text-sm text-gray-700">{children}</ol>;
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#eef4f5] text-xs font-bold text-[#047482]">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}

export default function InstalarAppClient() {
  const [mounted, setMounted] = useState(false);
  const { canNativeInstall, iosHint, handleInstall } = useAddToHomeScreen();

  useEffect(() => {
    setMounted(true);
  }, []);

  const platform = mounted ? detectPlatform(iosHint) : null;
  const installButtonLabel = getInstallButtonLabel({ canNativeInstall, iosHint });
  const installDescription = getInstallCardDescription({ canNativeInstall, iosHint });

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ backgroundColor: C.bgPage }}
    >
      <div className="relative z-10 isolate max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 sm:p-10">
        <div className="text-center mb-8">
          <img
            src="/apple-icon.png"
            alt=""
            width={72}
            height={72}
            className="mx-auto h-[4.5rem] w-[4.5rem] rounded-2xl shadow-md ring-1 ring-[#047482]/10 mb-4"
          />
          <h1 className="text-3xl font-bold text-gray-900">Instalar {productName}</h1>
          <p className="text-gray-600 mt-2">{tagline}</p>
        </div>

        {!mounted ? (
          <p className="text-center text-sm text-gray-500">Carregando...</p>
        ) : platform === 'installed' ? (
          <div className="rounded-2xl border border-[#047482]/25 bg-[#eef4f5] p-5 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-[#047482] mb-3" />
            <p className="font-semibold text-gray-900">App já instalado</p>
            <p className="mt-1 text-sm text-gray-600">
              O Turquesa Agenda já está na sua tela inicial ou como app no computador.
            </p>
            <Link
              href="/dashboard"
              className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-[#047482] px-4 py-3 text-sm font-semibold text-white hover:bg-[#3795a1]"
            >
              Abrir agenda
            </Link>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-600 text-center leading-relaxed">{installDescription}</p>

            {canNativeInstall && (
              <button
                type="button"
                onClick={() => void handleInstall()}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#047482] px-4 py-3.5 text-sm font-semibold text-white hover:bg-[#3795a1] touch-manipulation"
              >
                <Smartphone className="h-4 w-4 shrink-0" />
                {installButtonLabel}
              </button>
            )}

            {platform === 'ios' && (
              <>
                <p className="mt-6 text-sm font-medium text-gray-900">No Safari do iPhone ou iPad:</p>
                <StepList>
                  <Step n={1}>
                    Toque em <strong>Compartilhar</strong>{' '}
                    <Share className="inline h-4 w-4 align-text-bottom text-[#047482]" /> na barra
                    inferior.
                  </Step>
                  <Step n={2}>
                    Role e toque em <strong>Adicionar à Tela de Início</strong>.
                  </Step>
                  <Step n={3}>
                    Confirme em <strong>Adicionar</strong> — o ícone aparecerá na tela inicial.
                  </Step>
                </StepList>
                <p className="mt-4 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  Use o <strong>Safari</strong>. No Chrome do iPhone a instalação não funciona da
                  mesma forma — abra este link no Safari.
                </p>
              </>
            )}

            {platform === 'android' && !canNativeInstall && (
              <>
                <p className="mt-6 text-sm font-medium text-gray-900">No Chrome do Android:</p>
                <StepList>
                  <Step n={1}>
                    Abra o menu do navegador <strong>(⋮)</strong> no canto superior direito.
                  </Step>
                  <Step n={2}>
                    Toque em <strong>Instalar app</strong> ou{' '}
                    <strong>Adicionar à tela inicial</strong>.
                  </Step>
                  <Step n={3}>Confirme para criar o atalho com o ícone do Turquesa.</Step>
                </StepList>
              </>
            )}

            {platform === 'desktop' && (
              <>
                <p className="mt-6 text-sm font-medium text-gray-900 flex items-center gap-2">
                  <MonitorDown className="h-4 w-4 text-[#047482]" />
                  No Chrome ou Edge do computador:
                </p>
                <StepList>
                  <Step n={1}>
                    Procure o ícone de instalar <strong>(⊕ ou computador)</strong> na barra de
                    endereço, à direita da URL.
                  </Step>
                  <Step n={2}>
                    Clique em <strong>Instalar</strong> ou <strong>Instalar Turquesa Agenda</strong>.
                  </Step>
                  <Step n={3}>
                    O app abrirá em janela própria — use o atalho no menu Iniciar ou na barra de
                    tarefas.
                  </Step>
                </StepList>
                {!canNativeInstall && (
                  <p className="mt-4 text-xs text-gray-500">
                    Se o ícone não aparecer, abra o menu do navegador (⋮) e procure{' '}
                    <strong>Instalar Turquesa Agenda</strong> ou{' '}
                    <strong>Salvar e compartilhar → Instalar página como app</strong>.
                  </p>
                )}
              </>
            )}
          </>
        )}

        <div className="mt-8 pt-6 border-t border-gray-100 text-center">
          <p className="text-sm text-gray-500 mb-3">Ainda não tem conta?</p>
          <Link
            href="/login"
            className="text-sm font-semibold hover:underline"
            style={{ color: C.primaryHover }}
          >
            Entrar com Google
          </Link>
        </div>
      </div>
    </div>
  );
}
