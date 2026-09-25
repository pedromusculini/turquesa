import { NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import { getSubscriptionAccess } from '@/lib/assinatura';
import { hasCompletedOnboarding } from '@/lib/onboardingGate';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { PLANOS } from '@/lib/constants';
import { ANNUAL_MAX_INSTALLMENTS, annualPriceFromMonthly } from '@/lib/asaasBillingPolicy';
import { getEffectivePrice } from '@/lib/subscriptionPricing';

export async function GET() {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  try {
    const onboardingDone = await hasCompletedOnboarding(email);
    if (!onboardingDone) {
      return NextResponse.json(
        {
          error:
            'Complete seu cadastro em /onboarding antes de acessar Minha conta.',
          code: 'ONBOARDING_REQUIRED',
        },
        { status: 403 },
      );
    }

    const subscription = await getSubscriptionAccess(email);

    const { data: profile } = await supabaseAdmin
      .from('onboarding_profiles')
      .select('plan, user_type, trial_started')
      .eq('email', email)
      .maybeSingle();

    const planId = profile?.plan || subscription.plano;
    const planInfo =
      planId && planId in PLANOS
        ? PLANOS[planId as keyof typeof PLANOS]
        : null;

    const { price } = await getEffectivePrice(email);
    const annualValue = annualPriceFromMonthly(price);

    return NextResponse.json({
      subscription,
      profile: {
        plan: profile?.plan ?? subscription.plano,
        user_type: profile?.user_type,
        trial_started: profile?.trial_started,
        plan_name: planInfo?.nome ?? profile?.plan,
        plan_value: planInfo ? price : null,
      },
      annual: {
        value: annualValue,
        installment_value: Math.round((annualValue / ANNUAL_MAX_INSTALLMENTS) * 100) / 100,
        max_installments: ANNUAL_MAX_INSTALLMENTS,
        is_active_payer:
          subscription.status === 'active' &&
          Boolean(subscription.first_payment_at) &&
          Boolean(subscription.current_period_end) &&
          new Date(subscription.current_period_end ?? 0).getTime() > Date.now(),
      },
    });
  } catch (error) {
    console.error('[conta/GET]', error);
    return NextResponse.json({ error: 'Erro ao carregar conta' }, { status: 500 });
  }
}
