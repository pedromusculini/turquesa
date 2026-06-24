"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useMediaQuery } from "@/lib/useMediaQuery";
import {
  UNASSIGNED_PROF_FILTER_KEY,
  type ProfissionalFilterEntry,
  swatchForFilterEntry,
} from "@/lib/agendaProfissionalFilter";

type Accent = "turquesa" | "emerald";

const ACCENT: Record<
  Accent,
  { border: string; text: string; bg: string; ring: string }
> = {
  turquesa: {
    border: "border-[#047482]/25",
    text: "text-[#047482]",
    bg: "bg-[#eef4f5]",
    ring: "accent-[#047482]",
  },
  emerald: {
    border: "border-emerald-600/25",
    text: "text-emerald-800",
    bg: "bg-emerald-50",
    ring: "accent-emerald-700",
  },
};

export type AgendaProfissionalFilterProps = {
  entries: ProfissionalFilterEntry[];
  visibleKeys: Set<string>;
  onChange: (keys: Set<string>) => void;
  showUnassigned: boolean;
  /** Só visualização — não altera dados da agenda */
  accent?: Accent;
  className?: string;
};

export default function AgendaProfissionalFilter({
  entries,
  visibleKeys,
  onChange,
  showUnassigned,
  accent = "turquesa",
  className = "",
}: AgendaProfissionalFilterProps) {
  const isMobile = useMediaQuery(768);
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const styles = ACCENT[accent];

  useEffect(() => {
    setOpen(!isMobile);
  }, [isMobile]);

  const totalSelectable = entries.length + (showUnassigned ? 1 : 0);
  const visibleCount = useMemo(() => {
    let n = 0;
    for (const e of entries) {
      if (visibleKeys.has(e.key)) n++;
    }
    if (showUnassigned && visibleKeys.has(UNASSIGNED_PROF_FILTER_KEY)) n++;
    return n;
  }, [entries, visibleKeys, showUnassigned]);

  const toggleKey = useCallback(
    (key: string, checked: boolean) => {
      const next = new Set(visibleKeys);
      if (checked) next.add(key);
      else next.delete(key);
      onChange(next);
    },
    [visibleKeys, onChange],
  );

  const selectAll = useCallback(() => {
    const next = new Set<string>();
    for (const e of entries) next.add(e.key);
    if (showUnassigned) next.add(UNASSIGNED_PROF_FILTER_KEY);
    onChange(next);
  }, [entries, showUnassigned, onChange]);

  const clearAll = useCallback(() => {
    onChange(new Set());
  }, [onChange]);

  if (entries.length === 0) return null;

  return (
    <div
      className={`rounded-2xl border ${styles.border} bg-white shadow-sm min-w-0 ${className}`}
      data-tour="agenda-filtro-profissionais"
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between gap-2 px-3 py-3 sm:px-4 text-left touch-manipulation min-h-[44px] ${styles.text}`}
      >
        <span className="min-w-0">
          <span className="block text-xs font-semibold uppercase tracking-wide">
            Profissionais na grade
          </span>
          <span className="block text-[11px] sm:text-xs text-slate-500 font-normal mt-0.5 truncate">
            {visibleCount} de {totalSelectable} visíveis · só filtro de tela
          </span>
        </span>
        <ChevronDown
          className={`w-5 h-5 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open && (
        <div
          id={panelId}
          className={`border-t ${styles.border} px-3 pb-3 pt-2 sm:px-4 sm:pb-4 max-h-[min(50vh,320px)] overflow-y-auto overscroll-contain`}
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div className="flex flex-wrap gap-2 mb-3">
            <button
              type="button"
              onClick={selectAll}
              className={`rounded-lg px-3 py-2 text-xs font-semibold ${styles.bg} ${styles.text} touch-manipulation min-h-[44px]`}
            >
              Todas
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="rounded-lg px-3 py-2 text-xs font-semibold border border-slate-200 text-slate-600 touch-manipulation min-h-[44px]"
            >
              Limpar
            </button>
          </div>

          <ul className="space-y-1" role="group" aria-label="Filtrar profissionais">
            {entries.map((entry, index) => {
              const swatch = swatchForFilterEntry(entry, index);
              const checked = visibleKeys.has(entry.key);
              const inputId = `${panelId}-${entry.key}`;
              return (
                <li key={entry.key}>
                  <label
                    htmlFor={inputId}
                    className="flex items-center gap-3 rounded-xl px-2 py-2.5 cursor-pointer touch-manipulation min-h-[44px] hover:bg-slate-50 active:bg-slate-100"
                  >
                    <input
                      id={inputId}
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => toggleKey(entry.key, e.target.checked)}
                      className={`h-5 w-5 shrink-0 rounded border-slate-300 ${styles.ring}`}
                    />
                    <span
                      className="inline-block h-3.5 w-3.5 rounded-full shrink-0 border"
                      style={{
                        backgroundColor: swatch.border,
                        borderColor: swatch.border,
                      }}
                      aria-hidden
                    />
                    <span className="text-sm text-slate-800 truncate">{entry.nome}</span>
                  </label>
                </li>
              );
            })}
            {showUnassigned && (
              <li>
                <label
                  htmlFor={`${panelId}-unassigned`}
                  className="flex items-center gap-3 rounded-xl px-2 py-2.5 cursor-pointer touch-manipulation min-h-[44px] hover:bg-slate-50 active:bg-slate-100"
                >
                  <input
                    id={`${panelId}-unassigned`}
                    type="checkbox"
                    checked={visibleKeys.has(UNASSIGNED_PROF_FILTER_KEY)}
                    onChange={(e) =>
                      toggleKey(UNASSIGNED_PROF_FILTER_KEY, e.target.checked)
                    }
                    className={`h-5 w-5 shrink-0 rounded border-slate-300 ${styles.ring}`}
                  />
                  <span
                    className="inline-block h-3.5 w-3.5 rounded-full shrink-0 border border-dashed border-slate-400 bg-slate-100"
                    aria-hidden
                  />
                  <span className="text-sm text-slate-600">Sem profissional</span>
                </label>
              </li>
            )}
          </ul>

          {visibleCount === 0 && (
            <p className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Nenhuma selecionada — a grade fica vazia até marcar ao menos uma.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
