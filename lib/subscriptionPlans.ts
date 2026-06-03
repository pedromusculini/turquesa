import { PLANOS } from '@/lib/constants';

export type PlanId = keyof typeof PLANOS;

export const PLAN_IDS: PlanId[] = ['medico-pix', 'clinica-5-pix', 'clinica-10-pix'];

const PLAN_ORDER: Record<PlanId, number> = {
  'medico-pix': 1,
  'clinica-5-pix': 2,
  'clinica-10-pix': 3,
};

export function isValidPlanId(value: string): value is PlanId {
  return PLAN_IDS.includes(value as PlanId);
}

export function planToUserType(plan: PlanId): 'medico' | 'clinica' {
  return plan === 'medico-pix' ? 'medico' : 'clinica';
}

/** Máximo de cadastros em `clinica_medicos` (além do titular da conta). */
export function maxMedicosCadastrados(plan: PlanId): number {
  if (plan === 'medico-pix') return 0;
  if (plan === 'clinica-5-pix') return 5;
  return 10;
}

/** Limite operacional da clínica (espelha o plano; não é escolhido manualmente). */
export function doctorsCountFromPlan(plan: string): number | null {
  if (plan === 'clinica-5-pix') return 5;
  if (plan === 'clinica-10-pix') return 10;
  return null;
}

export function isDowngrade(currentPlan: PlanId, newPlan: PlanId): boolean {
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
  currentPlan: PlanId,
  newPlan: PlanId,
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
      'Ao mudar de Clínica para Médico Solo, a gestão de equipe deixa de existir: todos os médicos cadastrados na clínica serão removidos da plataforma.',
    );
    warnings.push(
      `Permanecerá apenas o cadastro principal (${principalMantido}) no seu perfil de Médico Solo. Dados profissionais do titular são preservados; vínculos dos demais profissionais na lista da clínica serão excluídos.`,
    );
    if (sorted.length > 1) {
      const outros = sorted.slice(1).map((m) => m.nome);
      warnings.push(
        `Profissionais que serão removidos da equipe: ${outros.join(', ')}.`,
      );
    } else if (sorted.length === 1) {
      warnings.push(
        `O cadastro de equipe de ${sorted[0].nome} será removido; as informações do titular permanecem no perfil principal.`,
      );
    }
    warnings.push(
      'Pacientes, agenda e financeiro da conta continuam vinculados ao titular; não há exclusão de dados de pacientes nesta operação.',
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
    principalMantido = null;
    warnings.push(
      'Ao reduzir do plano Clínica 6 a 10 para Clínica 2 a 5, o limite de médicos cadastrados passa de 10 para 5.',
    );
    warnings.push(
      `Os médicos cadastrados a partir do 6º (${excess.map((m) => m.nome).join(', ')}) serão removidos permanentemente.`,
    );
    warnings.push(
      `Permanecerão os 5 primeiros cadastros (ordem de inclusão): ${sorted
        .slice(0, 5)
        .map((m) => m.nome)
        .join(', ')}.`,
    );
  } else if (downgrade && !isSamePlan) {
    warnings.push(
      'Você está reduzindo o plano. Revise os limites do novo plano antes de confirmar.',
    );
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
