import { supabaseAdmin } from '@/lib/supabaseClient';

export type EquipeProfissionalInfo = {
  nomeProfissional: string;
  nomeSalao: string;
};

export function isOnboardingPath(pathname: string): boolean {
  if (pathname === '/onboarding' || pathname.startsWith('/onboarding/')) {
    return true;
  }
  if (pathname.startsWith('/api/onboarding/')) return true;
  return false;
}

export async function hasCompletedOnboarding(ownerEmail: string): Promise<boolean> {
  const email = ownerEmail.toLowerCase().trim();
  const { data, error } = await supabaseAdmin
    .from('onboarding_profiles')
    .select('onboarding_completed')
    .eq('email', email)
    .maybeSingle();

  if (error) {
    console.error('[onboardingGate] profile lookup:', error);
    return false;
  }
  return data?.onboarding_completed === true;
}

/** Profissional de equipe com agenda Google conectada (sem conta titular). */
export async function getConnectedEquipeProfissional(
  googleSub: string,
): Promise<EquipeProfissionalInfo | null> {
  const sub = googleSub.trim();
  if (!sub) return null;

  const { data: cal, error } = await supabaseAdmin
    .from('profissional_google_calendar')
    .select('clinica_medicos_id, connected_at')
    .eq('google_sub', sub)
    .not('connected_at', 'is', null)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[onboardingGate] equipe calendar lookup:', error);
    return null;
  }
  if (!cal) return null;

  const { data: medico, error: medErr } = await supabaseAdmin
    .from('clinica_medicos')
    .select('nome, clinica_email')
    .eq('id', cal.clinica_medicos_id)
    .maybeSingle();

  if (medErr || !medico) return null;

  const { data: profile } = await supabaseAdmin
    .from('onboarding_profiles')
    .select('clinic_name, full_name')
    .eq('email', medico.clinica_email)
    .maybeSingle();

  const nomeSalao =
    (profile?.clinic_name as string | undefined)?.trim() ||
    (profile?.full_name as string | undefined)?.trim() ||
    'Salão';

  return {
    nomeProfissional: String(medico.nome ?? '').trim() || 'Profissional',
    nomeSalao,
  };
}
