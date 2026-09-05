"use client";

import { Loader2 } from "lucide-react";
import type { ConsultationRecord } from "@/lib/consultations";
import { formatAgendaHorarioLabel } from "@/lib/agendaTimeLww";

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
  const googleInicio = event.conflictGoogleInicio ?? event.start;
  const turquesaInicio = event.start;
  const googleLabel = formatAgendaHorarioLabel(String(googleInicio));
  const turquesaLabel = formatAgendaHorarioLabel(String(turquesaInicio));
  const patient = event.patient?.trim() || "Cliente";
  const sameTime = googleLabel === turquesaLabel;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="agenda-time-conflict-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && onDismiss && !resolving) onDismiss();
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
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

        {sameTime ? (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Os dois lados mostram o mesmo horário ({turquesaLabel}). Escolha
            Turquesa para limpar o conflito e seguir, ou Depois para adiar.
          </p>
        ) : null}

        <div className="mt-4 grid gap-3">
          <button
            type="button"
            disabled={resolving}
            onClick={() => void onResolve("google")}
            className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-left hover:border-violet-400 disabled:opacity-60"
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
            className="rounded-xl border border-[#047482]/30 bg-[#f2fff2] px-4 py-3 text-left hover:border-[#047482] disabled:opacity-60"
          >
            <span className="block text-xs font-semibold uppercase tracking-wide text-[#047482]">
              Turquesa
            </span>
            <span className="text-lg font-semibold text-slate-900">{turquesaLabel}</span>
          </button>
        </div>

        {!sameTime ? (
          <p className="mt-4 text-center text-sm font-medium text-slate-700">
            Google: {googleLabel} / Turquesa: {turquesaLabel} — manter qual?
          </p>
        ) : null}

        <div className="mt-4 flex items-center justify-end gap-2">
          {onDismiss ? (
            <button
              type="button"
              disabled={resolving}
              onClick={onDismiss}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
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
    </div>
  );
}
