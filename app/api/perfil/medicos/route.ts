import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { supabaseErrorMessage } from '@/lib/supabaseErrors';
import { canManageProfissionais } from '@/lib/salaoEquipeAccess';
import {
  isValidPlanId,
  maxMedicosCadastrados,
  type StoredPlanId,
} from '@/lib/subscriptionPlans';
import { brPhoneLocalDigits } from '@/lib/phoneMatch';
import {
  validateProfissionalEmail,
  validateProfissionalWhatsapp,
} from '@/lib/profissionaisValidation';

async function requireSalaoEquipe(clinicaEmail: string) {
  const { data: profile } = await supabaseAdmin
    .from('onboarding_profiles')
    .select('user_type, plan')
    .eq('email', clinicaEmail)
    .single();

  if (!profile || !canManageProfissionais(profile)) {
    return {
      error: NextResponse.json(
        { error: 'Apenas salões com equipe podem gerenciar profissionais' },
        { status: 403 },
      ),
    };
  }
  return { profile };
}

function parseWhatsapp(raw: unknown): string | null {
  if (raw == null || String(raw).trim() === '') return null;
  const digits = brPhoneLocalDigits(String(raw));
  if (digits.length < 10 || digits.length > 11) return null;
  return digits;
}

function parseEmail(raw: unknown): string | null {
  if (raw == null || String(raw).trim() === '') return null;
  const email = String(raw).trim().toLowerCase();
  const err = validateProfissionalEmail(email);
  if (err) return null;
  return email;
}

function parsePercentual(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  if (Number.isNaN(n) || n < 0 || n > 100) return null;
  return n;
}

