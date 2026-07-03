'use client';

import { useEffect } from 'react';

/** Trava o scroll do body enquanto um modal/sheet está aberto (mobile). */
export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked || typeof document === 'undefined') return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [locked]);
}

/** Classes padrão de overlay mobile-friendly (sem backdrop-blur). */
export const MOBILE_MODAL_OVERLAY =
  'fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4';

export const MOBILE_MODAL_SHEET =
  'w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl max-h-[92dvh] overflow-y-auto overscroll-contain pb-[max(1.5rem,env(safe-area-inset-bottom))]';
