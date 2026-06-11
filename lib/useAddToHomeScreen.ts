'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { isMobileDevice } from '@/lib/openExternalUrl';

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const A2HS_DISMISS_KEY = 'turquesa-a2hs-dismissed-v1';

export function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIos = /iPhone|iPad|iPod/i.test(ua);
  const isSafari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
  return isIos && isSafari;
}

export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isA2hsDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(A2HS_DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

export function getInstallButtonLabel(options: {
  canNativeInstall: boolean;
  iosHint: boolean;
}): string {
  if (options.canNativeInstall) return 'Instalar app';
  if (options.iosHint) return 'Como instalar no iPhone';
  return 'Adicionar à tela inicial';
}

export function getInstallCardDescription(options: {
  canNativeInstall: boolean;
  iosHint: boolean;
}): string {
  if (options.canNativeInstall) {
    return 'Instale com um toque — abre direto na agenda, como um app nativo.';
  }
  if (options.iosHint) {
    return 'No Safari, use Compartilhar → Adicionar à Tela de Início para colocar nosso ícone na tela inicial.';
  }
  return 'Adicione à tela inicial para acesso rápido, como um app nativo.';
}

type AddToHomeScreenStore = {
  visible: boolean;
  guideOpen: boolean;
  deferredPrompt: BeforeInstallPromptEvent | null;
  iosHint: boolean;
};

let store: AddToHomeScreenStore = {
  visible: false,
  guideOpen: false,
  deferredPrompt: null,
  iosHint: false,
};

const listeners = new Set<() => void>();
let initialized = false;

function emit() {
  listeners.forEach((listener) => listener());
}

function setStore(patch: Partial<AddToHomeScreenStore>) {
  store = { ...store, ...patch };
  emit();
}

function shouldShowInstallUi(hasDeferredPrompt: boolean): boolean {
  if (isStandalonePwa() || isA2hsDismissed()) return false;
  if (isMobileDevice()) return true;
  return hasDeferredPrompt;
}

function initStore() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  const iosHint = isIosSafari();
  const visible = shouldShowInstallUi(false);
  setStore({ visible, iosHint });

  const onBeforeInstall = (e: Event) => {
    e.preventDefault();
    setStore({
      deferredPrompt: e as BeforeInstallPromptEvent,
      visible: shouldShowInstallUi(true),
    });
  };

  const onAppInstalled = () => {
    setStore({ visible: false, deferredPrompt: null, guideOpen: false });
  };

  window.addEventListener('beforeinstallprompt', onBeforeInstall);
  window.addEventListener('appinstalled', onAppInstalled);
}

function subscribe(listener: () => void) {
  initStore();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return store;
}

function getServerSnapshot(): AddToHomeScreenStore {
  return {
    visible: false,
    guideOpen: false,
    deferredPrompt: null,
    iosHint: false,
  };
}

export function useAddToHomeScreen() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const handleInstall = useCallback(async () => {
    if (state.deferredPrompt) {
      await state.deferredPrompt.prompt();
      const choice = await state.deferredPrompt.userChoice;
      setStore({ deferredPrompt: null });
      if (choice.outcome === 'accepted') {
        setStore({ visible: false, guideOpen: false });
      }
      return;
    }
    setStore({ guideOpen: true });
  }, [state.deferredPrompt]);

  const setGuideOpen = useCallback((open: boolean) => {
    setStore({ guideOpen: open });
  }, []);

  const dismiss = useCallback(() => {
    try {
      window.localStorage.setItem(A2HS_DISMISS_KEY, '1');
    } catch {
      /* ignore quota / private mode */
    }
    setStore({ visible: false, guideOpen: false });
  }, []);

  const canNativeInstall = !!state.deferredPrompt;

  return {
    visible: state.visible,
    guideOpen: state.guideOpen,
    setGuideOpen,
    iosHint: state.iosHint,
    handleInstall,
    dismiss,
    canNativeInstall,
    installButtonLabel: getInstallButtonLabel({
      canNativeInstall,
      iosHint: state.iosHint,
    }),
    installCardDescription: getInstallCardDescription({
      canNativeInstall,
      iosHint: state.iosHint,
    }),
  };
}
