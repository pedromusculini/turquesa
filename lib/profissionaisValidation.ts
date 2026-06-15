import { isValidPhone } from '@/lib/phoneMatch';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateProfissionalEmail(email: string): string | undefined {
  const trimmed = email.trim();
  if (!trimmed) return undefined;
  if (!EMAIL_RE.test(trimmed)) return 'E-mail inválido';
  return undefined;
}

export function validateProfissionalWhatsapp(whatsapp: string): string | undefined {
  const trimmed = whatsapp.trim();
  if (!trimmed) return undefined;
  if (!isValidPhone(trimmed)) {
    return 'WhatsApp inválido — BR com DDD (10–11 dígitos) ou internacional com + (8–15 dígitos)';
  }
  return undefined;
}

export function validatePercentualComissao(value: string): string | undefined {
  const n = Number(value);
  if (Number.isNaN(n) || n < 0 || n > 100) {
    return 'Comissão deve ser entre 0 e 100';
  }
  return undefined;
}
