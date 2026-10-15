export type LembretesWhatsappSettings = {
  lembrete_antecedencia_ativo: boolean;
  /** Quantos dias antes da consulta (0–99). Usado se antecedência ativa. */
  lembrete_antecedencia_dias: number;
  lembrete_1_dia_ativo: boolean;
};

export const DEFAULT_LEMBRETES_SETTINGS: LembretesWhatsappSettings = {
  lembrete_antecedencia_ativo: true,
  lembrete_antecedencia_dias: 7,
  lembrete_1_dia_ativo: true,
};

export function clampLembreteAntecedenciaDias(n: number): number {
  if (!Number.isFinite(n)) return 7;
  return Math.min(99, Math.max(0, Math.round(n)));
}

/** Aceita só dígitos na UI (0–99), sem setas de number input. */
export function parseDiasInputString(raw: string): number {
  const digits = raw.replace(/\D/g, '').slice(0, 2);
  if (digits === '') return 0;
  return clampLembreteAntecedenciaDias(parseInt(digits, 10));
}
