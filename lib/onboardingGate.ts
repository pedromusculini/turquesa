import { supabaseAdmin } from '@/lib/supabaseClient';

export type EquipeProfissionalInfo = {
  nomeProfissional: string;
  nomeSalao: string;
  /** false quando está na equipe mas a agenda Google ainda não foi conectada */
  agendaConectada: boolean;
};

async function repairProfissionalGoogleSub(params: {
  calendarRowId: string;
  storedSub: string | null;
  sessionGoogleSub: string;
}): Promise<void> {
  const stored = (params.storedSub ?? '').trim();
  if (!params.sessionGoogleSub.trim() || (stored && stored === params.sessionGoogleSub)) return;

  const { error } = await supabaseAdmin
    .from('profissional_google_calendar')
    .update({
      google_sub: params.sessionGoogleSub,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.calendarRowId);

  if (error) {
    console.error('[onboardingGate] repair google_sub:', error);
  }
}

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
    agendaConectada: true,
  };
}

function withAgendaFlag(
  info: Omit<EquipeProfissionalInfo, 'agendaConectada'> | null,
  agendaConectada: boolean,
): EquipeProfissionalInfo | null {
  if (!info) return null;
  return { ...info, agendaConectada };
}

/** Profissional cadastrado na equipe de um salão (titular já fez onboarding). */
export async function getConnectedEquipeProfissional(
  googleSub: string,
  sessionEmail?: string,
): Promise<EquipeProfissionalInfo | null> {
  const sub = googleSub.trim();
  if (sub) {
    const { data: cal, error } = await supabaseAdmin
      .from('profissional_google_calendar')
      .select('id, clinica_medicos_id, connected_at, google_sub')
      .eq('google_sub', sub)
      .not('connected_at', 'is', null)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[onboardingGate] equipe calendar lookup:', error);
    } else if (cal?.clinica_medicos_id) {
      const info = await equipeInfoFromMedicoId(cal.clinica_medicos_id);
      if (info) return withAgendaFlag(info, true);
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

  const baseInfo = await equipeInfoFromMedicoId(medico.id);
  if (!baseInfo) return null;

  const { data: calRow, error: calErr } = await supabaseAdmin
    .from('profissional_google_calendar')
    .select('id, google_sub, connected_at, refresh_token_encrypted')
    .eq('clinica_medicos_id', medico.id)
    .maybeSingle();

  if (calErr) {
    console.error('[onboardingGate] equipe calendar email lookup:', calErr);
    return withAgendaFlag(baseInfo, false);
  }

  const agendaConectada = !!(
    calRow?.connected_at && calRow.refresh_token_encrypted
  );

  if (agendaConectada && calRow?.id && sub) {
    await repairProfissionalGoogleSub({
      calendarRowId: String(calRow.id),
      storedSub: (calRow.google_sub as string | null) ?? null,
      sessionGoogleSub: sub,
    });
  }

  return withAgendaFlag(baseInfo, agendaConectada);
}
