export type ResgateWhatsappSettings = {
  resgate_cliente_ativo: boolean;
  /** Dias sem sessão realizada para entrar na fila do Dashboard (padrão 30). */
  resgate_dias_limite: number;
};

export const DEFAULT_RESGATE_SETTINGS: ResgateWhatsappSettings = {
  resgate_cliente_ativo: false,
  resgate_dias_limite: 30,
};

export function clampResgateDiasLimite(n: number): number {
  if (!Number.isFinite(n)) return 30;
  return Math.min(365, Math.max(7, Math.round(n)));
}
