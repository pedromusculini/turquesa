import { supabaseAdmin } from '@/lib/supabaseClient';
import { FINANCEIRO_PIN_RESET_PURPOSE } from '@/lib/financeiroPin';

const CODE_TTL_MS = 5 * 60 * 1000;

export async function storeFinanceiroPinResetCode(
  email: string,
  googleSub: string,
  code: string,
): Promise<void> {
  const normalized = email.toLowerCase().trim();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

  await supabaseAdmin
    .from('verification_codes')
    .update({ used: true })
    .eq('email', normalized)
    .eq('role', FINANCEIRO_PIN_RESET_PURPOSE)
    .eq('used', false);

  const { error } = await supabaseAdmin.from('verification_codes').insert({
    email: normalized,
    code,
    expires_at: expiresAt,
    used: false,
    role: FINANCEIRO_PIN_RESET_PURPOSE,
    plan: googleSub,
  });

  if (error) {
    console.error('[financeiroPinResetCodes] insert:', error);
    throw new Error('Não foi possível gerar o código.');
  }
}

export async function verifyFinanceiroPinResetCode(
  email: string,
  googleSub: string,
  typedCode: string,
): Promise<{ valid: boolean; reason?: string }> {
  const normalized = email.toLowerCase().trim();
  const now = new Date().toISOString();

  const { data: rows, error } = await supabaseAdmin
    .from('verification_codes')
    .select('id, code, expires_at, plan')
    .eq('email', normalized)
    .eq('role', FINANCEIRO_PIN_RESET_PURPOSE)
    .eq('used', false)
    .eq('code', typedCode.trim())
    .gt('expires_at', now)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('[financeiroPinResetCodes] verify:', error);
    return { valid: false, reason: 'Erro ao validar o código.' };
  }

  const row = rows?.[0];
  if (!row) {
    return {
      valid: false,
      reason: 'Código inválido ou expirado (válido por 5 minutos).',
    };
  }

  if (row.plan && row.plan !== googleSub) {
    return { valid: false, reason: 'Código não corresponde a esta sessão.' };
  }

  await supabaseAdmin.from('verification_codes').update({ used: true }).eq('id', row.id);

  return { valid: true };
}
