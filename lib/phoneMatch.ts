/** Dígitos locais BR (DDD + número), sem código do país 55. */
export function brPhoneLocalDigits(phone: string | null | undefined): string {
  if (!phone) return '';
  let d = phone.replace(/\D/g, '');
  if (d.startsWith('55') && d.length >= 11) d = d.slice(2);
  if (d.startsWith('0') && d.length >= 11) d = d.slice(1);
  if (d.length > 11) d = d.slice(-11);
  return d;
}

/** Exibe telefone com máscara (DD) 9XXXX-XXXX — nunca mostra 55 como DDD. */
export function formatarTelefoneBr(phone: string | null | undefined): string {
  const d = brPhoneLocalDigits(phone);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  }
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
}

/** Normaliza telefone para gravar no cadastro (Drive) — aceita formatos BR comuns. */
export function normalizarTelefoneCadastro(
  raw: string | null | undefined,
): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const digits = brPhoneLocalDigits(trimmed);
  if (digits.length >= 10) return formatarTelefoneBr(trimmed);
  return trimmed;
}

/** Compara telefones BR ignorando máscara e prefixo 55. */
export function phoneDigits(phone: string | null | undefined): string {
  const d = brPhoneLocalDigits(phone);
  if (d.length === 10 || d.length === 11) return d;
  return d;
}

export function phonesMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const da = phoneDigits(a);
  const db = phoneDigits(b);
  if (!da || !db) return false;
  if (da === db) return true;
  if (da.length >= 10 && db.length >= 10 && da.slice(-9) === db.slice(-9)) return true;
  return false;
}

/** Nome sem acentos/pontuação — para casar Drive com Google Contatos. */
export function normalizeNome(nome: string | null | undefined): string {
  if (!nome) return '';
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Compara nomes (exato ou contém palavras-chave suficientes). */
export function nomesMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const na = normalizeNome(a);
  const nb = normalizeNome(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // "Tereza" ↔ "Tereza Wu" (cadastro CSV sem sobrenome + Google Contatos)
  if (na.startsWith(`${nb} `) || nb.startsWith(`${na} `)) return true;
  const wa = na.split(' ').filter((w) => w.length > 1);
  const wb = nb.split(' ').filter((w) => w.length > 1);
  if (wa.length < 2 || wb.length < 2) return false;
  const setB = new Set(wb);
  const overlap = wa.filter((w) => setB.has(w)).length;
  return overlap >= 2 && overlap >= Math.min(wa.length, wb.length) - 1;
}
