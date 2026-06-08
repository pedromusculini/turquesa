/** Cores distintas por profissional na agenda (FullCalendar). */
const AGENDA_PROFISSIONAL_PALETTE = [
  { background: '#D9F0F2', border: '#047482' },
  { background: '#fce8dc', border: '#c69c6c' },
  { background: '#dceef2', border: '#3795a1' },
  { background: '#e8f5e9', border: '#2e7d32' },
  { background: '#ede7f6', border: '#5c7cfa' },
  { background: '#fff3e0', border: '#e07a5f' },
  { background: '#e0f2f1', border: '#81b29a' },
  { background: '#f3e5f5', border: '#8e24aa' },
] as const;

export type ProfissionalColorSource = {
  /** ID em clinica_medicos (preferido — estável mesmo se o nome mudar) */
  profissionalId?: string | null;
  medico?: string | null;
};

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hash;
}

/** Chave de hash: id da profissional tem prioridade sobre o nome. */
export function profissionalAgendaColorKey(
  source: ProfissionalColorSource | string | null | undefined,
): string | null {
  const normalized: ProfissionalColorSource =
    typeof source === 'string' || source == null
      ? { medico: source ?? undefined }
      : source;

  const id = normalized.profissionalId?.trim();
  if (id) return `id:${id}`;

  const nome = normalized.medico?.trim();
  if (nome) return `nome:${nome.toLowerCase()}`;

  return null;
}

export function profissionalAgendaColors(
  source: ProfissionalColorSource | string | null | undefined,
): { background: string; border: string } | null {
  const key = profissionalAgendaColorKey(source);
  if (!key) return null;
  const idx = Math.abs(hashString(key)) % AGENDA_PROFISSIONAL_PALETTE.length;
  return AGENDA_PROFISSIONAL_PALETTE[idx]!;
}

/** Resolve cores a partir dos campos de um evento da agenda. */
export function colorsForConsultationEvent(ev: {
  medico?: string | null;
  medicoProfissionalId?: string | null;
  googleProfissionalId?: string | null;
}): { background: string; border: string } | null {
  return profissionalAgendaColors({
    profissionalId: ev.medicoProfissionalId ?? ev.googleProfissionalId,
    medico: ev.medico,
  });
}
