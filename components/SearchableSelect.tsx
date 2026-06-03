'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [fixedRect, setFixedRect] = useState<DOMRect | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.sublabel?.toLowerCase().includes(q) ?? false),
    );
  }, [options, query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      const portal = document.getElementById('searchable-select-portal');
      if (portal?.contains(target)) return;
      setOpen(false);
      setQuery('');
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open || dropdownMode !== 'fixed' || !triggerRef.current) return;

    function updateRect() {
      if (triggerRef.current) setFixedRect(triggerRef.current.getBoundingClientRect());
    }
    updateRect();
    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('resize', updateRect);
    return () => {
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect);
    };
  }, [open, dropdownMode]);

  function selectOption(optValue: string) {
    onChange(optValue);
    setOpen(false);
    setQuery('');
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
              zIndex: 200,
            }
          : undefined
      }
    >
      <div className="p-2 border-b border-gray-100 sticky top-0 bg-white">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#90EE90]"
            autoFocus
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
                onClick={() => selectOption(opt.value)}
                className={`w-full text-left px-3 py-2.5 text-sm hover:bg-[#f4fff4] transition ${
                  value === opt.value
                    ? 'bg-[#f4fff4] text-[#228B22] font-medium'
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
        className={`flex items-center gap-2 w-full rounded-xl border bg-white px-3 py-2.5 text-sm text-left min-h-[44px] transition ${
          error
            ? 'border-red-400 bg-red-50'
            : 'border-gray-200 hover:border-gray-300 focus:border-[#228B22] focus:ring-2 focus:ring-[#90EE90]/50'
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
              <div id="searchable-select-portal">{dropdownContent}</div>,
              document.body,
            )
          : dropdownContent)}
    </div>
  );
}
