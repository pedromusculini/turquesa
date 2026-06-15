/** Faixa ITU-T E.164 razoável (dígitos após +). */
const INTL_MIN_DIGITS = 8;
const INTL_MAX_DIGITS = 15;

export const PHONE_INTL_HINT =
  'Número internacional — use + e código do país (ex.: +1 …, +351 …)';

/** Input internacional quando começa com + (após trim). */
export function isInternationalPhoneInput(raw: string | null | undefined): boolean {
  return String(raw ?? '').trim().startsWith('+');
}

/** Telefone armazenado/exibido como internacional (E.164 com +). */
export function isInternationalPhone(stored: string | null | undefined): boolean {
  return String(stored ?? '').trim().startsWith('+');
}

/** Todos os dígitos — comparação E.164 e WhatsApp. */
export function digitsOnlyE164(raw: string | null | undefined): string {
  return String(raw ?? '').replace(/\D/g, '');
}

function formatIntlFromDigits(digits: string): string {
  if (!digits) return '+';
  let out = '+';
  for (let i = 0; i < digits.length; i += 3) {
    out += (i === 0 ? '' : ' ') + digits.slice(i, Math.min(i + 3, digits.length));
  }
  return out;
}

/** Dígitos locais BR (DDD + número), sem código do país 55. */
export function brPhoneLocalDigits(phone: string | null | undefined): string {
  if (phone == null || phone === '') return '';
  const trimmed = String(phone).trim();
  if (trimmed.startsWith('+')) return '';
  let d = trimmed.replace(/\D/g, '');
  if (!d.startsWith('55') && d.length > 11) return '';
  if (d.startsWith('55') && d.length >= 11) d = d.slice(2);
  if (d.startsWith('0') && d.length >= 11) d = d.slice(1);
  if (d.length > 11) d = d.slice(-11);
  return d;
}

/** Exibe telefone com máscara (DD) 9XXXX-XXXX — nunca mostra 55 como DDD. */
export function formatarTelefoneBr(phone: string | null | undefined): string {
  const d = brPhoneLocalDigits(phone);
  return mascaraTelefoneFromDigits(d);
}

/** Formata até 11 dígitos locais para exibição em input. */
function mascaraTelefoneFromDigits(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  }
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
}

function mascaraTelefoneIntlInput(novoValor: string, valorAnterior?: string): string {
  const digits = String(novoValor ?? '')
    .replace(/\D/g, '')
    .slice(0, INTL_MAX_DIGITS);
  const prevDigits = String(valorAnterior ?? '').replace(/\D/g, '');
  if (
    valorAnterior &&
    novoValor.length < valorAnterior.length &&
    digits.length === prevDigits.length &&
    digits.length > 0
  ) {
    return formatIntlFromDigits(digits.slice(0, -1));
  }
  return formatIntlFromDigits(digits);
}

/**
 * Máscara para campo controlado — BR ou internacional (+ prefix).
 * Permite apagar dígito a dígito (inclusive no mobile).
 */
export function mascaraTelefoneInput(
  novoValor: string,
  valorAnterior?: string,
): string {
  const trimmed = String(novoValor ?? '').trimStart();
  const prevIntl =
    isInternationalPhoneInput(valorAnterior) ||
    (String(valorAnterior ?? '').includes('+') && trimmed.startsWith('+'));
  if (isInternationalPhoneInput(trimmed) || prevIntl || trimmed.startsWith('+')) {
    return mascaraTelefoneIntlInput(novoValor, valorAnterior);
  }
  const digits = String(novoValor ?? '').replace(/\D/g, '').slice(0, 11);
  const prevDigits = String(valorAnterior ?? '').replace(/\D/g, '');
  if (
    valorAnterior &&
    novoValor.length < valorAnterior.length &&
    digits.length === prevDigits.length &&
    digits.length > 0
  ) {
    return mascaraTelefoneFromDigits(digits.slice(0, -1));
  }
  return mascaraTelefoneFromDigits(digits);
}

/** Alias unificado — BR ou internacional conforme prefixo +. */
export function phoneInputMask(novoValor: string, valorAnterior?: string): string {
  return mascaraTelefoneInput(novoValor, valorAnterior);
}

/** Exibição unificada — BR mascarado ou internacional legível. */
export function formatPhoneDisplay(raw: string | null | undefined): string {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return '';
  if (isInternationalPhone(trimmed) || isInternationalPhoneInput(trimmed)) {
    return formatIntlFromDigits(digitsOnlyE164(trimmed));
  }
  return formatarTelefoneBr(trimmed);
}

