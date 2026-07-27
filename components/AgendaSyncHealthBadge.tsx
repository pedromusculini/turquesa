"use client";

import { AlertCircle, Check, RefreshCw, X } from "lucide-react";
import type { AgendaSyncHealth } from "@/lib/agendaSyncHealth";
import {
  SYNC_HEALTH_UI,
  shouldShowSyncHealthBadge,
} from "@/lib/agendaSyncHealthUi";

type AgendaSyncHealthBadgeProps = {
  health: AgendaSyncHealth;
  /** Estado do outbox durável de sync com o Google (tem precedência visual). */
  googleOutbox?: "pending" | "error" | null;
  /** Compacto para células do calendário */
  compact?: boolean;
  className?: string;
  /** Reenviar item desta sessão (quando outbox = error). */
  onRetry?: () => void;
};

const BADGE_STYLES: Record<
  Exclude<AgendaSyncHealth, "turquesa_only">,
  { wrap: string; icon: string }
> = {
  google_only: {
    wrap: "bg-red-100 text-red-700 border-red-200",
    icon: "text-red-600",
  },
  linked_ok: {
    wrap: "bg-emerald-100 text-emerald-800 border-emerald-200",
    icon: "text-emerald-700",
  },
  linked_partial: {
    wrap: "bg-amber-100 text-amber-900 border-amber-200",
    icon: "text-amber-700",
  },
  needs_review: {
    wrap: "bg-violet-100 text-violet-900 border-violet-200",
    icon: "text-violet-700",
  },
};

export default function AgendaSyncHealthBadge({
  health,
  googleOutbox = null,
  compact = false,
  className = "",
  onRetry,
}: AgendaSyncHealthBadgeProps) {
  const size = compact ? "h-4 w-4 min-w-4" : "h-5 w-5 min-w-5";
  const iconSize = compact ? 10 : 12;

  // Outbox tem precedência: mostra "enviando" (âmbar) ou "falha" (vermelho),
  // inclusive para sessões que ainda não têm evento no Google (turquesa_only).
  if (googleOutbox === "pending" || googleOutbox === "error") {
    const isError = googleOutbox === "error";
    const wrap = isError
      ? "bg-red-100 text-red-700 border-red-200"
      : "bg-amber-100 text-amber-900 border-amber-200";
    const iconColor = isError ? "text-red-600" : "text-amber-700";
    const Icon = isError ? AlertCircle : RefreshCw;
    const title = isError
      ? onRetry
        ? "Falha ao sincronizar com o Google — clique para reenviar"
        : "Falha ao sincronizar com o Google — será reenviado automaticamente"
      : "Enviando ao Google Agenda…";
    const aria = isError
      ? "Falha ao sincronizar com o Google"
      : "Enviando ao Google";

    if (isError && onRetry) {
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onRetry();
          }}
          className={`inline-flex shrink-0 items-center justify-center rounded-full border ${size} ${wrap} ${className}`}
          title={title}
          aria-label={`${aria}. Reenviar`}
        >
          <Icon className={iconColor} size={iconSize} strokeWidth={2.5} aria-hidden />
        </button>
      );
    }

    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-full border ${size} ${wrap} ${className}`}
        title={title}
        aria-label={aria}
        role="img"
      >
        <Icon className={iconColor} size={iconSize} strokeWidth={2.5} aria-hidden />
      </span>
    );
  }

  if (!shouldShowSyncHealthBadge(health)) return null;

  const meta = SYNC_HEALTH_UI[health];
  const styles = BADGE_STYLES[health as Exclude<AgendaSyncHealth, "turquesa_only">];

  const Icon =
    health === "linked_ok"
      ? Check
      : health === "linked_partial" || health === "needs_review"
        ? AlertCircle
        : X;

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full border ${size} ${styles.wrap} ${className}`}
      title={meta.tooltip}
      aria-label={meta.ariaLabel}
      role="img"
    >
      <Icon className={styles.icon} size={iconSize} strokeWidth={2.5} aria-hidden />
    </span>
  );
}
