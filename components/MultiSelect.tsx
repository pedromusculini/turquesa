'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import {
  useCoarseActionTap,
  useCoarseListItemTap,
  useDismissableLayer,
} from '@/lib/useDismissableLayer';

interface MultiSelectProps {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  /** Campo de busca no topo do menu (padrão: true) */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Limite de itens renderizados em listas grandes. */
  maxVisibleOptions?: number;
  /** Acima deste total, sem busca, mostra só um subconjunto. */
  largeListThreshold?: number;
}

export default function MultiSelect({
  label,
  options,
  selected,
  onChange,
  placeholder = 'Selecionar...',
  searchable = true,
  searchPlaceholder = 'Buscar...',
  maxVisibleOptions = 100,
  largeListThreshold = 60,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list: { value: string; label: string }[];
    if (!searchable || !q) {
      if (options.length > largeListThreshold) {
        list = options.slice(0, maxVisibleOptions);
      } else {
        list = options;
      }
      return list;
    }
    const matched = options.filter((o) => o.label.toLowerCase().includes(q));
    return matched.length > maxVisibleOptions
      ? matched.slice(0, maxVisibleOptions)
      : matched;
  }, [options, query, searchable, largeListThreshold, maxVisibleOptions]);

  const listHint = useMemo(() => {
    if (options.length === 0) return null;
    const q = query.trim();
    if (!q && options.length > largeListThreshold) {
      return `Mostrando ${filteredOptions.length} de ${options.length} — digite para buscar`;
    }
    if (q && filteredOptions.length !== options.length) {
      return `${filteredOptions.length} de ${options.length}`;
    }
    return null;
  }, [options.length, query, filteredOptions.length, largeListThreshold]);

  const closeDropdown = useCallback(() => {
    setOpen(false);
    setQuery('');
  }, []);

  const toggleOption = useCallback(
    (value: string) => {
      if (selected.includes(value)) {
        onChange(selected.filter((v) => v !== value));
      } else {
        onChange([...selected, value]);
      }
    },
    [selected, onChange],
  );

  const clearAll = useCallback(() => onChange([]), [onChange]);

  const { pickingRef, bindItem } = useCoarseListItemTap(toggleOption);
  const { bindAction: bindClearAll } = useCoarseActionTap(clearAll, pickingRef);

  const { markJustOpened, bindTrigger } = useDismissableLayer({
    open,
    onClose: closeDropdown,
    rootRef: ref,
    isPickingRef: pickingRef,
  });

  const toggleDropdown = useCallback(
    (pointerId?: number) => {
      if (open) closeDropdown();
      else {
        markJustOpened(pointerId);
        setOpen(true);
      }
    },
    [open, closeDropdown, markJustOpened],
  );

  const selectedLabels = selected
    .map((v) => options.find((o) => o.value === v)?.label)
    .filter(Boolean);

  const triggerHandlers = bindTrigger(toggleDropdown);

  return (
    <div ref={ref} className="relative">
      <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 mb-1">
        {label}
      </label>
      <button
        type="button"
        {...triggerHandlers}
        className="flex items-center gap-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:border-slate-300 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition min-h-[42px] touch-manipulation"
      >
        <div className="flex-1 flex flex-wrap gap-1">
          {selected.length === 0 ? (
            <span className="text-slate-400">{placeholder}</span>
          ) : selected.length <= 2 ? (
            selectedLabels.map((l, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"
              >
                {l}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleOption(selected[i]);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleOption(selected[i]);
                    }
                  }}
                  className="hover:text-emerald-900"
                >
                  <X className="w-3 h-3" />
                </span>
              </span>
            ))
          ) : (
            <span className="text-xs text-emerald-700 font-medium">
              {selected.length} selecionados
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg max-h-72 overflow-hidden flex flex-col">
          {searchable && (
            <div className="p-2 border-b border-slate-100 shrink-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              {listHint && (
                <p className="text-[10px] text-slate-400 mt-1.5 px-0.5">{listHint}</p>
              )}
            </div>
          )}
          <div
            className="overflow-y-auto flex-1 overscroll-contain"
            role="listbox"
          >
            {selected.length > 0 && (
              <button
                type="button"
                {...bindClearAll()}
                className="w-full px-3 py-2 text-xs font-semibold text-red-500 hover:bg-red-50 transition text-left border-b border-slate-100 touch-manipulation"
              >
                Limpar todos
              </button>
            )}
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-slate-400">
                {options.length === 0 ? 'Nenhuma opção disponível' : 'Nenhum resultado'}
              </div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={selected.includes(option.value)}
                  {...bindItem(option.value)}
                  className={`w-full px-3 py-2.5 text-sm text-left hover:bg-slate-50 transition flex items-center gap-2 touch-manipulation ${
                    selected.includes(option.value)
                      ? 'bg-emerald-50 text-emerald-800 font-medium'
                      : 'text-slate-700'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center transition pointer-events-none ${
                      selected.includes(option.value)
                        ? 'border-emerald-500 bg-emerald-500'
                        : 'border-slate-300'
                    }`}
                  >
                    {selected.includes(option.value) && (
                      <svg
                        className="w-3 h-3 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>
                  {option.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
