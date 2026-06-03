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
