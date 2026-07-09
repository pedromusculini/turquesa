import { CATEGORIA_LABEL, CATEGORIAS_SAIDA } from '@/lib/constants';

export type CategoriaSaida = {
  id: string;
  label: string;
};

export const MAX_CATEGORIAS_SAIDA = 30;

export function defaultCategoriasSaida(): CategoriaSaida[] {
  return CATEGORIAS_SAIDA.map((id) => ({
    id,
    label: CATEGORIA_LABEL[id] ?? id,
  }));
}

export function slugifyCategoriaSaida(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

function uniqueId(base: string, used: Set<string>, index: number): string {
  let id = base || `categoria_${index + 1}`;
  if (!used.has(id)) return id;
  let n = 2;
  while (used.has(`${id}_${n}`)) n += 1;
  return `${id}_${n}`;
}

export function sanitizeCategoriasSaidaInput(raw: unknown): CategoriaSaida[] {
  if (!Array.isArray(raw)) return defaultCategoriasSaida();

  const used = new Set<string>();
  const out: CategoriaSaida[] = [];

  for (let i = 0; i < raw.length && out.length < MAX_CATEGORIAS_SAIDA; i++) {
    const item = raw[i];
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const label = String(rec.label ?? rec.nome ?? '').trim();
    if (!label) continue;

    const rawId = String(rec.id ?? '').trim();
    const id = uniqueId(
      rawId || slugifyCategoriaSaida(label),
      used,
      i,
    );
    used.add(id);
    out.push({ id, label: label.slice(0, 60) });
  }

  return out.length > 0 ? out : defaultCategoriasSaida();
}

export function categoriaSaidaLabel(
  id: string | null | undefined,
  categorias: CategoriaSaida[],
): string {
  if (!id) return '';
  const found = categorias.find((c) => c.id === id);
  if (found) return found.label;
  return CATEGORIA_LABEL[id] ?? id.replace(/_/g, ' ');
}

export function categoriasSaidaLabelMap(
  categorias: CategoriaSaida[],
): Record<string, string> {
  const map: Record<string, string> = { ...CATEGORIA_LABEL };
  for (const c of categorias) {
    map[c.id] = c.label;
  }
  return map;
}
