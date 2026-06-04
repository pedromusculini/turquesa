import { formatCpf, isValidCpf } from '@/lib/cpf';

/** Dígitos apenas (CPF até 11, CNPJ até 14). */
export function normalizeCpfCnpj(value: string): string {
  return value.replace(/\D/g, '').slice(0, 14);
}

/** Máscara dinâmica: CPF até 11 dígitos; CNPJ a partir do 12º. */
export function formatCpfCnpj(value: string): string {
  const digits = normalizeCpfCnpj(value);
  if (digits.length <= 11) return formatCpf(digits);

  let mascara = digits.slice(0, 2);
  if (digits.length > 2) mascara += '.' + digits.slice(2, 5);
  if (digits.length > 5) mascara += '.' + digits.slice(5, 8);
  if (digits.length > 8) mascara += '/' + digits.slice(8, 12);
  if (digits.length > 12) mascara += '-' + digits.slice(12, 14);
  return mascara;
}

/** Validação opcional: vazio OK; senão 11 (CPF) ou 14 (CNPJ) dígitos. */
export function cpfCnpjValidationMessage(value: string): string | null {
  const digits = normalizeCpfCnpj(value);
  if (!digits) return null;
  if (digits.length === 11) {
    return isValidCpf(digits) ? null : 'CPF inválido';
  }
  if (digits.length === 14) return null;
  return 'Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) completo';
}
