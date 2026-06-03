import { supabaseAdmin } from '@/lib/supabaseClient';
import {
  type PlanId,
  type ClinicaMedicoRow,
  getPlanChangeImpact,
  isValidPlanId,
  doctorsCountFromPlan,
  maxMedicosCadastrados,
  planToUserType,
} from '@/lib/subscriptionPlans';

type ProfileRow = {
  email: string;
  user_type: string;
  plan: string;
  full_name: string | null;
  crm: string | null;
  specialty: string | null;
  clinic_name: string | null;
  cnpj: string | null;
  doctors_count: number | null;
  whatsapp: string | null;
};

export async function applyPlanChange(
  ownerEmail: string,
  newPlan: PlanId,
): Promise<{ medicosRemovidos: number }> {
  if (!isValidPlanId(newPlan)) {
    throw new Error('Plano inválido');
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('onboarding_profiles')
    .select(
      'email, user_type, plan, full_name, crm, specialty, clinic_name, cnpj, doctors_count, whatsapp',
    )
    .eq('email', ownerEmail)
    .single();

  if (profileError || !profile) {
    throw new Error('Perfil não encontrado');
  }

  const currentPlan = profile.plan as PlanId;
  if (!isValidPlanId(currentPlan)) {
    throw new Error('Plano atual inválido. Entre em contato com o suporte.');
  }
  if (currentPlan === newPlan) {
    throw new Error('Este já é o seu plano atual.');
  }

  let medicos: ClinicaMedicoRow[] = [];
  if (profile.user_type === 'clinica') {
    const { data, error } = await supabaseAdmin
      .from('clinica_medicos')
      .select('id, nome, crm, specialty, created_at')
      .eq('clinica_email', ownerEmail)
      .order('created_at', { ascending: true });

    if (error) throw error;
    medicos = data ?? [];
  }

  const impact = getPlanChangeImpact(currentPlan, newPlan, medicos, profile);
  const sorted = [...medicos].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  let removidos = 0;

  if (newPlan === 'medico-pix' && profile.user_type === 'clinica') {
    const principal = sorted[0];
    const update: Partial<ProfileRow> & Record<string, unknown> = {
      user_type: 'medico',
      plan: newPlan,
      clinic_name: null,
      cnpj: null,
      doctors_count: null,
      updated_at: new Date().toISOString(),
    };

    if (!profile.full_name?.trim() && principal) {
      const p = principal as ClinicaMedicoRow & { crm?: string | null; specialty?: string | null };
      update.full_name = p.nome;
      update.crm = profile.crm || p.crm || null;
      update.specialty = profile.specialty || p.specialty || null;
    }

    const { error: delError } = await supabaseAdmin
      .from('clinica_medicos')
      .delete()
      .eq('clinica_email', ownerEmail);

    if (delError) throw delError;
    removidos = medicos.length;

    const { error: updError } = await supabaseAdmin
      .from('onboarding_profiles')
      .update(update)
      .eq('email', ownerEmail);

    if (updError) throw updError;
    return { medicosRemovidos: removidos };
  }

  if (
    currentPlan === 'clinica-10-pix' &&
    newPlan === 'clinica-5-pix' &&
    sorted.length > 5
  ) {
    const toRemove = sorted.slice(5);
    const ids = toRemove.map((m) => m.id);
    const { error: delError } = await supabaseAdmin
      .from('clinica_medicos')
      .delete()
      .in('id', ids)
      .eq('clinica_email', ownerEmail);

    if (delError) throw delError;
    removidos = toRemove.length;
  }

  const newUserType = planToUserType(newPlan);
  const doctorsCount =
    newUserType === 'clinica' ? doctorsCountFromPlan(newPlan) : null;

  const profileUpdate: Record<string, unknown> = {
    plan: newPlan,
    user_type: newUserType,
    doctors_count: doctorsCount,
    updated_at: new Date().toISOString(),
  };

  if (newUserType === 'medico') {
    profileUpdate.clinic_name = null;
    profileUpdate.cnpj = null;
    profileUpdate.doctors_count = null;
  }

  const { error: updError } = await supabaseAdmin
    .from('onboarding_profiles')
    .update(profileUpdate)
    .eq('email', ownerEmail);

  if (updError) throw updError;

  return { medicosRemovidos: removidos };
}
