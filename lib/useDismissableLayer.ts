'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';

/** Android: pointerup do toque de abertura pode chegar depois do listener externo. */
export const DISMISS_SUPPRESS_MS = 400;
export const DISMISS_LISTENER_DELAY_MS = 50;
const TAP_MOVE_THRESHOLD_SQ = 144;

type CoarseListener = (coarse: boolean) => void;

let coarseMq: MediaQueryList | null = null;
let coarseValue = false;
const coarseListeners = new Set<CoarseListener>();

function syncCoarseFromMq(): void {
  if (!coarseMq) return;
  coarseValue = coarseMq.matches;
  for (const listener of coarseListeners) listener(coarseValue);
}

function ensureCoarseMq(): void {
  if (typeof window === 'undefined' || coarseMq) return;
  coarseMq = window.matchMedia('(pointer: coarse)');
  syncCoarseFromMq();
  coarseMq.addEventListener('change', syncCoarseFromMq);
}

/** Atualiza quando o usuário alterna mouse ↔ touch (Surface, iPad, etc.). */
export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(() => {
    if (typeof window === 'undefined') return false;
    ensureCoarseMq();
    return coarseValue;
  });

  useEffect(() => {
    ensureCoarseMq();
    setCoarse(coarseValue);
    coarseListeners.add(setCoarse);
    return () => {
      coarseListeners.delete(setCoarse);
    };
  }, []);

  return coarse;
}

export type DismissableLayerConfig = {
  open: boolean;
  onClose: () => void;
  rootRef: RefObject<HTMLElement | null>;
  floatingRef?: RefObject<HTMLElement | null>;
  /** Gesto iniciado dentro do painel (ex.: opção da lista). */
  isPickingRef?: RefObject<boolean>;
};

export function useDismissableLayer({
  open,
  onClose,
  rootRef,
  floatingRef,
  isPickingRef,
}: DismissableLayerConfig) {
  const coarsePointer = useCoarsePointer();
  const suppressUntilRef = useRef(0);
  const openingPointerIdsRef = useRef(new Set<number>());

  const markJustOpened = useCallback((pointerId?: number) => {
    suppressUntilRef.current = Date.now() + DISMISS_SUPPRESS_MS;
    if (pointerId === undefined) return;
    openingPointerIdsRef.current.add(pointerId);
    window.setTimeout(() => {
      openingPointerIdsRef.current.delete(pointerId);
    }, DISMISS_SUPPRESS_MS + 100);
  }, []);

  const shouldIgnoreOutsideClose = useCallback((e: PointerEvent | MouseEvent) => {
    if (Date.now() < suppressUntilRef.current) return true;
    if ('pointerId' in e && openingPointerIdsRef.current.has(e.pointerId)) return true;
    return false;
  }, []);

  const isInside = useCallback(
    (target: Node) => {
      if (rootRef.current?.contains(target)) return true;
      if (floatingRef?.current?.contains(target)) return true;
      return false;
    },
    [rootRef, floatingRef],
  );

  useEffect(() => {
    if (!open) return;

    if (coarsePointer) {
      function handlePointerDownOutside(e: PointerEvent) {
        if (shouldIgnoreOutsideClose(e)) return;
        if (isPickingRef) isPickingRef.current = isInside(e.target as Node);
      }

      function handlePointerUpOutside(e: PointerEvent) {
        if (shouldIgnoreOutsideClose(e)) return;
        if (isInside(e.target as Node)) return;
        if (isPickingRef?.current) {
          isPickingRef.current = false;
          return;
        }
        onClose();
      }

      const timer = window.setTimeout(() => {
        document.addEventListener('pointerdown', handlePointerDownOutside, true);
        document.addEventListener('pointerup', handlePointerUpOutside, true);
      }, DISMISS_LISTENER_DELAY_MS);

      return () => {
        clearTimeout(timer);
        document.removeEventListener('pointerdown', handlePointerDownOutside, true);
        document.removeEventListener('pointerup', handlePointerUpOutside, true);
      };
    }

    function handleMouseDownOutside(e: MouseEvent) {
      if (shouldIgnoreOutsideClose(e)) return;
      if (isInside(e.target as Node)) return;
      onClose();
    }

    const timer = window.setTimeout(() => {
      document.addEventListener('mousedown', handleMouseDownOutside, true);
    }, DISMISS_LISTENER_DELAY_MS);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleMouseDownOutside, true);
    };
  }, [open, onClose, coarsePointer, isInside, isPickingRef, shouldIgnoreOutsideClose]);

  const bindTrigger = useCallback(
    (toggle: (pointerId?: number) => void, disabled = false) => ({
      onPointerUp: (e: ReactPointerEvent<HTMLButtonElement>) => {
        if (disabled || !coarsePointer || e.pointerType === 'mouse') return;
        e.preventDefault();
        e.stopPropagation();
        toggle(e.pointerId);
      },
      onMouseDown: (e: ReactMouseEvent<HTMLButtonElement>) => {
        if (!disabled && !coarsePointer) e.preventDefault();
      },
      onClick: (e: ReactMouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        if (coarsePointer || disabled) return;
        toggle();
      },
    }),
    [coarsePointer],
  );

  return { coarsePointer, markJustOpened, bindTrigger };
}

