/** Cores distintas por profissional na agenda (FullCalendar). */
export const AGENDA_COR_PRESETS = [
  { background: '#D9F0F2', border: '#047482' },
  { background: '#fce8dc', border: '#c69c6c' },
  { background: '#dceef2', border: '#3795a1' },
  { background: '#e8f5e9', border: '#2e7d32' },
  { background: '#ede7f6', border: '#5c7cfa' },
  { background: '#fff3e0', border: '#e07a5f' },
  { background: '#e0f2f1', border: '#81b29a' },
  { background: '#f3e5f5', border: '#8e24aa' },
  { background: '#fff8e1', border: '#f9a825' },
  { background: '#e3f2fd', border: '#1565c0' },
  { background: '#fbe9e7', border: '#d84315' },
  { background: '#f1f8e9', border: '#558b2f' },
] as const;

const AGENDA_PROFISSIONAL_PALETTE = AGENDA_COR_PRESETS;

export function normalizeCorAgenda(raw: unknown): string | null {
  if (raw == null || String(raw).trim() === '') return null;
  let hex = String(raw).trim();
  if (!hex.startsWith('#')) hex = `#${hex}`;
  if (/^#[0-9A-Fa-f]{3}$/.test(hex)) {
    hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return null;
  return hex.toLowerCase();
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.slice(1);
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((x) => Math.round(Math.min(255, Math.max(0, x))).toString(16).padStart(2, '0'))
    .join('')}`;
}

/** Converte cor hex salva em clinica_medicos.cor_agenda para par fundo/borda. */
export function colorsFromCorAgenda(corAgenda: string): { background: string; border: string } {
  const normalized = normalizeCorAgenda(corAgenda);
  if (!normalized) {
    return AGENDA_PROFISSIONAL_PALETTE[0]!;
  }

  const preset = AGENDA_PROFISSIONAL_PALETTE.find(
    (p) =>
      p.border.toLowerCase() === normalized || p.background.toLowerCase() === normalized,
  );
  if (preset) return { background: preset.background, border: preset.border };

  const [r, g, b] = hexToRgb(normalized);
  const mix = 0.88;
  return {
    background: rgbToHex(r + (255 - r) * mix, g + (255 - g) * mix, b + (255 - b) * mix),
    border: normalized,
  };
}

export type ProfissionalColorSource = {
  /** ID em clinica_medicos (preferido — estável mesmo se o nome mudar) */
  profissionalId?: string | null;
  medico?: string | null;
};

export type ProfissionalColorLookup = {
  id: string;
  nome: string;
  cor_agenda?: string | null;
};

export type ProfissionalColorMap = Map<string, { background: string; border: string }>;

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hash;
}

/** Mapa estável: cada id de clinica_medicos recebe cor distinta (sem colisão de hash). */
export function buildProfissionalColorMap(
  profissionais: ProfissionalColorLookup[],
  titularNome?: string | null,
): ProfissionalColorMap {
  const map: ProfissionalColorMap = new Map();
  const sorted = [...profissionais].sort((a, b) => a.id.localeCompare(b.id));

  sorted.forEach((p, idx) => {
    const custom = p.cor_agenda?.trim();
    if (custom) {
      map.set(p.id, colorsFromCorAgenda(custom));
    } else {
      map.set(p.id, AGENDA_PROFISSIONAL_PALETTE[idx % AGENDA_PROFISSIONAL_PALETTE.length]!);
    }
  });

  const titular = titularNome?.trim();
  if (titular) {
    const titularKey = `titular:${titular.toLowerCase()}`;
    if (!map.has(titularKey)) {
      const idx =
        Math.abs(hashString(titularKey)) % AGENDA_PROFISSIONAL_PALETTE.length;
      map.set(titularKey, AGENDA_PROFISSIONAL_PALETTE[idx]!);
    }
  }

  return map;
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
  colorMap?: ProfissionalColorMap | null,
): { background: string; border: string } | null {
  const normalized: ProfissionalColorSource =
    typeof source === 'string' || source == null
      ? { medico: source ?? undefined }
      : source;

  const id = normalized.profissionalId?.trim();
  if (id && colorMap?.has(id)) {
    return colorMap.get(id)!;
  }

  const nome = normalized.medico?.trim();
  if (nome && colorMap) {
    const titularKey = `titular:${nome.toLowerCase()}`;
    if (colorMap.has(titularKey)) return colorMap.get(titularKey)!;
  }

  const key = profissionalAgendaColorKey(normalized);
  if (!key) return null;
  const idx = Math.abs(hashString(key)) % AGENDA_PROFISSIONAL_PALETTE.length;
  return AGENDA_PROFISSIONAL_PALETTE[idx]!;
}

/** Resolve id de cor evitando googleProfissionalId obsoleto após troca de profissional. */
export function resolveProfissionalIdForColor(
  ev: {
    medico?: string | null;
    medicoProfissionalId?: string | null;
    googleProfissionalId?: string | null;
  },
  profissionais: ProfissionalColorLookup[] = [],
): string | null {
  const medico = ev.medico?.trim();
  if (medico && profissionais.length > 0) {
    const trimmed = medico.toLowerCase();
    const exact = profissionais.find((p) => p.nome.toLowerCase() === trimmed);
    if (exact) return exact.id;
    const partial = profissionais.find((p) => {
      const full = p.nome.toLowerCase();
      const first = full.split(/\s+/)[0];
      return first === trimmed || full.startsWith(`${trimmed} `);
    });
    if (partial) return partial.id;
  }

  if (ev.medicoProfissionalId?.trim()) {
    return ev.medicoProfissionalId.trim();
  }

  const googleId = ev.googleProfissionalId?.trim();
  if (googleId && medico && profissionais.length > 0) {
    const googleNome = profissionais.find((p) => p.id === googleId)?.nome;
    if (googleNome && googleNome.toLowerCase() === medico.toLowerCase()) {
      return googleId;
    }
    return null;
  }

  return googleId ?? null;
}

/** Resolve cores a partir dos campos de um evento da agenda. */
export function colorsForConsultationEvent(
  ev: {
    medico?: string | null;
    medicoProfissionalId?: string | null;
    googleProfissionalId?: string | null;
  },
  options?: {
    profissionais?: ProfissionalColorLookup[];
    colorMap?: ProfissionalColorMap | null;
  },
): { background: string; border: string } | null {
  const profissionalId = resolveProfissionalIdForColor(ev, options?.profissionais);
  return profissionalAgendaColors(
    {
      profissionalId,
      medico: ev.medico,
    },
    options?.colorMap,
  );
}

/** Cores para preview no modal (nome ainda não salvo). */
export function colorsForMedicoNome(
  medicoNome: string,
  options?: {
    profissionais?: ProfissionalColorLookup[];
    colorMap?: ProfissionalColorMap | null;
  },
): { background: string; border: string } | null {
  const nome = medicoNome.trim();
  if (!nome) return null;
  const profissionais = options?.profissionais ?? [];
  let profissionalId: string | null = null;
  if (profissionais.length > 0) {
    const trimmed = nome.toLowerCase();
    const exact = profissionais.find((p) => p.nome.toLowerCase() === trimmed);
    if (exact) profissionalId = exact.id;
    else {
      const partial = profissionais.find((p) => {
        const full = p.nome.toLowerCase();
        const first = full.split(/\s+/)[0];
        return first === trimmed || full.startsWith(`${trimmed} `);
      });
      profissionalId = partial?.id ?? null;
    }
  }
  return profissionalAgendaColors({ profissionalId, medico: nome }, options?.colorMap);
}
