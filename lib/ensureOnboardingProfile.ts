import { supabaseAdmin } from '@/lib/supabaseClient';
import { getDevBypassIdentity, getDevBypassProfile, isDevBypassAuthActive } from '@/lib/devBypassAuth';
import {
  doctorsCountFromPlan,
  isValidPlanId,
  planToUserType,
  type StoredPlanId,
} from '@/lib/subscriptionPlans';

export type OnboardingProfileGate = {
  user_type?: string | null;
  plan?: string | null;
  email?: string;
};

/** Perfil no Supabase ou mock DEV_BYPASS quando a linha ainda não existe. */
export async function loadOnboardingProfileGate(
  email: string,
): Promise<OnboardingProfileGate | null> {
  const normalized = email.toLowerCase().trim();
  const { data, error } = await supabaseAdmin
    .from('onboarding_profiles')
    .select('user_type, plan, email')
    .eq('email', normalized)
    .maybeSingle();

  if (error) throw error;
  if (data) return data;
  if (isDevBypassAuthActive()) return getDevBypassProfile(normalized);
  return null;
}

/**
 * Garante linha em onboarding_profiles (FK de clinica_medicos e assinaturas).
 * Cria stub mínimo na primeira gravação de Meu Perfil ou ao cadastrar profissional.
 */
export async function ensureOnboardingProfile(
  email: string,
  googleSub?: string,
  fields?: Record<string, unknown>,
): Promise<{ created: boolean }> {
  const normalized = email.toLowerCase().trim();

  const { data: existing, error: readError } = await supabaseAdmin
    .from('onboarding_profiles')
    .select('email')
    .eq('email', normalized)
    .maybeSingle();

  if (readError) throw readError;

  if (existing) {
    if (fields && Object.keys(fields).length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from('onboarding_profiles')
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq('email', normalized);
      if (updateError) throw updateError;
    }
    return { created: false };
  }

  const bypass = isDevBypassAuthActive() ? getDevBypassIdentity() : null;
  const plan =
    (typeof fields?.plan === 'string' && fields.plan) ||
    bypass?.plan ||
    'ilimitado';
  const userType =
    (typeof fields?.user_type === 'string' && fields.user_type) ||
    bypass?.userType ||
    (isValidPlanId(plan) ? planToUserType(plan as StoredPlanId) : 'clinica');

  const row: Record<string, unknown> = {
    email: normalized,
    google_sub: googleSub ?? bypass?.googleSub ?? null,
    user_type: userType,
    plan,
    trial_started: false,
    onboarding_completed: true,
    onboarding_completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...fields,
  };

  if (userType === 'clinica' && isValidPlanId(plan)) {
    row.doctors_count = doctorsCountFromPlan(plan as StoredPlanId);
  }

  const { error: insertError } = await supabaseAdmin.from('onboarding_profiles').insert(row);
  if (insertError) throw insertError;

  return { created: true };
}
