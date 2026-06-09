'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { isMobileDevice } from '@/lib/openExternalUrl';

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

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

function initStore() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  if (isStandalonePwa() || !isMobileDevice()) return;

  setStore({ visible: true, iosHint: isIosSafari() });

  const onBeforeInstall = (e: Event) => {
    e.preventDefault();
    setStore({ deferredPrompt: e as BeforeInstallPromptEvent });
  };

  window.addEventListener('beforeinstallprompt', onBeforeInstall);
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
      await state.deferredPrompt.userChoice;
      setStore({ deferredPrompt: null });
      return;
    }
    setStore({ guideOpen: true });
  }, [state.deferredPrompt]);

  const setGuideOpen = useCallback((open: boolean) => {
    setStore({ guideOpen: open });
  }, []);

  return {
    visible: state.visible,
    guideOpen: state.guideOpen,
    setGuideOpen,
    iosHint: state.iosHint,
    handleInstall,
    canNativeInstall: !!state.deferredPrompt,
  };
}
