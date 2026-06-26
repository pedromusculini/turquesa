"use client";

import { useCallback, useId, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  UNASSIGNED_PROF_FILTER_KEY,
  type ProfissionalFilterEntry,
  swatchForFilterEntry,
} from "@/lib/agendaProfissionalFilter";

type Accent = "turquesa" | "emerald";

const ACCENT: Record<
  Accent,
  { border: string; text: string; muted: string; ring: string }
> = {
  turquesa: {
    border: "border-[#047482]/20",
    text: "text-[#047482]",
    muted: "text-slate-500",
    ring: "accent-[#047482]",
  },
  emerald: {
    border: "border-emerald-600/20",
    text: "text-emerald-800",
    muted: "text-slate-500",
    ring: "accent-emerald-700",
  },
};

export type AgendaProfissionalFilterProps = {
  entries: ProfissionalFilterEntry[];
  visibleKeys: Set<string>;
  onChange: (keys: Set<string>) => void;
  showUnassigned: boolean;
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
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const styles = ACCENT[accent];

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
      className={`rounded-xl border ${styles.border} bg-white min-w-0 ${className}`}
      data-tour="agenda-filtro-profissionais"
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left touch-manipulation min-h-[40px] ${styles.text}`}
      >
        <span className="min-w-0 text-xs font-medium truncate">
          Profissionais na grade
          <span className={`font-normal ${styles.muted}`}>
            {" "}
            · {visibleCount}/{totalSelectable}
          </span>
        </span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 opacity-70 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open && (
        <div
          id={panelId}
          className={`border-t ${styles.border} px-2 pb-2 pt-1 max-h-44 overflow-y-auto overscroll-contain`}
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div className="flex items-center gap-3 px-1 py-1 mb-0.5">
            <button
              type="button"
              onClick={selectAll}
              className={`text-[11px] font-semibold ${styles.text} touch-manipulation py-1`}
            >
              Todas
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="text-[11px] font-medium text-slate-500 touch-manipulation py-1"
            >
              Limpar
            </button>
          </div>

          <ul className="space-y-0" role="group" aria-label="Filtrar profissionais">
            {entries.map((entry, index) => {
              const swatch = swatchForFilterEntry(entry, index);
              const checked = visibleKeys.has(entry.key);
              const inputId = `${panelId}-${entry.key}`;
              return (
                <li key={entry.key}>
                  <label
                    htmlFor={inputId}
                    className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 cursor-pointer touch-manipulation min-h-[36px] hover:bg-slate-50 active:bg-slate-100"
                  >
                    <input
                      id={inputId}
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => toggleKey(entry.key, e.target.checked)}
                      className={`h-3.5 w-3.5 shrink-0 rounded border-slate-300 ${styles.ring}`}
                    />
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: swatch.border }}
                      aria-hidden
                    />
                    <span
                      className={`inline-block h-2 w-2 rounded-full shrink-0 ${
                        entry.googleAgendaConnected ? "bg-emerald-500" : "bg-slate-300"
                      }`}
                      title={
                        entry.googleAgendaConnected
                          ? "Agenda Google conectada"
                          : "Agenda Google não conectada"
                      }
                      aria-label={
                        entry.googleAgendaConnected
                          ? `${entry.nome}: agenda Google conectada`
                          : `${entry.nome}: agenda Google não conectada`
                      }
                      role="img"
                    />
                    <span className="text-xs text-slate-800 truncate flex-1 min-w-0">
                      {entry.nome}
                    </span>
                  </label>
                </li>
              );
            })}
            {showUnassigned && (
              <li>
                <label
                  htmlFor={`${panelId}-unassigned`}
                  className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 cursor-pointer touch-manipulation min-h-[36px] hover:bg-slate-50 active:bg-slate-100"
                >
                  <input
                    id={`${panelId}-unassigned`}
                    type="checkbox"
                    checked={visibleKeys.has(UNASSIGNED_PROF_FILTER_KEY)}
                    onChange={(e) =>
                      toggleKey(UNASSIGNED_PROF_FILTER_KEY, e.target.checked)
                    }
                    className={`h-3.5 w-3.5 shrink-0 rounded border-slate-300 ${styles.ring}`}
                  />
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full shrink-0 border border-dashed border-slate-400 bg-slate-100"
                    aria-hidden
                  />
                  <span className="text-xs text-slate-600">Sem profissional</span>
                </label>
              </li>
            )}
          </ul>

          {visibleCount === 0 && (
            <p className="mt-1 mx-1 text-[10px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1">
              Marque ao menos uma para ver a grade.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
