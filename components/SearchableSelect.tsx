'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, X } from 'lucide-react';
import {
  useCoarseListItemTap,
  useDismissableLayer,
} from '@/lib/useDismissableLayer';

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
  /** Limite de itens renderizados em listas grandes (performance). */
  maxVisibleOptions?: number;
  /** Acima deste total, sem busca, mostra só um subconjunto. */
  largeListThreshold?: number;
  /** Callback quando o texto de busca muda (ex.: busca server-side). */
  onQueryChange?: (query: string) => void;
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
  maxVisibleOptions = 100,
  largeListThreshold = 60,
  onQueryChange,
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

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim();
    let list: SearchableOption[];
    if (!q) {
      if (options.length > largeListThreshold) {
        list = options.slice(0, maxVisibleOptions);
        if (value) {
          const selectedOpt = options.find((o) => o.value === value);
          if (selectedOpt && !list.some((o) => o.value === value)) {
            list = [selectedOpt, ...list.slice(0, maxVisibleOptions - 1)];
          }
        }
      } else {
        list = options;
      }
      return list;
    }
    if (matchesQuery) {
      return options.filter((o) => matchesQuery(o.label, o.sublabel, q));
    }
    const ql = q.toLowerCase();
    const matched = options.filter(
      (o) =>
        o.label.toLowerCase().includes(ql) ||
        (o.sublabel?.toLowerCase().includes(ql) ?? false),
    );
    return matched.length > maxVisibleOptions
      ? matched.slice(0, maxVisibleOptions)
      : matched;
  }, [options, query, matchesQuery, largeListThreshold, maxVisibleOptions, value]);

  const listHint = useMemo(() => {
    const q = query.trim();
    if (options.length === 0) return null;
    if (!q && options.length > largeListThreshold) {
      return `Mostrando ${filtered.length} de ${options.length} — digite para buscar`;
    }
    if (q || filtered.length !== options.length) {
      return `${filtered.length} de ${options.length} — role para ver mais`;
    }
    return `${options.length} — role para ver mais`;
  }, [options.length, query, filtered.length, largeListThreshold]);

  const closeDropdown = useCallback(() => {
    setOpen(false);
    setQuery('');
    setFixedRect(null);
  }, []);

  const selectOption = useCallback(
    (optValue: string) => {
      onChange(optValue);
      closeDropdown();
    },
    [onChange, closeDropdown],
  );

  const { pickingRef: pickingOptionRef, bindItem } = useCoarseListItemTap(selectOption);

  const { coarsePointer, markJustOpened, bindTrigger } = useDismissableLayer({
    open,
    onClose: closeDropdown,
    rootRef: ref,
    floatingRef: portalRef,
    isPickingRef: pickingOptionRef,
  });

  const openDropdown = useCallback(
    (pointerId?: number) => {
      if (disabled) return;
      markJustOpened(pointerId);
      if (dropdownMode === 'fixed' && triggerRef.current) {
        setFixedRect(triggerRef.current.getBoundingClientRect());
      }
      setOpen(true);
    },
    [disabled, dropdownMode, markJustOpened],
  );

  const toggleDropdown = useCallback(
    (pointerId?: number) => {
      if (disabled) return;
      if (open) closeDropdown();
      else openDropdown(pointerId);
    },
    [disabled, open, closeDropdown, openDropdown],
  );

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

  useLayoutEffect(() => {
    if (!open || dropdownMode !== 'fixed' || !triggerRef.current) return;
    setFixedRect(triggerRef.current.getBoundingClientRect());
  }, [open, dropdownMode]);

  useEffect(() => {
    onQueryChange?.(query);
  }, [query, onQueryChange]);

  useEffect(() => {
    if (!open) return;

    if (!coarsePointer) {
      requestAnimationFrame(() => {
        searchInputRef.current?.focus({ preventScroll: true });
      });
    }

    if (dropdownMode !== 'fixed' || !triggerRef.current) return;

    const scrollParent = findScrollParent(triggerRef.current);
    scrollParentRef.current = scrollParent;
    if (scrollParent) {
      savedScrollTopRef.current = scrollParent.scrollTop;
    }

    function lockScrollParent() {
      const parent = scrollParentRef.current;
      if (!parent || coarsePointer) return;
      if (parent.scrollTop !== savedScrollTopRef.current) {
        parent.scrollTop = savedScrollTopRef.current;
      }
    }

    function updateRect() {
      if (triggerRef.current) setFixedRect(triggerRef.current.getBoundingClientRect());
      lockScrollParent();
    }

    updateRect();
    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('resize', updateRect);
    if (!coarsePointer) {
      scrollParent?.addEventListener('scroll', lockScrollParent, { passive: true });
    }

    return () => {
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect);
      scrollParent?.removeEventListener('scroll', lockScrollParent);
      scrollParentRef.current = null;
    };
  }, [open, dropdownMode, coarsePointer]);

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
        {listHint && (
          <p className="text-[10px] text-gray-400 mt-1.5 px-0.5">{listHint}</p>
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
                {...bindItem(opt.value)}
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

  const showFixedPortal =
    open && (dropdownMode !== 'fixed' || fixedRect !== null);

  const triggerHandlers = bindTrigger(toggleDropdown, disabled);

  return (
    <div ref={ref} className={`relative ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      )}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        {...triggerHandlers}
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

      {showFixedPortal &&
        (dropdownMode === 'fixed' && typeof document !== 'undefined'
          ? createPortal(
              <div ref={portalRef}>{dropdownContent}</div>,
              document.body,
            )
          : dropdownContent)}
    </div>
  );
}
