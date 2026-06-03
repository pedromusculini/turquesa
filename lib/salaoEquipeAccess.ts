import {
  isValidPlanId,
  maxMedicosCadastrados,
  type StoredPlanId,
} from '@/lib/subscriptionPlans';

export type SalaoEquipeProfile = {
  user_type?: string | null;
  plan?: string | null;
};

/** Salão com equipe (clínica) ou plano que permite cadastro em `clinica_medicos`. */
export function canManageProfissionais(
  profile: SalaoEquipeProfile | null | undefined,
): boolean {
  if (!profile) return false;
  if (profile.user_type === 'clinica') return true;
  const plan = String(profile.plan ?? '').trim();
  if (plan && isValidPlanId(plan)) {
    return maxMedicosCadastrados(plan as StoredPlanId) > 0;
  }
  return false;
}
