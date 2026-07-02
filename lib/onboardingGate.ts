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

async function equipeInfoFromMedicoId(
  medicoId: string | number,
): Promise<EquipeProfissionalInfo | null> {
  const { data: medico, error: medErr } = await supabaseAdmin
    .from('clinica_medicos')
    .select('nome, clinica_email')
    .eq('id', medicoId)
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

/** Profissional de equipe com agenda Google conectada (sem conta titular). */
export async function getConnectedEquipeProfissional(
  googleSub: string,
  sessionEmail?: string,
): Promise<EquipeProfissionalInfo | null> {
  const sub = googleSub.trim();
  if (sub) {
    const { data: cal, error } = await supabaseAdmin
      .from('profissional_google_calendar')
      .select('clinica_medicos_id, connected_at')
      .eq('google_sub', sub)
      .not('connected_at', 'is', null)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[onboardingGate] equipe calendar lookup:', error);
    } else if (cal?.clinica_medicos_id) {
      const info = await equipeInfoFromMedicoId(cal.clinica_medicos_id);
      if (info) return info;
    }
  }

  const email = sessionEmail?.toLowerCase().trim();
  if (!email) return null;

  const { data: medico, error: medErr } = await supabaseAdmin
    .from('clinica_medicos')
    .select('id')
    .eq('email', email)
    .limit(1)
    .maybeSingle();

  if (medErr) {
    console.error('[onboardingGate] equipe medico email lookup:', medErr);
    return null;
  }
  if (!medico?.id) return null;

  const { data: calRow, error: calErr } = await supabaseAdmin
    .from('profissional_google_calendar')
    .select('connected_at, refresh_token_encrypted')
    .eq('clinica_medicos_id', medico.id)
    .maybeSingle();

  if (calErr) {
    console.error('[onboardingGate] equipe calendar email lookup:', calErr);
    return null;
  }
  if (!calRow?.connected_at || !calRow.refresh_token_encrypted) return null;

  return equipeInfoFromMedicoId(medico.id);
}
