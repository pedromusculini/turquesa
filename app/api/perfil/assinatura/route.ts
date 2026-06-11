import { NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getPlanCatalog } from '@/lib/subscriptionPlans';
import { PRIVACY_POLICY_VERSION, TERMS_VERSION } from '@/lib/legal';

export async function GET() {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  try {
    const { data: profile, error } = await supabaseAdmin
      .from('onboarding_profiles')
      .select('plan, user_type, full_name, doctors_count')
      .eq('email', email)
      .single();

    if (error || !profile) {
      return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 });
    }

    let medicosCount = 0;
    if (profile.user_type === 'clinica') {
      const { count } = await supabaseAdmin
        .from('clinica_medicos')
        .select('id', { count: 'exact', head: true })
        .eq('clinica_email', email);
      medicosCount = count ?? 0;
    }

    return NextResponse.json({
      current_plan: profile.plan,
      user_type: profile.user_type,
      doctors_count: profile.doctors_count,
      medicos_cadastrados: medicosCount,
      plans: getPlanCatalog(),
      terms_version: TERMS_VERSION,
      privacy_version: PRIVACY_POLICY_VERSION,
      plan_change_disabled: true,
    });
  } catch (err) {
    console.error('[perfil/assinatura/GET]', err);
    return NextResponse.json({ error: 'Erro ao carregar assinatura' }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json(
    {
      error:
        'Alteração de plano não está disponível. O Turquesa Agenda possui assinatura única — gerencie pagamento em Minha conta.',
      code: 'PLAN_CHANGE_DISABLED',
    },
    { status: 410 },
  );
}
