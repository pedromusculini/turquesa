import { supabaseAdmin } from '@/lib/supabaseClient';
import { GOOGLE_ACCESS_CODE_PURPOSE } from '@/lib/googleAccountAccess';

export type ResetTenantAccessResult = {
  ok: boolean;
  email: string;
  google_sub: string | null;
  message: string;
};

/** Localiza google_sub pelo e-mail da conta (acesso ou perfil). */
async function resolveGoogleSubByOwnerEmail(
  ownerEmail: string,
): Promise<string | null> {
  const email = ownerEmail.toLowerCase().trim();

  const { data: access } = await supabaseAdmin
    .from('google_account_access')
    .select('google_sub')
    .eq('email', email)
    .maybeSingle();

  if (access?.google_sub) return access.google_sub;

  const { data: profile } = await supabaseAdmin
    .from('onboarding_profiles')
    .select('google_sub')
    .eq('email', email)
    .maybeSingle();

  return profile?.google_sub ?? null;
}

/**
 * Reset de acesso (opção usual em suporte): exige nova verificação de e-mail no próximo uso.
 * Mantém perfil, trial e dados operacionais; não remove pacientes nem Drive.
 */
export async function resetTenantEmailVerification(
  ownerEmail: string,
): Promise<ResetTenantAccessResult> {
  const email = ownerEmail.toLowerCase().trim();
  const googleSub = await resolveGoogleSubByOwnerEmail(email);

  if (!googleSub) {
    return {
      ok: false,
      email,
      google_sub: null,
      message: 'Nenhum vínculo Google encontrado para esta conta.',
    };
  }

  const now = new Date().toISOString();

  const { error: updateError } = await supabaseAdmin
    .from('google_account_access')
    .update({
      email_verified_at: null,
      last_login_at: null,
      updated_at: now,
    })
    .eq('google_sub', googleSub);

  if (updateError) throw updateError;

  await supabaseAdmin
    .from('verification_codes')
    .update({ used: true })
    .eq('email', email)
    .eq('role', GOOGLE_ACCESS_CODE_PURPOSE)
    .eq('used', false);

  return {
    ok: true,
    email,
    google_sub: googleSub,
    message:
      'Verificação de e-mail resetada. O usuário precisará confirmar o código em /auth/verificar-email (peça para sair e entrar de novo se a sessão ainda estiver aberta).',
  };
}

/**
 * Remove o registro em google_account_access (login Google no app).
 * No próximo login um registro novo é criado; perfil/onboarding permanecem.
 * Trial pode voltar ao estado inicial do registro — use só se necessário.
 */
export async function removeTenantGoogleAccessRecord(
  ownerEmail: string,
): Promise<ResetTenantAccessResult> {
  const email = ownerEmail.toLowerCase().trim();
  const googleSub = await resolveGoogleSubByOwnerEmail(email);

  if (!googleSub) {
    return {
      ok: false,
      email,
      google_sub: null,
      message: 'Nenhum registro de acesso Google para remover.',
    };
  }

  const { error: deleteError } = await supabaseAdmin
    .from('google_account_access')
    .delete()
    .eq('google_sub', googleSub);

  if (deleteError) throw deleteError;

  await supabaseAdmin
    .from('verification_codes')
    .update({ used: true })
    .eq('email', email)
    .eq('role', GOOGLE_ACCESS_CODE_PURPOSE)
    .eq('used', false);

  return {
    ok: true,
    email,
    google_sub: googleSub,
    message:
      'Registro de acesso Google removido. No próximo login o fluxo de verificação recomeça. Dados da clínica no app foram mantidos.',
  };
}
