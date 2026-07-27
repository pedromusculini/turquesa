export function normalizeMedicoNome(name?: string | null): string {
  return name?.trim().toLowerCase() ?? '';
}

export function medicoNomeChanged(
  previous?: string | null,
  next?: string | null,
): boolean {
  const prev = normalizeMedicoNome(previous);
  const nextN = normalizeMedicoNome(next);
  if (!prev || !nextN) return false;
  return prev !== nextN;
}

/**
 * Chave estável do calendário Google resolvido.
 * Profissional com agenda própria conectada → `prof:<id>`;
 * caso contrário (ou titular) → `owner:primary`.
 */
export function resolvedGoogleCalendarKey(
  profissionalId: string | null | undefined,
  connectedProfissionalIds: Iterable<string> | null | undefined,
): string {
  const id = profissionalId?.trim() || '';
  if (!id) return 'owner:primary';
  const connected = new Set(
    [...(connectedProfissionalIds ?? [])].map((x) => String(x).trim()).filter(Boolean),
  );
  if (connected.has(id)) return `prof:${id}`;
  return 'owner:primary';
}

export type GoogleProfissionalTransferCheck = {
  previousGoogleProfId?: string | null;
  targetProfId?: string | null;
  previousMedicoProfId?: string | null;
  previousMedico?: string | null;
  nextMedico?: string | null;
  /**
   * Quando informadas, a decisão usa só o calendário resolvido
   * (mesmo calendário / titular → update in-place, sem create+delete).
   */
  previousCalendarKey?: string | null;
  targetCalendarKey?: string | null;
};

/** Troca de agenda Google: criar na nova profissional e remover o evento antigo. */
export function shouldTransferGoogleCalendar(
  check: GoogleProfissionalTransferCheck,
): boolean {
  const prevKey = check.previousCalendarKey?.trim() || null;
  const nextKey = check.targetCalendarKey?.trim() || null;
  if (prevKey && nextKey) {
    return prevKey !== nextKey;
  }

  // Fallback legado (sem resolução de calendário): nome ou id de profissional.
  if (medicoNomeChanged(check.previousMedico, check.nextMedico)) {
    return true;
  }
  const prevProf =
    check.previousGoogleProfId?.trim() ||
    check.previousMedicoProfId?.trim() ||
    null;
  const nextProf = check.targetProfId?.trim() || null;
  if (prevProf && nextProf && prevProf !== nextProf) {
    return true;
  }
  return false;
}
