"use client";

import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";
import type { ConsultationRecord } from "@/lib/consultations";
import {
  agendaTimesEqual,
  formatAgendaHorarioCompleto,
} from "@/lib/agendaTimeLww";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";

export type AgendaTimeConflictModalProps = {
  event: ConsultationRecord;
  onResolve: (keep: "google" | "turquesa") => void | Promise<void>;
  onDismiss?: () => void;
  resolving?: boolean;
};

export default function AgendaTimeConflictModal({
  event,
  onResolve,
  onDismiss,
  resolving = false,
}: AgendaTimeConflictModalProps) {
  useBodyScrollLock(true);

  const googleInicio = event.conflictGoogleInicio ?? event.start;
  const turquesaInicio = event.start;
  const googleLabel = formatAgendaHorarioCompleto(String(googleInicio));
  const turquesaLabel = formatAgendaHorarioCompleto(String(turquesaInicio));
  const timesLookEqual = agendaTimesEqual(
    { inicio: String(googleInicio), fim: event.conflictGoogleFim ?? event.end ?? null },
    { inicio: String(turquesaInicio), fim: event.end ?? null },
  );
  const patient = event.patient?.trim() || "Cliente";

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4 pointer-events-auto touch-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="agenda-time-conflict-title"
      onClick={() => {
        if (!resolving) onDismiss?.();
      }}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl pointer-events-auto touch-auto pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="agenda-time-conflict-title"
          className="text-lg font-semibold text-slate-900"
        >
          Conflito de horário
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          O agendamento de <strong>{patient}</strong> foi alterado no Google e no
          Turquesa quase ao mesmo tempo. Qual horário deseja manter?
        </p>
        {timesLookEqual ? (
          <p className="mt-2 text-sm text-amber-800">
            Os dois horários estão muito próximos no relógio. Escolha a origem
            que deseja manter, ou toque em Depois para resolver mais tarde.
          </p>
        ) : null}

        <div className="mt-4 grid gap-3">
          <button
            type="button"
            disabled={resolving}
            onClick={() => void onResolve("google")}
            className="min-h-12 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-left touch-manipulation hover:border-violet-400 disabled:opacity-60"
          >
            <span className="block text-xs font-semibold uppercase tracking-wide text-violet-700">
              Google
            </span>
            <span className="text-lg font-semibold text-slate-900">{googleLabel}</span>
          </button>

          <button
            type="button"
            disabled={resolving}
            onClick={() => void onResolve("turquesa")}
            className="min-h-12 rounded-xl border border-[#047482]/30 bg-[#f2fff2] px-4 py-3 text-left touch-manipulation hover:border-[#047482] disabled:opacity-60"
          >
            <span className="block text-xs font-semibold uppercase tracking-wide text-[#047482]">
              Turquesa
            </span>
            <span className="text-lg font-semibold text-slate-900">{turquesaLabel}</span>
          </button>
        </div>

        <p className="mt-4 text-center text-sm font-medium text-slate-700">
          Google: {googleLabel} / Turquesa: {turquesaLabel} — manter qual?
        </p>

        <div className="mt-4 flex items-center justify-end gap-2">
          {onDismiss ? (
            <button
              type="button"
              disabled={resolving}
              onClick={onDismiss}
              className="min-h-11 min-w-[5.5rem] rounded-lg px-4 py-2 text-sm font-medium text-slate-700 touch-manipulation hover:bg-slate-100 disabled:opacity-60"
            >
              Depois
            </button>
          ) : null}
          {resolving ? (
            <span className="inline-flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Salvando…
            </span>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
