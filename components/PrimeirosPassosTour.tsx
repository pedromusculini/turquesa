'use client';

import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { usePrimeirosPassosTour } from '@/lib/PrimeirosPassosTourContext';
import {
  findVisibleTourTarget,
  PRIMEIROS_PASSOS_STEPS,
  tourRouteMatches,
  type TourStepPlacement,
} from '@/lib/primeirosPassosTour';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';

type SpotlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type PopoverPos = {
  top: number;
  left: number;
  placement: TourStepPlacement;
};

const MOBILE_BOTTOM_NAV = 72;
const POPOVER_GAP = 12;
const POPOVER_WIDTH = 320;

function resolvePlacement(
  targetRect: DOMRect,
  preferred: TourStepPlacement,
  popoverHeight: number,
): PopoverPos {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const safeBottom = vh - MOBILE_BOTTOM_NAV;

  const tryBottom: PopoverPos = {
    top: targetRect.bottom + POPOVER_GAP,
    left: Math.min(
      Math.max(12, targetRect.left + targetRect.width / 2 - POPOVER_WIDTH / 2),
      vw - POPOVER_WIDTH - 12,
    ),
    placement: 'bottom',
  };

  const tryTop: PopoverPos = {
    top: targetRect.top - popoverHeight - POPOVER_GAP,
    left: Math.min(
      Math.max(12, targetRect.left + targetRect.width / 2 - POPOVER_WIDTH / 2),
      vw - POPOVER_WIDTH - 12,
    ),
    placement: 'top',
  };

  if (preferred === 'top') {
    if (tryTop.top >= 12) return tryTop;
    return tryBottom;
  }

  if (preferred === 'bottom' || preferred === 'auto' || !preferred) {
    if (tryBottom.top + popoverHeight <= safeBottom) return tryBottom;
    if (tryTop.top >= 12) return tryTop;
    return {
      top: Math.min(safeBottom - popoverHeight - 12, Math.max(12, tryBottom.top)),
      left: tryBottom.left,
      placement: 'bottom',
    };
  }

  return tryBottom;
}

export default function PrimeirosPassosTour() {
  const pathname = usePathname();
  const { tourActive, tourStepIndex, skipTour, nextStep, prevStep } = usePrimeirosPassosTour();
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const [popover, setPopover] = useState<PopoverPos | null>(null);
  const [missingTarget, setMissingTarget] = useState(false);
  const [routeSettled, setRouteSettled] = useState(false);

  const step = PRIMEIROS_PASSOS_STEPS[tourStepIndex];
  const total = PRIMEIROS_PASSOS_STEPS.length;
  const isFirst = tourStepIndex === 0;
  const isLast = tourStepIndex === total - 1;

  useBodyScrollLock(tourActive);

  useEffect(() => {
    if (!tourActive) {
      setRouteSettled(false);
      return;
    }
    setRouteSettled(false);
    const timer = window.setTimeout(() => setRouteSettled(true), 480);
    return () => window.clearTimeout(timer);
  }, [tourActive, tourStepIndex, pathname]);

  const updatePositions = useCallback(() => {
    if (!tourActive || !step || !routeSettled) {
      if (!tourActive || !step) {
        setSpotlight(null);
        setPopover(null);
      }
      return;
    }

    const search =
      typeof window !== 'undefined' ? window.location.search : '';
    if (!tourRouteMatches(step.route, pathname, search)) return;

    const target = findVisibleTourTarget(step.target);
    if (!target) {
      setMissingTarget(true);
      setSpotlight(null);
      setPopover(null);
      return;
    }

    setMissingTarget(false);
    // Só reposiciona o spotlight; scrollIntoView a cada 400ms lutava com o
    // dedo do usuário no mobile e deixava a tela “presa”.
    const rect = target.getBoundingClientRect();
    const pad = 6;
    setSpotlight({
      top: rect.top - pad,
      left: rect.left - pad,
      width: rect.width + pad * 2,
      height: rect.height + pad * 2,
    });

    const popoverHeight = 220;
    setPopover(
      resolvePlacement(rect, step.placement ?? 'auto', popoverHeight),
    );
  }, [tourActive, step, routeSettled, pathname]);

  // ScrollIntoView só quando o passo muda (não no interval de 400ms).
  useEffect(() => {
    if (!tourActive || !step || !routeSettled) return;
    const search =
      typeof window !== 'undefined' ? window.location.search : '';
    if (!tourRouteMatches(step.route, pathname, search)) return;
    const target = findVisibleTourTarget(step.target);
    if (!target) return;
    target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [tourActive, tourStepIndex, step, routeSettled, pathname]);

  useLayoutEffect(() => {
    updatePositions();
  }, [updatePositions, tourStepIndex]);

  useEffect(() => {
    if (!tourActive) return;

    const onResize = () => updatePositions();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);

    const interval = window.setInterval(updatePositions, 400);

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
      window.clearInterval(interval);
    };
  }, [tourActive, updatePositions]);

  useEffect(() => {
    if (!tourActive || !missingTarget || !step) return;
    if (!step.optional) return;
    const timer = window.setTimeout(() => nextStep(), 120);
    return () => window.clearTimeout(timer);
  }, [tourActive, missingTarget, step, nextStep]);

  if (!tourActive || !step) return null;

  if (!routeSettled) return null;

  if (missingTarget && !step.optional) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
          <p className="text-sm text-gray-600">
            Não encontramos este item na tela. Avance para o próximo passo ou pule o tour.
          </p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={skipTour}
              className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Pular tour
            </button>
            <button
              type="button"
              onClick={nextStep}
              className="flex-1 rounded-xl bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              Próximo
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (missingTarget && step.optional) return null;

  return (
    <div className="fixed inset-0 z-[200] pointer-events-none" aria-live="polite">
      {spotlight && (
        <svg className="absolute inset-0 h-full w-full pointer-events-auto" aria-hidden>
          <defs>
            <mask id="tour-spotlight-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              <rect
                x={spotlight.left}
                y={spotlight.top}
                width={spotlight.width}
                height={spotlight.height}
                rx="12"
                ry="12"
                fill="black"
              />
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(0,0,0,0.55)"
            mask="url(#tour-spotlight-mask)"
            onClick={skipTour}
          />
        </svg>
      )}

      {popover && (
        <div
          className="pointer-events-auto fixed z-[201] w-[min(320px,calc(100vw-24px))] rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-5 shadow-2xl"
          style={{ top: popover.top, left: popover.left }}
          role="dialog"
          aria-labelledby="tour-step-title"
        >
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-primary)]">
                Primeiros passos · {tourStepIndex + 1}/{total}
              </p>
              <h2 id="tour-step-title" className="mt-1 text-lg font-bold text-gray-900">
                {step.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={skipTour}
              className="shrink-0 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              aria-label="Fechar tour"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <p className="text-sm leading-relaxed text-gray-600">{step.description}</p>

          <div className="mt-4 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={skipTour}
              className="text-sm font-medium text-gray-500 hover:text-gray-700"
            >
              Pular
            </button>
            <div className="flex gap-2">
              {!isFirst && (
                <button
                  type="button"
                  onClick={prevStep}
                  className="inline-flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Voltar
                </button>
              )}
              <button
                type="button"
                onClick={nextStep}
                className="inline-flex items-center gap-1 rounded-xl bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                {isLast ? 'Concluir' : 'Próximo'}
                {!isLast && <ChevronRight className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