export function phoneInputPlaceholder(currentValue?: string): string {
  if (isInternationalPhoneInput(currentValue)) return '+1 555 123 4567';
  return '(11) 99999-9999';
}

export function isValidPhone(raw: string | null | undefined): boolean {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return false;
  if (isInternationalPhoneInput(trimmed) || isInternationalPhone(trimmed)) {
    const d = digitsOnlyE164(trimmed);
    return d.length >= INTL_MIN_DIGITS && d.length <= INTL_MAX_DIGITS;
  }
  const d = brPhoneLocalDigits(trimmed);
  return d.length >= 10 && d.length <= 11;
}

/** Dígitos-only de normalizePhoneForWhatsApp (ex.: 15551234567) — gravar como + internacional. */
function looksLikeIntlDigitsWithoutPlus(digits: string): boolean {
  if (digits.length < INTL_MIN_DIGITS || digits.length > INTL_MAX_DIGITS) return false;
  if (digits.startsWith('55') && digits.length >= 12) return true;
  if (digits.length === 11 && digits.startsWith('1')) {
    const area = digits.slice(1, 4);
    return /^[2-9]\d{2}$/.test(area);
  }
  return false;
}

/** Normaliza telefone para gravar no cadastro (Drive). */
export function normalizarTelefoneCadastro(
  raw: string | null | undefined,
): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  if (isInternationalPhoneInput(trimmed) || isInternationalPhone(trimmed)) {
    const digits = digitsOnlyE164(trimmed);
    if (digits.length >= INTL_MIN_DIGITS && digits.length <= INTL_MAX_DIGITS) {
      return formatIntlFromDigits(digits);
    }
    return trimmed;
  }
  const allDigits = digitsOnlyE164(trimmed);
  if (looksLikeIntlDigitsWithoutPlus(allDigits)) {
    return formatIntlFromDigits(allDigits);
  }
  const digits = brPhoneLocalDigits(trimmed);
  if (digits.length >= 10) return formatarTelefoneBr(trimmed);
  return trimmed;
}

/** Dígitos para wa.me — BR com 55; internacional sem forçar 55. */
export function normalizePhoneForWhatsApp(raw: string): string {
  const trimmed = raw.trim();
  if (isInternationalPhoneInput(trimmed) || isInternationalPhone(trimmed)) {
    return digitsOnlyE164(trimmed);
  }
  const digits = digitsOnlyE164(trimmed);
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  const local = brPhoneLocalDigits(trimmed);
  if (local.length >= 10) return `55${local}`;
  if (digits.startsWith('55')) return digits;
  return `55${digits}`;
}

/** Normaliza telefone para armazenamento (cadastro / agenda). */
export function normalizePhoneForStorage(
  raw: string | null | undefined,
): string | null {
  return normalizarTelefoneCadastro(raw);
}

/** Compara telefones — BR ignora máscara/55; internacional compara E.164 completo. */
export function phoneDigits(phone: string | null | undefined): string {
  const trimmed = String(phone ?? '').trim();
  if (isInternationalPhone(trimmed) || isInternationalPhoneInput(trimmed)) {
    return digitsOnlyE164(trimmed);
  }
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

  // NANP (+1) com/sem código do país
  if (da.length === 11 && da.startsWith('1') && da.slice(1) === db && db.length === 10) {
    return true;
  }
  if (db.length === 11 && db.startsWith('1') && db.slice(1) === da && da.length === 10) {
    return true;
  }

  // BR (+55) com/sem código do país
  if (da.length >= 12 && da.startsWith('55') && da.slice(2) === db) return true;
  if (db.length >= 12 && db.startsWith('55') && db.slice(2) === da) return true;

  const aIntl = isInternationalPhone(a) || isInternationalPhoneInput(a);
  const bIntl = isInternationalPhone(b) || isInternationalPhoneInput(b);
  if (aIntl || bIntl) return false;

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
  if (na.startsWith(`${nb} `) || nb.startsWith(`${na} `)) return true;
  const wa = na.split(' ').filter((w) => w.length > 1);
  const wb = nb.split(' ').filter((w) => w.length > 1);
  if (wa.length < 2 || wb.length < 2) return false;
  const setB = new Set(wb);
  const overlap = wa.filter((w) => setB.has(w)).length;
  return overlap >= 2 && overlap >= Math.min(wa.length, wb.length) - 1;
}
