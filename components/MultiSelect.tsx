'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

interface MultiSelectProps {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  /** Campo de busca no topo do menu (padrão: true) */
  searchable?: boolean;
  searchPlaceholder?: string;
}

export default function MultiSelect({
  label,
  options,
  selected,
  onChange,
  placeholder = 'Selecionar...',
  searchable = true,
  searchPlaceholder = 'Buscar...',
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!searchable || !q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query, searchable]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const clearAll = () => onChange([]);

  const selectedLabels = selected
    .map((v) => options.find((o) => o.value === v)?.label)
    .filter(Boolean);

  return (
    <div ref={ref} className="relative">
      <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 mb-1">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:border-slate-300 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition min-h-[42px]"
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
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleOption(selected[i]);
                  }}
                  className="hover:text-emerald-900"
                >
                  <X className="w-3 h-3" />
                </button>
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
            </div>
          )}
          <div className="overflow-y-auto flex-1">
          {selected.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="w-full px-3 py-2 text-xs font-semibold text-red-500 hover:bg-red-50 transition text-left border-b border-slate-100"
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
                onClick={() => toggleOption(option.value)}
                className={`w-full px-3 py-2.5 text-sm text-left hover:bg-slate-50 transition flex items-center gap-2 ${
                  selected.includes(option.value) ? 'bg-emerald-50 text-emerald-800 font-medium' : 'text-slate-700'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded border-2 flex items-center justify-center transition ${
                    selected.includes(option.value)
                      ? 'border-emerald-500 bg-emerald-500'
                      : 'border-slate-300'
                  }`}
                >
                  {selected.includes(option.value) && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
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
