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

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hash;
}

export function profissionalAgendaColors(
  medico?: string | null,
): { background: string; border: string } | null {
  const key = medico?.trim();
  if (!key) return null;
  const idx = Math.abs(hashString(key.toLowerCase())) % AGENDA_PROFISSIONAL_PALETTE.length;
  return AGENDA_PROFISSIONAL_PALETTE[idx]!;
}
