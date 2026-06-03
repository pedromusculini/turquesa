import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { doctorsCountFromPlan, isValidPlanId, type PlanId } from '@/lib/subscriptionPlans';

export async function GET() {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  try {
    const { data, error } = await supabaseAdmin
      .from('onboarding_profiles')
      .select('*')
      .eq('email', email)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ profile: null, message: 'Perfil não encontrado' });
      }
      throw error;
    }

    return NextResponse.json({ profile: data });
  } catch (error) {
    console.error('[perfil/GET] Erro:', error);
    return NextResponse.json({ error: 'Erro ao carregar perfil' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  try {
    const body = await req.json();

    const { data: existing } = await supabaseAdmin
      .from('onboarding_profiles')
      .select('user_type, plan')
      .eq('email', email)
      .maybeSingle();

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (
      existing?.user_type === 'clinica' &&
      existing.plan &&
      isValidPlanId(existing.plan)
    ) {
      updateData.doctors_count = doctorsCountFromPlan(existing.plan as PlanId);
    }

    const allowedFields = [
      'full_name', 'crm', 'specialty',
      'clinic_name', 'cnpj',
      'whatsapp', 'health_plan',
      'cep', 'street', 'address_number', 'complement',
      'neighborhood', 'city', 'state', 'country',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (body.street || body.address_number || body.neighborhood || body.city) {
      const parts = [
        body.street || '',
        body.address_number ? `, ${body.address_number}` : '',
        body.complement ? ` - ${body.complement}` : '',
        body.neighborhood ? `\nBairro: ${body.neighborhood}` : '',
        body.city ? `\n${body.city}` : '',
        body.state ? `/${body.state}` : '',
        body.cep ? `\nCEP: ${body.cep}` : '',
        body.country ? `\n${body.country}` : '',
      ].filter(Boolean);
      updateData.address = parts.join('');
    }

    const { error: upsertError } = await supabaseAdmin
      .from('onboarding_profiles')
      .update(updateData)
      .eq('email', email);

    if (upsertError) {
      console.error('[perfil/PUT] Erro:', upsertError);
      return NextResponse.json(
        { error: 'Erro ao atualizar perfil: ' + upsertError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, message: 'Perfil atualizado com sucesso!' });
  } catch (error) {
    console.error('[perfil/PUT] Erro:', error);
    return NextResponse.json({ error: 'Erro ao atualizar perfil' }, { status: 500 });
  }
}
