'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';

const SWIPE_THRESHOLD_PX = 48;

export type CatalogoFotoLightboxState = {
  urls: string[];
  index: number;
  label?: string;
} | null;

type Props = {
  open: boolean;
  onClose: () => void;
  urls: string[];
  index: number;
  label?: string;
};

export default function CatalogoFotoLightbox({ open, onClose, urls, index, label }: Props) {
  const [current, setCurrent] = useState(index);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);

  const count = urls.length;
  const hasNav = count > 1;

  useEffect(() => {
    if (open) setCurrent(Math.min(Math.max(0, index), Math.max(0, count - 1)));
  }, [open, index, count]);

  const goPrev = useCallback(() => {
    setCurrent((i) => (i <= 0 ? count - 1 : i - 1));
  }, [count]);

  const goNext = useCallback(() => {
    setCurrent((i) => (i >= count - 1 ? 0 : i + 1));
  }, [count]);

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;

    closeRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (!hasNav) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose, hasNav, goPrev, goNext]);

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (!hasNav || touchStartX.current === null) return;
    const endX = e.changedTouches[0]?.clientX;
    if (endX == null) return;
    const dx = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
    if (dx < 0) goNext();
    else goPrev();
  }

  function handleKeyDownTrap(e: React.KeyboardEvent) {
    if (e.key !== 'Tab' || !panelRef.current) return;
    const focusable = panelRef.current.querySelectorAll<HTMLElement>(
      'button, [href], [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  if (!open || count === 0) return null;

  const url = urls[current];
  const altBase = label?.trim() || 'Foto do serviço';
  const alt = hasNav ? `${altBase} (${current + 1} de ${count})` : altBase;
  const titleId = 'catalogo-foto-lightbox-title';

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4"
      role="presentation"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDownTrap}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[min(92vh,900px)] w-full max-w-4xl flex-col outline-none"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <p id={titleId} className="sr-only">
          {hasNav ? `Visualização de fotos: ${alt}` : alt}
        </p>

        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="absolute -top-1 right-0 z-10 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:top-0"
          aria-label="Fechar visualização"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>

        <div className="relative h-[min(78vh,720px)] w-full overflow-hidden rounded-xl bg-black/40">
          <Image
            key={url}
            src={url}
            alt={alt}
            fill
            className="object-contain"
            sizes="(max-width: 896px) 100vw, 896px"
            priority
          />
        </div>

        {hasNav && (
          <>
            <button
              type="button"
              onClick={goPrev}
              className="absolute left-1 top-1/2 hidden -translate-y-1/2 rounded-full bg-black/50 p-2.5 text-white hover:bg-black/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:flex"
              aria-label="Foto anterior"
            >
              <ChevronLeft className="h-6 w-6" aria-hidden />
            </button>
            <button
              type="button"
              onClick={goNext}
              className="absolute right-1 top-1/2 hidden -translate-y-1/2 rounded-full bg-black/50 p-2.5 text-white hover:bg-black/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:flex"
              aria-label="Próxima foto"
            >
              <ChevronRight className="h-6 w-6" aria-hidden />
            </button>
            <p
              className="mt-2 text-center text-sm text-white/90"
              aria-live="polite"
              aria-atomic="true"
            >
              {current + 1} / {count}
              <span className="sr-only"> — use as setas do teclado ou deslize no celular</span>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/** Miniatura clicável que abre o lightbox no índice indicado. */
export function CatalogoFotoThumbButton({
  url,
  index,
  alt,
  className,
  sizes,
  onOpen,
}: {
  url: string;
  index: number;
  alt: string;
  className?: string;
  sizes?: string;
  onOpen: (index: number) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(index)}
      className={`relative overflow-hidden bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-1 ${className ?? 'h-10 w-10 rounded-lg'}`}
      aria-label={`Ampliar foto ${index + 1}${alt ? `: ${alt}` : ''}`}
    >
      <Image src={url} alt="" fill className="object-cover" sizes={sizes ?? '40px'} />
    </button>
  );
}
