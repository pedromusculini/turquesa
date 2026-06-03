import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { applyPlanChange } from '@/lib/applyPlanChange';
import { recordPrivacyConsent } from '@/lib/googleAccountAccess';
import { PRIVACY_POLICY_VERSION, TERMS_VERSION } from '@/lib/legal';
import {
  getPlanCatalog,
  getPlanChangeImpact,
  isValidPlanId,
  type PlanId,
} from '@/lib/subscriptionPlans';

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
    });
  } catch (err) {
    console.error('[perfil/assinatura/GET]', err);
    return NextResponse.json({ error: 'Erro ao carregar assinatura' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email, googleSub } = authResult;

  try {
    const body = await req.json();
    const previewOnly = body.preview === true;
    const newPlan = String(body.newPlan ?? '').trim();
    const termsAccepted = body.termsAccepted === true;

    if (!isValidPlanId(newPlan)) {
      return NextResponse.json({ error: 'Plano inválido' }, { status: 400 });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('onboarding_profiles')
      .select('plan, user_type, full_name')
      .eq('email', email)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 });
    }

    const currentPlan = profile.plan as PlanId;
    if (!isValidPlanId(currentPlan)) {
      return NextResponse.json({ error: 'Plano atual inválido' }, { status: 400 });
    }

    let medicos: { id: string; nome: string; created_at: string }[] = [];
    if (profile.user_type === 'clinica') {
      const { data, error } = await supabaseAdmin
        .from('clinica_medicos')
        .select('id, nome, created_at')
        .eq('clinica_email', email)
        .order('created_at', { ascending: true });

      if (error) throw error;
      medicos = data ?? [];
    }

    const impact = getPlanChangeImpact(currentPlan, newPlan, medicos, profile);

    if (impact.isSamePlan) {
      return NextResponse.json({ error: 'Este já é o seu plano atual.' }, { status: 400 });
    }

    if (previewOnly) {
      return NextResponse.json({ impact, new_plan: newPlan, current_plan: currentPlan });
    }

    if (!termsAccepted) {
      return NextResponse.json(
        {
          error:
            'É necessário aceitar a Política de Privacidade e os Termos de Uso para alterar a assinatura.',
        },
        { status: 400 },
      );
    }

    const result = await applyPlanChange(email, newPlan);
    await recordPrivacyConsent(googleSub, PRIVACY_POLICY_VERSION, TERMS_VERSION);

    const { data: updated } = await supabaseAdmin
      .from('onboarding_profiles')
      .select('plan, user_type, doctors_count')
      .eq('email', email)
      .single();

    return NextResponse.json({
      success: true,
      message: 'Assinatura alterada com sucesso.',
      medicos_removidos: result.medicosRemovidos,
      profile: updated,
      impact,
    });
  } catch (err) {
    console.error('[perfil/assinatura/POST]', err);
    const message = err instanceof Error ? err.message : 'Erro ao alterar assinatura';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
