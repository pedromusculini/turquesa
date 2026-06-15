import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { supabaseErrorMessage } from '@/lib/supabaseErrors';
import { canManageProfissionais } from '@/lib/salaoEquipeAccess';
import { ensureOnboardingProfile, loadOnboardingProfileGate } from '@/lib/ensureOnboardingProfile';
import { isValidPhone, normalizePhoneForStorage } from '@/lib/phoneMatch';
import {
  validateProfissionalEmail,
  validateProfissionalWhatsapp,
} from '@/lib/profissionaisValidation';
import {
  agendaStatusFromRow,
  deleteProfissionalCalendarForMedico,
  ensureProfissionalCalendarRow,
  loadCalendarRowsForMedicos,
} from '@/lib/profissionalGoogleCalendar';
import { normalizeCorAgenda } from '@/lib/agendaProfissionalColors';

async function requireSalaoEquipe(clinicaEmail: string) {
  const profile = await loadOnboardingProfileGate(clinicaEmail);

  if (!profile || !canManageProfissionais(profile)) {
    return {
      error: NextResponse.json(
        { error: 'Gestão de profissionais indisponível para esta conta' },
        { status: 403 },
      ),
    };
  }
  return { profile };
}

function parseWhatsapp(raw: unknown): string | null {
  if (raw == null || String(raw).trim() === '') return null;
  const trimmed = String(raw).trim();
  if (!isValidPhone(trimmed)) return null;
  return normalizePhoneForStorage(trimmed);
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

function parseCorAgenda(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw == null || raw === '') return null;
  const normalized = normalizeCorAgenda(raw);
  if (!normalized) return null;
  return normalized;
}

const MEDICO_SELECT =
  'id, nome, whatsapp, email, percentual_comissao, cor_agenda, created_at';

export async function GET() {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email: clinicaEmail } = authResult;

  try {
    const gate = await requireSalaoEquipe(clinicaEmail);
    if ('error' in gate) return gate.error;

    const { data, error } = await supabaseAdmin
      .from('clinica_medicos')
      .select(MEDICO_SELECT)
      .eq('clinica_email', clinicaEmail)
      .order('nome', { ascending: true });

    if (error) throw error;

    const ids = (data ?? []).map((m) => m.id as string);
    const calMap = await loadCalendarRowsForMedicos(ids);
    const enriched = (data ?? []).map((m) => ({
      ...m,
      agenda_google_status: agendaStatusFromRow(calMap.get(m.id as string)),
    }));

    return NextResponse.json({ medicos: enriched, profissionais: enriched });
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
  const { email: clinicaEmail, googleSub } = authResult;

  try {
    const body = await req.json();

    if (!body.nome?.trim()) {
      return NextResponse.json({ error: 'Nome da profissional é obrigatório' }, { status: 400 });
    }

    const gate = await requireSalaoEquipe(clinicaEmail);
    if ('error' in gate) return gate.error;
    const { profile } = gate;

    try {
      await ensureOnboardingProfile(clinicaEmail, googleSub);
    } catch (ensureErr) {
      console.error('[perfil/medicos/POST] ensureOnboardingProfile:', ensureErr);
      return NextResponse.json(
        {
          error:
            'Perfil do salão ainda não está no banco. Salve Meu Perfil e tente novamente.',
        },
        { status: 400 },
      );
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

    const corAgenda = parseCorAgenda(body.cor_agenda);
    if (body.cor_agenda != null && body.cor_agenda !== '' && corAgenda == null) {
      return NextResponse.json({ error: 'Cor na agenda inválida (use #RRGGBB)' }, { status: 400 });
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
        cor_agenda: corAgenda ?? null,
      })
      .select(MEDICO_SELECT)
      .single();

    if (error) {
      console.error('[perfil/medicos/POST] Supabase:', error);
      return NextResponse.json(
        { error: supabaseErrorMessage(error, 'Erro ao adicionar profissional') },
        { status: 500 },
      );
    }

    await ensureProfissionalCalendarRow(data.id);
    const calMap = await loadCalendarRowsForMedicos([data.id]);
    const enriched = {
      ...data,
      agenda_google_status: agendaStatusFromRow(calMap.get(data.id)),
    };

    return NextResponse.json({
      medico: enriched,
      profissional: enriched,
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

    const corAgenda = parseCorAgenda(body.cor_agenda);
    if (body.cor_agenda != null && body.cor_agenda !== '' && corAgenda == null) {
      return NextResponse.json({ error: 'Cor na agenda inválida (use #RRGGBB)' }, { status: 400 });
    }

    const update: Record<string, unknown> = {
      nome: String(body.nome).trim(),
      whatsapp: parseWhatsapp(body.whatsapp),
      email: parseEmail(body.email),
    };
    if (percentual != null) update.percentual_comissao = percentual;
    if (corAgenda !== undefined) update.cor_agenda = corAgenda;

    const { data, error } = await supabaseAdmin
      .from('clinica_medicos')
      .update(update)
      .eq('id', id)
      .eq('clinica_email', clinicaEmail)
      .select(MEDICO_SELECT)
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

    await ensureProfissionalCalendarRow(data.id);
    const calMap = await loadCalendarRowsForMedicos([data.id]);
    const enriched = {
      ...data,
      agenda_google_status: agendaStatusFromRow(calMap.get(data.id)),
    };

    return NextResponse.json({
      medico: enriched,
      profissional: enriched,
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

    await deleteProfissionalCalendarForMedico(medicoId);

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
