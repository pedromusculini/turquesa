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

export type GoogleProfissionalTransferCheck = {
  previousGoogleProfId?: string | null;
  targetProfId?: string | null;
  previousMedicoProfId?: string | null;
  previousMedico?: string | null;
  nextMedico?: string | null;
};

/** Troca de agenda Google: criar na nova profissional e remover o evento antigo. */
export function shouldTransferGoogleCalendar(
  check: GoogleProfissionalTransferCheck,
): boolean {
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
