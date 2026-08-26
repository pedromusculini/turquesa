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
 * Remove o login do painel: vínculo Google + perfil + assinatura.
 * Clientes/agenda/Drive (owner_email) permanecem; no próximo login o fluxo recomeça.
 * Antes só apagava google_account_access — a conta continuava na lista via onboarding_profiles.
 */
export async function removeTenantGoogleAccessRecord(
  ownerEmail: string,
): Promise<ResetTenantAccessResult> {
  const email = ownerEmail.toLowerCase().trim();
  const googleSub = await resolveGoogleSubByOwnerEmail(email);

  const accessByEmail = await supabaseAdmin
    .from('google_account_access')
    .select('google_sub, email')
    .eq('email', email);
  if (accessByEmail.error) throw accessByEmail.error;
  let accessBefore = accessByEmail.data ?? [];
  if (googleSub) {
    const accessBySub = await supabaseAdmin
      .from('google_account_access')
      .select('google_sub, email')
      .eq('google_sub', googleSub);
    if (accessBySub.error) throw accessBySub.error;
    const seen = new Set(accessBefore.map((r) => r.google_sub));
    for (const row of accessBySub.data ?? []) {
      if (!seen.has(row.google_sub)) accessBefore.push(row);
    }
  }

  const { data: profileBefore } = await supabaseAdmin
    .from('onboarding_profiles')
    .select('email')
    .eq('email', email)
    .maybeSingle();

  const { data: assinaturaBefore } = await supabaseAdmin
    .from('assinaturas')
    .select('owner_email')
    .eq('owner_email', email)
    .maybeSingle();

  if (
    !(accessBefore && accessBefore.length > 0) &&
    !profileBefore &&
    !assinaturaBefore
  ) {
    return {
      ok: false,
      email,
      google_sub: googleSub,
      message:
        'Nada para excluir: não há login Google, perfil nem assinatura para este e-mail.',
    };
  }

  // Acesso: por sub e por e-mail (evita linha órfã se e-mail/sub divergirem)
  if (googleSub) {
    const { error } = await supabaseAdmin
      .from('google_account_access')
      .delete()
      .eq('google_sub', googleSub);
    if (error) throw error;
  }
  {
    const { error } = await supabaseAdmin
      .from('google_account_access')
      .delete()
      .eq('email', email);
    if (error) throw error;
  }

  const { error: profileErr } = await supabaseAdmin
    .from('onboarding_profiles')
    .delete()
    .eq('email', email);
  if (profileErr) throw profileErr;

  const { error: assinaturaErr } = await supabaseAdmin
    .from('assinaturas')
    .delete()
    .eq('owner_email', email);
  if (assinaturaErr) throw assinaturaErr;

  await supabaseAdmin
    .from('verification_codes')
    .update({ used: true })
    .eq('email', email)
    .eq('role', GOOGLE_ACCESS_CODE_PURPOSE)
    .eq('used', false);

  const parts: string[] = [];
  if (accessBefore && accessBefore.length > 0) parts.push('login Google');
  if (profileBefore) parts.push('perfil');
  if (assinaturaBefore) parts.push('assinatura');

  return {
    ok: true,
    email,
    google_sub: googleSub,
    message: `Removido da lista (${parts.join(', ') || 'registros'}). Clientes/agenda no banco (se houver) permanecem ligados a este e-mail. Próximo login recomeça do zero.`,
  };
}
