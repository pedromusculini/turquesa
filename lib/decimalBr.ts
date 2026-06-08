/** Parse/format decimal numbers in PT-BR (comma as separator). */

export function parseDecimalBr(value: string): number {
  const normalized = value.trim().replace(',', '.');
  if (!normalized || normalized === '.') return 0;
  const num = parseFloat(normalized);
  return Number.isFinite(num) ? num : 0;
}

export function formatDecimalBr(value: number, fractionDigits?: number): string {
  const str =
    fractionDigits !== undefined ? value.toFixed(fractionDigits) : String(value);
  return str.replace('.', ',');
}

/** Allows digits with optional comma or dot as decimal separator while typing. */
export function isDecimalBrInput(value: string): boolean {
  return /^\d*[,.]?\d*$/.test(value);
}
