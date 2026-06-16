'use client';

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type SyntheticEvent } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, X } from 'lucide-react';

export type SearchableOption = {
  value: string;
  label: string;
  sublabel?: string;
};

type Props = {
  label?: string;
  options: SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  error?: string;
  className?: string;
  /** Altura máxima da lista rolável (classes Tailwind). */
  listMaxHeight?: string;
  /** Dropdown fixo (evita corte em modais com overflow). */
  dropdownMode?: 'inline' | 'fixed';
  emptyMessage?: string;
  /** Filtro customizado (ex.: busca fuzzy de clientes). */
  matchesQuery?: (label: string, sublabel: string | undefined, query: string) => boolean;
};

export default function SearchableSelect({
  label,
  options,
  value,
  onChange,
  placeholder = 'Selecionar...',
  searchPlaceholder = 'Buscar...',
  disabled = false,
  error,
  className = '',
  listMaxHeight = 'max-h-56',
  dropdownMode = 'inline',
  emptyMessage = 'Nenhum resultado',
  matchesQuery,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [fixedRect, setFixedRect] = useState<DOMRect | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const scrollParentRef = useRef<HTMLElement | null>(null);
  const savedScrollTopRef = useRef(0);
  const savedWindowScrollYRef = useRef(0);
  const coarsePointerRef = useRef(
    typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches,
  );
  /** Gestos dentro do dropdown (mobile): evita fechar antes da seleção. */
  const pickingOptionRef = useRef(false);
  const optionPointerRef = useRef<{ value: string; x: number; y: number } | null>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return options;
    if (matchesQuery) {
      return options.filter((o) => matchesQuery(o.label, o.sublabel, q));
    }
    const ql = q.toLowerCase();
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(ql) ||
        (o.sublabel?.toLowerCase().includes(ql) ?? false),
    );
  }, [options, query, matchesQuery]);

  useEffect(() => {
    if (!open) return;

    function isInsideDropdown(target: Node) {
      if (ref.current?.contains(target)) return true;
      return Boolean(portalRef.current?.contains(target));
    }

    function handlePointerDownOutside(e: PointerEvent) {
      pickingOptionRef.current = isInsideDropdown(e.target as Node);
    }

    function handlePointerUpOutside(e: PointerEvent) {
      if (pickingOptionRef.current) {
        pickingOptionRef.current = false;
        return;
      }
      if (isInsideDropdown(e.target as Node)) return;
      setOpen(false);
      setQuery('');
    }

    // Evita fechar no mesmo toque que abriu o dropdown (iOS / modal).
    const frameId = requestAnimationFrame(() => {
      document.addEventListener('pointerdown', handlePointerDownOutside);
      document.addEventListener('pointerup', handlePointerUpOutside);
    });

    return () => {
      cancelAnimationFrame(frameId);
      document.removeEventListener('pointerdown', handlePointerDownOutside);
      document.removeEventListener('pointerup', handlePointerUpOutside);
    };
  }, [open]);

  function findScrollParent(el: HTMLElement | null): HTMLElement | null {
    let node = el?.parentElement ?? null;
    while (node) {
      const { overflowY } = getComputedStyle(node);
      if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
        return node;
      }
      node = node.parentElement;
    }
    return null;
  }

  useEffect(() => {
    if (!open) return;

    if (!coarsePointerRef.current) {
      requestAnimationFrame(() => {
        searchInputRef.current?.focus({ preventScroll: true });
      });
    }

    if (dropdownMode !== 'fixed' || !triggerRef.current) return;

    const scrollParent = findScrollParent(triggerRef.current);
    scrollParentRef.current = scrollParent;
    let prevScrollParentOverflow = '';
    if (scrollParent) {
      savedScrollTopRef.current = scrollParent.scrollTop;
      if (coarsePointerRef.current) {
        prevScrollParentOverflow = scrollParent.style.overflow;
        scrollParent.style.overflow = 'hidden';
      }
    }

    const lockWindowScroll = coarsePointerRef.current;
    let prevBodyOverflow = '';
    if (lockWindowScroll) {
      savedWindowScrollYRef.current = window.scrollY;
      prevBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      window.scrollTo(0, savedWindowScrollYRef.current);
    }

    function lockScrollParent() {
      const parent = scrollParentRef.current;
      if (!parent || coarsePointerRef.current) return;
      if (parent.scrollTop !== savedScrollTopRef.current) {
        parent.scrollTop = savedScrollTopRef.current;
      }
    }

    function updateRect() {
      if (triggerRef.current) setFixedRect(triggerRef.current.getBoundingClientRect());
      lockScrollParent();
      if (lockWindowScroll) {
        window.scrollTo(0, savedWindowScrollYRef.current);
      }
    }

    updateRect();
    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('resize', updateRect);
    if (!coarsePointerRef.current) {
      scrollParent?.addEventListener('scroll', lockScrollParent, { passive: true });
    }

    return () => {
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect);
      scrollParent?.removeEventListener('scroll', lockScrollParent);
      if (scrollParent && coarsePointerRef.current) {
        scrollParent.style.overflow = prevScrollParentOverflow;
      }
      scrollParentRef.current = null;
      if (lockWindowScroll) {
        document.body.style.overflow = prevBodyOverflow;
        window.scrollTo(0, savedWindowScrollYRef.current);
      }
    };
  }, [open, dropdownMode]);

  function selectOption(optValue: string) {
    onChange(optValue);
    setOpen(false);
    setQuery('');
  }

  function handleOptionPick(optValue: string, e: SyntheticEvent) {
    e.stopPropagation();
    e.preventDefault();
    selectOption(optValue);
  }

  function handleCoarseOptionPointerDown(optValue: string, e: ReactPointerEvent<HTMLButtonElement>) {
    pickingOptionRef.current = true;
    optionPointerRef.current = { value: optValue, x: e.clientX, y: e.clientY };
  }

  function handleCoarseOptionPointerUp(optValue: string, e: ReactPointerEvent<HTMLButtonElement>) {
    const start = optionPointerRef.current;
    optionPointerRef.current = null;
    pickingOptionRef.current = false;
    if (!start || start.value !== optValue) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (dx * dx + dy * dy > 144) return;
    e.preventDefault();
    e.stopPropagation();
    selectOption(optValue);
  }

  const dropdownContent = (
    <div
      className={`rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden ${
        dropdownMode === 'fixed' ? '' : 'absolute z-[120] mt-1 w-full'
      }`}
      style={
        dropdownMode === 'fixed' && fixedRect
          ? {
              position: 'fixed',
              top: fixedRect.bottom + 4,
              left: fixedRect.left,
              width: fixedRect.width,
              zIndex: 10000,
            }
          : undefined
      }
    >
      <div className="p-2 border-b border-gray-100 sticky top-0 bg-white">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            ref={searchInputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#3795a1]"
          />
        </div>
        {options.length > 0 && (
          <p className="text-[10px] text-gray-400 mt-1.5 px-0.5">
            {filtered.length} de {options.length} — role para ver mais
          </p>
        )}
      </div>
      <ul
        className={`${listMaxHeight} overflow-y-auto overscroll-contain`}
        role="listbox"
      >
        {filtered.length === 0 ? (
          <li className="px-3 py-4 text-sm text-gray-500 text-center">{emptyMessage}</li>
        ) : (
          filtered.map((opt) => (
            <li key={opt.value}>
              <button
                type="button"
                role="option"
                aria-selected={value === opt.value}
                onPointerDown={(e) => {
                  if (coarsePointerRef.current) handleCoarseOptionPointerDown(opt.value, e);
                }}
                onPointerUp={(e) => {
                  if (coarsePointerRef.current) handleCoarseOptionPointerUp(opt.value, e);
                }}
                onMouseDown={(e) => {
                  if (!coarsePointerRef.current) handleOptionPick(opt.value, e);
                }}
                onClick={(e) => {
                  if (coarsePointerRef.current) {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                }}
                className={`w-full text-left px-3 py-2.5 text-sm hover:bg-[#eef4f5] transition touch-manipulation ${
                  value === opt.value
                    ? 'bg-[#eef4f5] text-[#047482] font-medium'
                    : 'text-gray-800'
                }`}
              >
                <span className="block truncate">{opt.label}</span>
                {opt.sublabel && (
                  <span className="block text-xs text-gray-500 truncate">{opt.sublabel}</span>
                )}
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );

  return (
    <div ref={ref} className={`relative ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      )}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={`flex items-center gap-2 w-full rounded-xl border bg-white px-3 py-2.5 text-sm text-left min-h-[44px] transition touch-manipulation ${
          error
            ? 'border-red-400 bg-red-50'
            : 'border-gray-200 hover:border-gray-300 focus:border-[#047482] focus:ring-2 focus:ring-[#3795a1]/50'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span className={`flex-1 truncate ${selected ? 'text-gray-900' : 'text-gray-400'}`}>
          {selected ? selected.label : placeholder}
        </span>
        {value && !disabled && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.stopPropagation();
                onChange('');
              }
            }}
            className="p-0.5 rounded hover:bg-gray-100 text-gray-400"
          >
            <X className="w-4 h-4" />
          </span>
        )}
        <ChevronDown
          className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}

      {open &&
        (dropdownMode === 'fixed' && typeof document !== 'undefined'
          ? createPortal(
              <div ref={portalRef}>{dropdownContent}</div>,
              document.body,
            )
          : dropdownContent)}
    </div>
  );
}
