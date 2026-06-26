"use client";

import { AlertCircle, Check, X } from "lucide-react";
import type { AgendaSyncHealth } from "@/lib/agendaSyncHealth";
import {
  SYNC_HEALTH_UI,
  shouldShowSyncHealthBadge,
} from "@/lib/agendaSyncHealthUi";

type AgendaSyncHealthBadgeProps = {
  health: AgendaSyncHealth;
  /** Compacto para células do calendário */
  compact?: boolean;
  className?: string;
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
};

export default function AgendaSyncHealthBadge({
  health,
  compact = false,
  className = "",
}: AgendaSyncHealthBadgeProps) {
  if (!shouldShowSyncHealthBadge(health)) return null;

  const meta = SYNC_HEALTH_UI[health];
  const styles = BADGE_STYLES[health as Exclude<AgendaSyncHealth, "turquesa_only">];
  const size = compact ? "h-4 w-4 min-w-4" : "h-5 w-5 min-w-5";
  const iconSize = compact ? 10 : 12;

  const Icon =
    health === "linked_ok"
      ? Check
      : health === "linked_partial"
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
