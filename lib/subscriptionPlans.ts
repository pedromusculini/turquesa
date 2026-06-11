import { PLANOS } from '@/lib/constants';
import { DEFAULT_LIST_PRICE, PRICE_LOCK_MONTHS } from '@/lib/subscriptionPricing';

export type PlanId = keyof typeof PLANOS;

/** Contrato comercial: preço garantido por 12 meses (ver termos de uso). */
export { PRICE_LOCK_MONTHS, DEFAULT_LIST_PRICE };

/** IDs legados ainda presentes em contas antigas (somente leitura). */
const LEGACY_PLAN_IDS = ['medico-pix', 'clinica-5-pix', 'clinica-10-pix'] as const;
export type LegacyPlanId = (typeof LEGACY_PLAN_IDS)[number];
export type StoredPlanId = PlanId | LegacyPlanId;

export const PLAN_IDS: PlanId[] = ['ilimitado'];

const MAX_PROFISSIONAIS = 999;

export function isValidPlanId(value: string): value is StoredPlanId {
  return value in PLANOS || (LEGACY_PLAN_IDS as readonly string[]).includes(value);
}

export function isCurrentPlanId(value: string): value is PlanId {
  return value in PLANOS;
}

/** Tipo operacional da conta (legado: medico | clinica/salão). */
export function planToUserType(_plan: StoredPlanId): 'medico' | 'clinica' {
  return 'clinica';
}

/** Máximo de cadastros em `clinica_medicos` — Turquesa: ilimitado na prática. */
export function maxMedicosCadastrados(_plan?: StoredPlanId | string): number {
  return MAX_PROFISSIONAIS;
}

/** Limite operacional da equipe. */
export function doctorsCountFromPlan(_plan?: string): number {
  return MAX_PROFISSIONAIS;
}

export function getPlanCatalog() {
  return PLAN_IDS.map((id) => ({
    id,
    ...PLANOS[id],
    user_type: planToUserType(id),
    max_medicos: MAX_PROFISSIONAIS,
  }));
}
