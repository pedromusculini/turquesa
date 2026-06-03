import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  getGoogleAccountBySub,
  markTrialConsumed,
  recordPrivacyConsent,
} from '@/lib/googleAccountAccess';
import { PRIVACY_POLICY_VERSION, TERMS_VERSION } from '@/lib/legal';
import { ensureAssinaturaRecord } from '@/lib/assinatura';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { doctorsCountFromPlan, isValidPlanId } from '@/lib/subscriptionPlans';
import {
  getGoogleAccessForSession,
  googleAccessDeniedResponse,
} from '@/lib/requireGoogleAccess';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email || !session.googleSub) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    const access = await getGoogleAccessForSession(session);
    if (!access?.accessVerified) {
      return googleAccessDeniedResponse();
    }

    const text = await req.text();
    const body = text ? JSON.parse(text) : {};

    const { userType, selectedPlan, form, trialStarted, userEmail, privacyConsent } = body;

    if (!privacyConsent) {
      return NextResponse.json(
        { error: 'É necessário aceitar a Política de Privacidade e os Termos de Uso.' },
        { status: 400 },
      );
    }

    if (!userType || !selectedPlan || !form) {
      return NextResponse.json(
        { error: 'Dados do onboarding incompletos' },
        { status: 400 },
      );
    }

    const sessionEmail = session.user.email.toLowerCase().trim();
    const resolvedEmail = (userEmail || sessionEmail).toLowerCase().trim();
    if (resolvedEmail !== sessionEmail) {
      return NextResponse.json(
        { error: 'E-mail não corresponde à sessão Google.' },
        { status: 403 },
      );
    }

    const googleAccount = await getGoogleAccountBySub(session.googleSub);
    let allowTrial = false;
    if (trialStarted) {
      if (googleAccount?.trial_consumed) {
        return NextResponse.json(
          {
            error:
              'O período de teste de 30 dias já foi utilizado nesta conta Google. Escolha um plano pago para continuar.',
            trialBlocked: true,
          },
          { status: 403 },
        );
      }
      allowTrial = true;
    }

    // Validar campos obrigatórios
    if (userType === 'medico') {
      if (!form.fullName || !form.crm || !form.specialty || !form.whatsapp) {
        return NextResponse.json(
          { error: 'Campos obrigatórios do médico não preenchidos' },
          { status: 400 },
        );
      }
    } else if (userType === 'clinica') {
      if (!form.clinicName || !form.cnpj || !form.whatsapp) {
        return NextResponse.json(
          { error: 'Campos obrigatórios da clínica não preenchidos' },
          { status: 400 },
        );
      }

      const cnpjNumeros = form.cnpj.replace(/\D/g, '');
      if (cnpjNumeros.length !== 14) {
        return NextResponse.json(
          { error: 'CNPJ inválido. Deve conter 14 dígitos.' },
          { status: 400 },
        );
      }

      if (!isValidPlanId(selectedPlan) || !doctorsCountFromPlan(selectedPlan)) {
        return NextResponse.json(
          { error: 'Plano de clínica inválido. Escolha Clínica até 5 ou até 10.' },
          { status: 400 },
        );
      }
    }

    const cepDigits = String(form.cep ?? '').replace(/\D/g, '');
    if (cepDigits.length !== 8) {
      return NextResponse.json({ error: 'Informe o CEP com 8 dígitos.' }, { status: 400 });
    }
    const addressRequired = [
      'street',
      'address_number',
      'neighborhood',
      'city',
      'state',
    ] as const;
    for (const key of addressRequired) {
      if (!String(form[key] ?? '').trim()) {
        return NextResponse.json(
          { error: 'Preencha todos os campos do endereço (CEP, rua, número, bairro, cidade e estado).' },
          { status: 400 },
        );
      }
    }

    const addressLine = [
      form.street,
      form.address_number ? `, ${form.address_number}` : '',
      form.complement ? ` - ${form.complement}` : '',
      form.neighborhood ? ` — ${form.neighborhood}` : '',
      form.city && form.state ? ` — ${form.city}/${form.state}` : '',
      cepDigits ? ` — CEP ${cepDigits}` : '',
    ]
      .filter(Boolean)
      .join('');

    const profileData = {
      email: resolvedEmail,
      google_sub: session.googleSub,
      user_type: userType,
      plan: selectedPlan,
      trial_started: allowTrial,
      onboarding_completed: true,
      onboarding_completed_at: new Date().toISOString(),
      full_name: userType === 'medico' ? form.fullName : null,
      crm: userType === 'medico' ? form.crm : null,
      specialty: userType === 'medico' ? form.specialty : null,
      clinic_name: userType === 'clinica' ? form.clinicName : null,
      cnpj: userType === 'clinica' ? form.cnpj.replace(/\D/g, '') : null,
      doctors_count:
        userType === 'clinica' && isValidPlanId(selectedPlan)
          ? doctorsCountFromPlan(selectedPlan)
          : null,
      whatsapp: form.whatsapp,
      address: addressLine || form.address || null,
      health_plan: null,
      // Campos estruturados de endereço
      cep: form.cep || null,
      street: form.street || null,
      address_number: form.address_number || null,
      complement: form.complement || null,
      neighborhood: form.neighborhood || null,
      city: form.city || null,
      state: form.state || null,
      country: form.country || 'Brasil',
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabaseAdmin
      .from('onboarding_profiles')
      .upsert(profileData, { onConflict: 'email' });

    if (upsertError) {
      console.error('[onboarding/save] Erro:', upsertError);

      if (
        upsertError.message?.includes('relation') ||
        upsertError.message?.includes('does not exist')
      ) {
        return NextResponse.json(
          {
            error:
              'Tabela onboarding_profiles não encontrada. Execute o script SQL sql/onboarding_profiles_schema.sql no Supabase.',
          },
          { status: 500 },
        );
      }

      return NextResponse.json(
        { error: 'Erro ao salvar perfil: ' + upsertError.message },
        { status: 500 },
      );
    }

    if (allowTrial) {
      await markTrialConsumed(session.googleSub);
    }

    try {
      await ensureAssinaturaRecord(resolvedEmail);
    } catch (assinaturaErr) {
      console.error('[onboarding/save] ensureAssinatura:', assinaturaErr);
    }

    await recordPrivacyConsent(
      session.googleSub,
      PRIVACY_POLICY_VERSION,
      TERMS_VERSION,
    );

    return NextResponse.json({
      success: true,
      message: 'Perfil configurado com sucesso!',
      trialStarted: allowTrial,
    });
  } catch (error) {
    console.error('[onboarding/save] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao processar onboarding' },
      { status: 500 },
    );
  }
}