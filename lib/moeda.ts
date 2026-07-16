/**
 * Máscara e parsing de valores monetários em pt-BR.
 *
 * A entrada é sempre mascarada "da direita para a esquerda" (centavos primeiro),
 * garantindo vírgula decimal e 2 casas — impossível salvar um valor sem vírgula.
 * Ex.: digitar "5" -> "0,05"; "5000" -> "50,00"; "123456" -> "1.234,56".
 */

/** Converte a digitação bruta em string mascarada "1.234,56" (ou '' se vazio). */
export function maskCentavosBRL(raw: string | number | null | undefined): string {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return '';
  // Evita overflow em digitações absurdas; limita a 13 dígitos (bilhões).
  const trimmed = digits.slice(0, 13);
  const cents = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(cents)) return '';
  const reais = Math.floor(cents / 100);
  const centavos = String(cents % 100).padStart(2, '0');
  return `${reais.toLocaleString('pt-BR')},${centavos}`;
}

/**
 * Converte string monetária pt-BR (com ou sem separador de milhar) em número.
 * Robusto para valores legados: "1.234,56", "1234,56", "1234.56", "1234" e números.
 */
export function parseValorBRL(input: string | number | null | undefined): number {
  if (typeof input === 'number') return Number.isFinite(input) ? input : 0;
  if (input == null) return 0;
  const cleaned = String(input).replace(/[^\d.,-]/g, '').trim();
  if (!cleaned) return 0;

  let normalized: string;
  if (cleaned.includes(',')) {
    // Vírgula é o decimal; pontos são separadores de milhar.
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    // Sem vírgula: ponto (se houver) é tratado como decimal.
    normalized = cleaned;
  }
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
}

/** Formata um número (reais) para a string mascarada usada no input. '' se vazio. */
export function formatValorBRLInput(
  value: number | string | null | undefined,
): string {
  if (value == null || value === '') return '';
  const num = typeof value === 'number' ? value : parseValorBRL(value);
  if (!Number.isFinite(num) || num <= 0) return '';
  const cents = Math.round(num * 100);
  return maskCentavosBRL(String(cents));
}
