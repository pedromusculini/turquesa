import { PLANOS } from '@/lib/constants';

export type PlanId = keyof typeof PLANOS;

/** Planos legados MedSup ainda aceitos em contas existentes. */
export const LEGACY_PLAN_IDS = ['medico-pix', 'clinica-5-pix', 'clinica-10-pix'] as const;
export type LegacyPlanId = (typeof LEGACY_PLAN_IDS)[number];
export type StoredPlanId = PlanId | LegacyPlanId;

export const PLAN_IDS: PlanId[] = ['ilimitado'];

const PLAN_ORDER: Record<StoredPlanId, number> = {
  'medico-pix': 1,
  'clinica-5-pix': 2,
  'clinica-10-pix': 3,
  ilimitado: 4,
};

export function isValidPlanId(value: string): value is StoredPlanId {
  return value in PLANOS || (LEGACY_PLAN_IDS as readonly string[]).includes(value);
}

export function isCurrentPlanId(value: string): value is PlanId {
  return value in PLANOS;
}

export function planToUserType(plan: StoredPlanId): 'medico' | 'clinica' {
  if (plan === 'medico-pix') return 'medico';
  return 'clinica';
}

/** Máximo de cadastros em `clinica_medicos` (além do titular da conta). */
export function maxMedicosCadastrados(plan: StoredPlanId): number {
  if (plan === 'medico-pix') return 0;
  if (plan === 'clinica-5-pix') return 5;
  if (plan === 'clinica-10-pix') return 10;
  return 999;
}

/** Limite operacional da equipe (espelha o plano). */
export function doctorsCountFromPlan(plan: string): number | null {
  if (plan === 'ilimitado') return 999;
  if (plan === 'clinica-5-pix') return 5;
  if (plan === 'clinica-10-pix') return 10;
  return null;
}

export function isDowngrade(currentPlan: StoredPlanId, newPlan: StoredPlanId): boolean {
  return PLAN_ORDER[newPlan] < PLAN_ORDER[currentPlan];
}

export type ClinicaMedicoRow = {
  id: string;
  nome: string;
  created_at: string;
};

export type PlanChangeImpact = {
  isSamePlan: boolean;
  isDowngrade: boolean;
  requiresDataLossAck: boolean;
  warnings: string[];
  principalMantido: string | null;
  medicosRemovidos: { count: number; nomes: string[] };
};

export function getPlanChangeImpact(
  currentPlan: StoredPlanId,
  newPlan: StoredPlanId,
  medicos: ClinicaMedicoRow[],
  profile: {
    user_type: string;
    full_name?: string | null;
  },
): PlanChangeImpact {
  const isSamePlan = currentPlan === newPlan;
  const downgrade = isDowngrade(currentPlan, newPlan);
  const warnings: string[] = [];
  let medicosRemovidos: { count: number; nomes: string[] } = { count: 0, nomes: [] };
  let principalMantido: string | null = null;

  const sorted = [...medicos].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  if (newPlan === 'medico-pix' && profile.user_type === 'clinica') {
    principalMantido =
      profile.full_name?.trim() ||
      sorted[0]?.nome ||
      'Titular da conta (dados profissionais do perfil principal)';
    medicosRemovidos = {
      count: sorted.length,
      nomes: sorted.map((m) => m.nome),
    };
    warnings.push(
      'Ao mudar para plano solo, a gestão de equipe deixa de existir: todos os profissionais cadastrados serão removidos da plataforma.',
    );
  } else if (
    currentPlan === 'clinica-10-pix' &&
    newPlan === 'clinica-5-pix' &&
    sorted.length > 5
  ) {
    const excess = sorted.slice(5);
    medicosRemovidos = {
      count: excess.length,
      nomes: excess.map((m) => m.nome),
    };
    warnings.push(
      `Os profissionais cadastrados a partir do 6º (${excess.map((m) => m.nome).join(', ')}) serão removidos.`,
    );
  } else if (downgrade && !isSamePlan) {
    warnings.push('Você está reduzindo o plano. Revise os limites antes de confirmar.');
  }

  const requiresDataLossAck =
    medicosRemovidos.count > 0 ||
    (newPlan === 'medico-pix' && profile.user_type === 'clinica');

  return {
    isSamePlan,
    isDowngrade: downgrade,
    requiresDataLossAck,
    warnings,
    principalMantido,
    medicosRemovidos,
  };
}

export function getPlanCatalog() {
  return PLAN_IDS.map((id) => ({
    id,
    ...PLANOS[id],
    user_type: planToUserType(id),
    max_medicos: maxMedicosCadastrados(id),
  }));
}
