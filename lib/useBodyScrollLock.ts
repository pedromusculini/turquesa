'use client';

import { useEffect } from 'react';

/**
 * Lock de scroll do body com contagem de referências.
 * Vários modais/confirms abertos ao mesmo tempo não deixam overflow:hidden
 * órfão ao fechar (bug clássico de freeze no mobile/PWA).
 */
let lockCount = 0;
let savedOverflow = '';
let savedTouchAction = '';
let savedScrollY = 0;

function applyLock() {
  if (typeof document === 'undefined') return;
  const body = document.body;
  savedOverflow = body.style.overflow;
  savedTouchAction = body.style.touchAction;
  savedScrollY = window.scrollY || window.pageYOffset || 0;
  body.style.overflow = 'hidden';
  // Reduz “scroll fantasma” atrás do modal no iOS / PWA standalone.
  body.style.touchAction = 'none';
}

function releaseLock() {
  if (typeof document === 'undefined') return;
  const body = document.body;
  body.style.overflow = savedOverflow;
  body.style.touchAction = savedTouchAction;
  window.scrollTo(0, savedScrollY);
  savedOverflow = '';
  savedTouchAction = '';
  savedScrollY = 0;
}

/** Incremental: cada caller deve liberar exatamente uma vez. */
export function acquireBodyScrollLock(): () => void {
  if (typeof document === 'undefined') return () => {};
  if (lockCount === 0) applyLock();
  lockCount += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0) releaseLock();
  };
}

/**
 * Força liberação total (ex.: troca de rota no AppShell).
 * Usa quando um modal pode ter desmontado sem cleanup (navegação rápida).
 */
export function forceUnlockBodyScroll() {
  if (typeof document === 'undefined') return;
  lockCount = 0;
  const body = document.body;
  body.style.overflow = '';
  body.style.touchAction = '';
}

/** Trava o scroll do body enquanto `locked` é true. */
export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    return acquireBodyScrollLock();
  }, [locked]);
}

/** Classes padrão de overlay mobile-friendly (sem backdrop-blur). */
export const MOBILE_MODAL_OVERLAY =
  'fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4';

export const MOBILE_MODAL_SHEET =
  'w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl max-h-[92dvh] overflow-y-auto overscroll-contain pb-[max(1.5rem,env(safe-area-inset-bottom))]';
