import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { supabaseErrorMessage } from '@/lib/supabaseErrors';
import { canManageProfissionais } from '@/lib/salaoEquipeAccess';
import { loadOnboardingProfileGate } from '@/lib/ensureOnboardingProfile';
import { getAppBaseUrl } from '@/lib/appUrl';
import {
  buildAgendaInviteUrl,
  regenerateProfissionalInvite,
} from '@/lib/profissionalGoogleCalendar';
import {
  buildPedidoAcessoAgendaWhatsAppMessage,
  buildWhatsAppUrls,
} from '@/lib/whatsapp';

/** Gera ou renova convite de agenda Google para uma profissional. */
export async function POST(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email: clinicaEmail } = authResult;

  try {
    const body = await req.json();
    const profissionalId = body.id?.trim() || body.profissionalId?.trim();

    if (!profissionalId) {
      return NextResponse.json({ error: 'ID da profissional é obrigatório' }, { status: 400 });
    }

    const profile = await loadOnboardingProfileGate(clinicaEmail);
    if (!profile || !canManageProfissionais(profile)) {
      return NextResponse.json(
        { error: 'Gestão de profissionais indisponível para esta conta' },
        { status: 403 },
      );
    }

    const { data: medico, error: medErr } = await supabaseAdmin
      .from('clinica_medicos')
      .select('id, nome, whatsapp')
      .eq('id', profissionalId)
      .eq('clinica_email', clinicaEmail)
      .maybeSingle();

    if (medErr) throw medErr;
    if (!medico) {
      return NextResponse.json({ error: 'Profissional não encontrada' }, { status: 404 });
    }

    const row = await regenerateProfissionalInvite(profissionalId, clinicaEmail);
    const baseUrl = getAppBaseUrl(req);
    const inviteUrl = buildAgendaInviteUrl(row.invite_token, baseUrl);

    const { data: profileRow } = await supabaseAdmin
      .from('onboarding_profiles')
      .select('clinic_name, full_name')
      .eq('email', clinicaEmail)
      .maybeSingle();

    const nomeSalao =
      profileRow?.clinic_name?.trim() || profileRow?.full_name?.trim() || undefined;

    const mensagem = buildPedidoAcessoAgendaWhatsAppMessage({
      nomeProfissional: medico.nome,
      nomeSalao,
      linkConvite: inviteUrl,
    });

    const whatsapp = medico.whatsapp ? buildWhatsAppUrls(medico.whatsapp, mensagem) : null;

    return NextResponse.json({
      invite_token: row.invite_token,
      invite_url: inviteUrl,
      invite_expires_at: row.invite_token_expires_at,
      mensagem,
      whatsapp_url: whatsapp?.web ?? null,
      whatsapp_app_url: whatsapp?.app ?? null,
      whatsapp_android_url: whatsapp?.android ?? null,
    });
  } catch (error) {
    console.error('[perfil/medicos/invite-agenda]', error);
    return NextResponse.json(
      { error: supabaseErrorMessage(error, 'Erro ao gerar convite de agenda') },
      { status: 500 },
    );
  }
}
