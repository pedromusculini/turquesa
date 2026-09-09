import { NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { supabaseErrorMessage } from '@/lib/supabaseErrors';
import { canManageProfissionais } from '@/lib/salaoEquipeAccess';
import { ensureOnboardingProfile, loadOnboardingProfileGate } from '@/lib/ensureOnboardingProfile';
import { isValidPhone, normalizePhoneForStorage } from '@/lib/phoneMatch';
import {
  agendaStatusFromRow,
  ensureProfissionalCalendarRow,
  loadCalendarRowsForMedicos,
} from '@/lib/profissionalGoogleCalendar';
import { AGENDA_COR_PRESETS } from '@/lib/agendaProfissionalColors';

export const runtime = 'nodejs';

/**
 * Cria a titular como profissional (clinica_medicos) se ainda não houver equipe.
 * Usa o calendário Google do login (owner) — sem convite OAuth de equipe.
 */
export async function POST() {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email: clinicaEmail, googleSub } = authResult;

  try {
    const profile = await loadOnboardingProfileGate(clinicaEmail);
    if (!profile || !canManageProfissionais(profile)) {
      return NextResponse.json(
        { error: 'Complete o cadastro do salão antes de configurar a profissional.' },
        { status: 403 },
      );
    }

    try {
      await ensureOnboardingProfile(clinicaEmail, googleSub);
    } catch (ensureErr) {
      console.error('[setup-titular-profissional] ensure:', ensureErr);
      return NextResponse.json(
        { error: 'Perfil do salão ainda não está pronto. Tente novamente.' },
        { status: 400 },
      );
    }

    const { data: profileRow, error: profileErr } = await supabaseAdmin
      .from('onboarding_profiles')
      .select('full_name, clinic_name, whatsapp')
      .eq('email', clinicaEmail.toLowerCase().trim())
      .maybeSingle();
    if (profileErr) throw profileErr;

    const { data: existing, error: listErr } = await supabaseAdmin
      .from('clinica_medicos')
      .select('id, nome, email, whatsapp, percentual_comissao, cor_agenda, created_at')
      .eq('clinica_email', clinicaEmail)
      .order('created_at', { ascending: true })
      .limit(5);

    if (listErr) throw listErr;

    if ((existing ?? []).length > 0) {
      const first = existing![0];
      const firstEmail = String(first.email ?? '')
        .trim()
        .toLowerCase();
      // Quem já cadastrou o e-mail de login: marca Calendar do estabelecimento e sai.
      if (googleSub && firstEmail === clinicaEmail.toLowerCase().trim()) {
        await ensureProfissionalCalendarRow(first.id);
        const now = new Date().toISOString();
        const calMapBefore = await loadCalendarRowsForMedicos([first.id]);
        const row = calMapBefore.get(first.id);
        if (!row?.connected_at || (!row.refresh_token_encrypted && !row.google_sub)) {
          await supabaseAdmin
            .from('profissional_google_calendar')
            .update({
              google_sub: googleSub,
              calendar_id: 'primary',
              connected_at: now,
              invite_used_at: now,
              updated_at: now,
            })
            .eq('clinica_medicos_id', first.id);
        }
      }
      const calMap = await loadCalendarRowsForMedicos([first.id]);
      return NextResponse.json({
        success: true,
        alreadyExisted: true,
        profissional: {
          ...first,
          agenda_google_status: agendaStatusFromRow(calMap.get(first.id)),
        },
      });
    }

    const nome =
      profileRow?.full_name?.trim() ||
      profileRow?.clinic_name?.trim() ||
      clinicaEmail.split('@')[0] ||
      'Titular';

    const whatsappRaw = profileRow?.whatsapp?.trim() || '';
    const whatsapp =
      whatsappRaw && isValidPhone(whatsappRaw)
        ? normalizePhoneForStorage(whatsappRaw)
        : null;

    const corAgenda = AGENDA_COR_PRESETS[0]?.border ?? '#047482';

    const { data, error } = await supabaseAdmin
      .from('clinica_medicos')
      .insert({
        clinica_email: clinicaEmail,
        nome,
        crm: null,
        specialty: null,
        whatsapp,
        email: clinicaEmail.toLowerCase(),
        percentual_comissao: 100,
        cor_agenda: corAgenda,
      })
      .select('id, nome, email, whatsapp, percentual_comissao, cor_agenda, created_at')
      .single();

    if (error) throw error;

    await ensureProfissionalCalendarRow(data.id);

    // Marca como conectada ao Calendar do estabelecimento (login), sem convite de equipe.
    const now = new Date().toISOString();
    if (googleSub) {
      await supabaseAdmin
        .from('profissional_google_calendar')
        .update({
          google_sub: googleSub,
          calendar_id: 'primary',
          connected_at: now,
          invite_used_at: now,
          updated_at: now,
        })
        .eq('clinica_medicos_id', data.id);
    }

    const calMap = await loadCalendarRowsForMedicos([data.id]);

    return NextResponse.json({
      success: true,
      alreadyExisted: false,
      profissional: {
        ...data,
        agenda_google_status: agendaStatusFromRow(calMap.get(data.id)),
      },
      message:
        'Você foi cadastrada como profissional. A agenda usa o Google do estabelecimento (login).',
    });
  } catch (error) {
    console.error('[setup-titular-profissional]', error);
    return NextResponse.json(
      { error: supabaseErrorMessage(error, 'Erro ao configurar profissional') },
      { status: 500 },
    );
  }
}