/** Toque em item de lista (mobile) sem depender de click sintético. */
export function useCoarseListItemTap<T extends string>(onTap: (value: T) => void) {
  const coarsePointer = useCoarsePointer();
  const pickingRef = useRef(false);
  const startRef = useRef<{ value: T; x: number; y: number } | null>(null);
  const lastTapAtRef = useRef(0);

  const fireTap = useCallback(
    (value: T) => {
      const now = Date.now();
      if (now - lastTapAtRef.current < 300) return;
      lastTapAtRef.current = now;
      onTap(value);
    },
    [onTap],
  );

  const bindItem = useCallback(
    (value: T) => ({
      onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
        if (!coarsePointer) return;
        pickingRef.current = true;
        startRef.current = { value, x: e.clientX, y: e.clientY };
      },
      onPointerUp: (e: ReactPointerEvent<HTMLButtonElement>) => {
        if (!coarsePointer) return;
        const start = startRef.current;
        startRef.current = null;
        pickingRef.current = false;
        if (!start || start.value !== value) return;
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        if (dx * dx + dy * dy > TAP_MOVE_THRESHOLD_SQ) return;
        e.preventDefault();
        e.stopPropagation();
        fireTap(value);
      },
      onMouseDown: (e: ReactMouseEvent<HTMLButtonElement>) => {
        if (coarsePointer) return;
        e.preventDefault();
        e.stopPropagation();
        fireTap(value);
      },
      onClick: (e: ReactMouseEvent<HTMLButtonElement>) => {
        if (!coarsePointer) return;
        e.preventDefault();
        e.stopPropagation();
        fireTap(value);
      },
    }),
    [coarsePointer, fireTap],
  );

  return { coarsePointer, pickingRef, bindItem };
}

/** Botão de ação única (ex.: Limpar todos) com suporte touch coarse. */
export function useCoarseActionTap(
  onAction: () => void,
  sharedPickingRef?: RefObject<boolean>,
) {
  const coarsePointer = useCoarsePointer();
  const localPickingRef = useRef(false);
  const pickingRef = sharedPickingRef ?? localPickingRef;
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const lastTapAtRef = useRef(0);

  const fireAction = useCallback(() => {
    const now = Date.now();
    if (now - lastTapAtRef.current < 300) return;
    lastTapAtRef.current = now;
    onAction();
  }, [onAction]);

  const bindAction = useCallback(
    () => ({
      onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
        if (!coarsePointer) return;
        pickingRef.current = true;
        startRef.current = { x: e.clientX, y: e.clientY };
      },
      onPointerUp: (e: ReactPointerEvent<HTMLButtonElement>) => {
        if (!coarsePointer) return;
        const start = startRef.current;
        startRef.current = null;
        pickingRef.current = false;
        if (!start) return;
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        if (dx * dx + dy * dy > TAP_MOVE_THRESHOLD_SQ) return;
        e.preventDefault();
        e.stopPropagation();
        fireAction();
      },
      onMouseDown: (e: ReactMouseEvent<HTMLButtonElement>) => {
        if (coarsePointer) return;
        e.preventDefault();
        e.stopPropagation();
        fireAction();
      },
      onClick: (e: ReactMouseEvent<HTMLButtonElement>) => {
        if (!coarsePointer) return;
        e.preventDefault();
        e.stopPropagation();
        fireAction();
      },
    }),
    [coarsePointer, fireAction, pickingRef],
  );

  return { bindAction };
}
