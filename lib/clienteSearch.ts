import { normalizeNome } from '@/lib/phoneMatch';

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = temp;
    }
  }
  return row[b.length];
}

function tokenize(text: string): string[] {
  return normalizeNome(text)
    .split(' ')
    .filter((w) => w.length > 0);
}

function tokenMatchScore(queryToken: string, hayTokens: string[], hayNorm: string): number {
  if (!queryToken) return 0;

  let best = 0;
  for (const ht of hayTokens) {
    if (ht === queryToken) best = Math.max(best, 200);
    else if (ht.startsWith(queryToken)) best = Math.max(best, 150);
    else if (ht.includes(queryToken)) best = Math.max(best, 100);
    else if (queryToken.length >= 2) {
      const maxDist = queryToken.length <= 4 ? 1 : 2;
      const dist = levenshtein(queryToken, ht);
      if (dist <= maxDist) {
        const sim = 1 - dist / Math.max(queryToken.length, ht.length);
        if (sim >= 0.75) best = Math.max(best, 50 + sim * 50);
      }
    }
  }

  if (best === 0 && hayNorm.includes(queryToken)) return 80;
  return best;
}

/** Pontua relevância da busca (0 = sem match). Maior = mais relevante. */
export function scoreClienteMatch(haystack: string, query: string): number {
  const qRaw = query.trim();
  if (!qRaw) return 0;

  const qNorm = normalizeNome(qRaw);
  const hNorm = normalizeNome(haystack);
  if (!qNorm || !hNorm) return 0;

  if (hNorm === qNorm) return 1000;
  if (hNorm.includes(qNorm)) return 900;

  const qTokens = tokenize(qRaw);
  const hTokens = tokenize(haystack);
  if (qTokens.length === 0) return 0;

  let tokenScore = 0;
  for (const qt of qTokens) {
    const score = tokenMatchScore(qt, hTokens, hNorm);
    if (score === 0) return 0;
    tokenScore += score;
  }
  const avgToken = tokenScore / qTokens.length;
  if (avgToken >= 100) return 400 + avgToken;

  if (qNorm.length >= 3) {
    const maxDist = qNorm.length <= 4 ? 1 : 2;
    const dist = levenshtein(qNorm, hNorm);
    if (dist <= maxDist) {
      const sim = 1 - dist / Math.max(qNorm.length, hNorm.length);
      if (sim >= 0.75) return 300 + sim * 100;
    }
  }

  return 0;
}

export function clienteMatchesQuery(haystack: string, query: string): boolean {
  return scoreClienteMatch(haystack, query) > 0;
}

export function filterAndSortByClienteQuery<T>(
  items: T[],
  query: string | undefined,
  getHaystack: (item: T) => string,
  getLabel?: (item: T) => string,
): T[] {
  const q = query?.trim();
  if (!q) return items;

  return items
    .map((item) => ({
      item,
      score: scoreClienteMatch(getHaystack(item), q),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const la = getLabel?.(a.item) ?? getHaystack(a.item);
      const lb = getLabel?.(b.item) ?? getHaystack(b.item);
      return la.localeCompare(lb, 'pt-BR');
    })
    .map((x) => x.item);
}