export async function GET() {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email: clinicaEmail } = authResult;

  try {
    const gate = await requireSalaoEquipe(clinicaEmail);
    if ('error' in gate) return gate.error;

    const { data, error } = await supabaseAdmin
      .from('clinica_medicos')
      .select('id, nome, whatsapp, email, percentual_comissao, created_at')
      .eq('clinica_email', clinicaEmail)
      .order('nome', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ medicos: data, profissionais: data });
  } catch (error) {
    console.error('[perfil/medicos/GET] Erro:', error);
    return NextResponse.json(
      { error: supabaseErrorMessage(error, 'Erro ao carregar profissionais') },
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

    if (!body.nome?.trim()) {
      return NextResponse.json({ error: 'Nome da profissional é obrigatório' }, { status: 400 });
    }

    const gate = await requireSalaoEquipe(clinicaEmail);
    if ('error' in gate) return gate.error;
    const { profile } = gate;

    const whatsappErr = body.whatsapp
      ? validateProfissionalWhatsapp(String(body.whatsapp))
      : undefined;
    if (whatsappErr) {
      return NextResponse.json({ error: whatsappErr }, { status: 400 });
    }

    const emailErr = body.email ? validateProfissionalEmail(String(body.email)) : undefined;
    if (emailErr) {
      return NextResponse.json({ error: emailErr }, { status: 400 });
    }

    const percentual = parsePercentual(body.percentual_comissao);
    if (body.percentual_comissao != null && body.percentual_comissao !== '' && percentual == null) {
      return NextResponse.json({ error: 'Comissão deve ser entre 0 e 100' }, { status: 400 });
    }

    const plan = profile.plan as string;
    if (isValidPlanId(plan)) {
      const { count } = await supabaseAdmin
        .from('clinica_medicos')
        .select('id', { count: 'exact', head: true })
        .eq('clinica_email', clinicaEmail);

      const max = maxMedicosCadastrados(plan as StoredPlanId);
      if ((count ?? 0) >= max) {
        return NextResponse.json(
          {
            error: `Limite do plano: até ${max} profissional(is) cadastrada(s).`,
            code: 'MEDICOS_LIMIT',
          },
          { status: 400 },
        );
      }
    }

    const nome = String(body.nome).trim();
    const whatsapp = parseWhatsapp(body.whatsapp);
    const email = parseEmail(body.email);

    const { data, error } = await supabaseAdmin
      .from('clinica_medicos')
      .insert({
        clinica_email: clinicaEmail,
        nome,
        crm: null,
        specialty: null,
        whatsapp,
        email,
        percentual_comissao: percentual ?? 50,
      })
      .select('id, nome, whatsapp, email, percentual_comissao, created_at')
      .single();

    if (error) {
      console.error('[perfil/medicos/POST] Supabase:', error);
      return NextResponse.json(
        { error: supabaseErrorMessage(error, 'Erro ao adicionar profissional') },
        { status: 500 },
      );
    }

    return NextResponse.json({
      medico: data,
      profissional: data,
      message: 'Profissional adicionada com sucesso!',
    });
  } catch (error) {
    console.error('[perfil/medicos/POST] Erro:', error);
    return NextResponse.json(
      { error: supabaseErrorMessage(error, 'Erro ao adicionar profissional') },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email: clinicaEmail } = authResult;

  try {
    const body = await req.json();
    const id = body.id?.trim();

    if (!id) {
      return NextResponse.json({ error: 'ID da profissional é obrigatório' }, { status: 400 });
    }

    const gate = await requireSalaoEquipe(clinicaEmail);
    if ('error' in gate) return gate.error;

    if (!body.nome?.trim()) {
      return NextResponse.json({ error: 'Nome da profissional é obrigatório' }, { status: 400 });
    }

    const whatsappErr = body.whatsapp
      ? validateProfissionalWhatsapp(String(body.whatsapp))
      : undefined;
    if (whatsappErr) {
      return NextResponse.json({ error: whatsappErr }, { status: 400 });
    }

    const emailErr = body.email ? validateProfissionalEmail(String(body.email)) : undefined;
    if (emailErr) {
      return NextResponse.json({ error: emailErr }, { status: 400 });
    }

    const percentual = parsePercentual(body.percentual_comissao);
    if (body.percentual_comissao != null && body.percentual_comissao !== '' && percentual == null) {
      return NextResponse.json({ error: 'Comissão deve ser entre 0 e 100' }, { status: 400 });
    }

    const update: Record<string, unknown> = {
      nome: String(body.nome).trim(),
      whatsapp: parseWhatsapp(body.whatsapp),
      email: parseEmail(body.email),
    };
    if (percentual != null) update.percentual_comissao = percentual;

    const { data, error } = await supabaseAdmin
      .from('clinica_medicos')
      .update(update)
      .eq('id', id)
      .eq('clinica_email', clinicaEmail)
      .select('id, nome, whatsapp, email, percentual_comissao, created_at')
      .single();

    if (error) {
      console.error('[perfil/medicos/PATCH] Supabase:', error);
      return NextResponse.json(
        { error: supabaseErrorMessage(error, 'Erro ao atualizar profissional') },
        { status: 500 },
      );
    }

    if (!data) {
      return NextResponse.json({ error: 'Profissional não encontrada' }, { status: 404 });
    }

    return NextResponse.json({
      medico: data,
      profissional: data,
      message: 'Profissional atualizada com sucesso!',
    });
  } catch (error) {
    console.error('[perfil/medicos/PATCH] Erro:', error);
    return NextResponse.json(
      { error: supabaseErrorMessage(error, 'Erro ao atualizar profissional') },
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
      return NextResponse.json({ error: 'ID da profissional é obrigatório' }, { status: 400 });
    }

    const gate = await requireSalaoEquipe(clinicaEmail);
    if ('error' in gate) return gate.error;

    const { error } = await supabaseAdmin
      .from('clinica_medicos')
      .delete()
      .eq('id', medicoId)
      .eq('clinica_email', clinicaEmail);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Profissional removida com sucesso!' });
  } catch (error) {
    console.error('[perfil/medicos/DELETE] Erro:', error);
    return NextResponse.json({ error: 'Erro ao remover profissional' }, { status: 500 });
  }
}
