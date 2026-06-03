import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { supabaseErrorMessage } from '@/lib/supabaseErrors';
import {
  isValidPlanId,
  maxMedicosCadastrados,
  type PlanId,
} from '@/lib/subscriptionPlans';

export async function GET() {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email: clinicaEmail } = authResult;

  try {
    const { data: profile } = await supabaseAdmin
      .from('onboarding_profiles')
      .select('user_type')
      .eq('email', clinicaEmail)
      .single();

    if (!profile || profile.user_type !== 'clinica') {
      return NextResponse.json({ error: 'Apenas clínicas podem gerenciar médicos' }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from('clinica_medicos')
      .select('*')
      .eq('clinica_email', clinicaEmail)
      .order('nome', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ medicos: data });
  } catch (error) {
    console.error('[perfil/medicos/GET] Erro:', error);
    return NextResponse.json(
      { error: supabaseErrorMessage(error, 'Erro ao carregar médicos') },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email: clinicaEmail } = authResult;

  try {
    const body = await req.json();

    if (!body.nome) {
      return NextResponse.json({ error: 'Nome do médico é obrigatório' }, { status: 400 });
    }

    const { data: profile } = await supabaseAdmin
      .from('onboarding_profiles')
      .select('user_type, plan')
      .eq('email', clinicaEmail)
      .single();

    if (!profile || profile.user_type !== 'clinica') {
      return NextResponse.json({ error: 'Apenas clínicas podem gerenciar médicos' }, { status: 403 });
    }

    const plan = profile.plan as string;
    if (isValidPlanId(plan)) {
      const { count } = await supabaseAdmin
        .from('clinica_medicos')
        .select('id', { count: 'exact', head: true })
        .eq('clinica_email', clinicaEmail);

      const max = maxMedicosCadastrados(plan as PlanId);
      if ((count ?? 0) >= max) {
        return NextResponse.json(
          {
            error: `Limite do plano: até ${max} médico(s) cadastrado(s) na clínica.`,
            code: 'MEDICOS_LIMIT',
          },
          { status: 400 },
        );
      }
    }

    const nome = String(body.nome).trim();
    const { data, error } = await supabaseAdmin
      .from('clinica_medicos')
      .insert({
        clinica_email: clinicaEmail,
        nome,
        crm: body.crm?.trim() || null,
        specialty: body.specialty?.trim() || null,
        whatsapp: body.whatsapp?.trim() || null,
        email: body.email?.trim().toLowerCase() || null,
      })
      .select()
      .single();

    if (error) {
      console.error('[perfil/medicos/POST] Supabase:', error);
      return NextResponse.json(
        { error: supabaseErrorMessage(error, 'Erro ao adicionar médico') },
        { status: 500 },
      );
    }

    return NextResponse.json({ medico: data, message: 'Médico adicionado com sucesso!' });
  } catch (error) {
    console.error('[perfil/medicos/POST] Erro:', error);
    return NextResponse.json(
      { error: supabaseErrorMessage(error, 'Erro ao adicionar médico') },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email: clinicaEmail } = authResult;

  try {
    const medicoId = new URL(req.url).searchParams.get('id');

    if (!medicoId) {
      return NextResponse.json({ error: 'ID do médico é obrigatório' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('clinica_medicos')
      .delete()
      .eq('id', medicoId)
      .eq('clinica_email', clinicaEmail);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Médico removido com sucesso!' });
  } catch (error) {
    console.error('[perfil/medicos/DELETE] Erro:', error);
    return NextResponse.json({ error: 'Erro ao remover médico' }, { status: 500 });
  }
}
