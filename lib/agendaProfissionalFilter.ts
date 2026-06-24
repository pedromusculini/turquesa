import type { ConsultationRecord } from '@/lib/consultations';
import {
  profissionalIdByNome,
  type ProfissionalOption,
} from '@/lib/loadMedicosOptions';

/** Eventos sem profissional atribuída. */
export const UNASSIGNED_PROF_FILTER_KEY = '__sem_profissional__';

export type ProfissionalFilterEntry = {
  key: string;
  nome: string;
  corAgenda?: string | null;
};

const FILTER_PALETTE = [
  { background: '#D9F0F2', border: '#047482' },
  { background: '#fce8dc', border: '#c69c6c' },
  { background: '#dceef2', border: '#3795a1' },
  { background: '#e8f5e9', border: '#2e7d32' },
  { background: '#ede7f6', border: '#5c7cfa' },
  { background: '#fff3e0', border: '#e07a5f' },
] as const;

function hashString(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (h << 5) - h + value.charCodeAt(i);
    h |= 0;
  }
  return h;
}

export function titularFilterKey(nome: string): string {
  return `titular:${nome.trim().toLowerCase()}`;
}

export function medicoToFilterKey(
  medicoNome: string,
  profissionais: ProfissionalOption[],
): string {
  const id = profissionalIdByNome(profissionais, medicoNome);
  if (id) return id;
  return titularFilterKey(medicoNome);
}

export function buildProfissionalFilterEntries(
  medicos: string[],
  profissionais: ProfissionalOption[],
): ProfissionalFilterEntry[] {
  if (medicos.length <= 1) return [];

  return medicos.map((nome) => {
    const id = profissionalIdByNome(profissionais, nome);
    const prof = id ? profissionais.find((p) => p.id === id) : undefined;
    return {
      key: id ?? titularFilterKey(nome),
      nome,
      corAgenda: prof?.cor_agenda ?? null,
    };
  });
}

export function resolveEventFilterKey(
  ev: ConsultationRecord,
  profissionais: ProfissionalOption[],
): string {
  if (ev.medicoProfissionalId) return ev.medicoProfissionalId;
  if (ev.googleProfissionalId) return ev.googleProfissionalId;
  const medico = ev.medico?.trim();
  if (medico) return medicoToFilterKey(medico, profissionais);
  return UNASSIGNED_PROF_FILTER_KEY;
}

export function filterEventsByVisibleProfissionais(
  events: ConsultationRecord[],
  visibleKeys: Set<string>,
  profissionais: ProfissionalOption[],
): ConsultationRecord[] {
  if (visibleKeys.size === 0) return [];
  return events.filter((ev) =>
    visibleKeys.has(resolveEventFilterKey(ev, profissionais)),
  );
}

export function hasUnassignedProfissionalEvents(
  events: ConsultationRecord[],
  profissionais: ProfissionalOption[],
): boolean {
  return events.some(
    (ev) => resolveEventFilterKey(ev, profissionais) === UNASSIGNED_PROF_FILTER_KEY,
  );
}

export function allProfFilterKeys(
  entries: ProfissionalFilterEntry[],
  includeUnassigned: boolean,
): Set<string> {
  const keys = new Set(entries.map((e) => e.key));
  if (includeUnassigned) keys.add(UNASSIGNED_PROF_FILTER_KEY);
  return keys;
}

export function sanitizeVisibleKeys(
  saved: Set<string>,
  valid: Set<string>,
): Set<string> {
  const next = new Set<string>();
  for (const k of saved) {
    if (valid.has(k)) next.add(k);
  }
  return next;
}

export function loadVisibleProfKeys(storageKey: string): Set<string> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return new Set(parsed.filter((x): x is string => typeof x === 'string'));
  } catch {
    return null;
  }
}

export function saveVisibleProfKeys(storageKey: string, keys: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey, JSON.stringify([...keys]));
  } catch {
    /* quota / modo privado Safari */
  }
}

export function swatchForFilterEntry(
  entry: ProfissionalFilterEntry,
  index: number,
): { background: string; border: string } {
  if (entry.corAgenda) {
    const hex = entry.corAgenda.startsWith('#')
      ? entry.corAgenda
      : `#${entry.corAgenda}`;
    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      return { background: `${hex}22`, border: hex };
    }
  }
  const preset = FILTER_PALETTE[Math.abs(hashString(entry.key)) % FILTER_PALETTE.length]!;
  return { background: preset.background, border: preset.border };
}

export function agendaProfFilterStorageKey(userEmail: string): string {
  return `agenda-prof-filter:${userEmail.toLowerCase().trim()}`;
}
