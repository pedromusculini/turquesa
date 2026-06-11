import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import { generateVerificationCode } from '@/lib/googleAccountAccess';
import { sendFinanceiroPinResetEmail } from '@/lib/email';
import { checkRateLimit } from '@/lib/rateLimit';
import { supabaseAdmin } from '@/lib/supabaseClient';
import {
  attachUnlockCookie,
  assertPinAllowed,
  hashFinanceiroPin,
  resetPinAttempts,
} from '@/lib/financeiroPin';
import {
  storeFinanceiroPinResetCode,
  verifyFinanceiroPinResetCode,
} from '@/lib/financeiroPinResetCodes';

export async function POST(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email, googleSub } = authResult;

  try {
    const body = await req.json();
    const step = String(body.step ?? 'send').trim();

    if (step === 'send') {
      const rate = checkRateLimit(`financeiro-pin-reset:${email}`, 3, 15 * 60 * 1000);
      if (!rate.allowed) {
        return NextResponse.json(
          { error: `Aguarde ${rate.retryAfterSec}s antes de solicitar outro código.` },
          { status: 429 },
        );
      }

      const { data: profile } = await supabaseAdmin
        .from('onboarding_profiles')
        .select('modo_salao_enabled, financeiro_pin_hash')
        .eq('email', email)
        .maybeSingle();

      if (!profile?.modo_salao_enabled || !profile.financeiro_pin_hash) {
        return NextResponse.json({ error: 'Modo salão não está ativo.' }, { status: 400 });
      }

      const code = generateVerificationCode();
      await storeFinanceiroPinResetCode(email, googleSub, code);
      await sendFinanceiroPinResetEmail(email, code);

      return NextResponse.json({
        success: true,
        message: `Código enviado para ${email}. Válido por 5 minutos.`,
      });
    }

    if (step === 'confirm') {
      const otp = String(body.otp ?? '').trim();
      const newPin = String(body.newPin ?? '').trim();
      const newPinConfirm = String(body.newPinConfirm ?? '').trim();

      if (newPin !== newPinConfirm) {
        return NextResponse.json({ error: 'A confirmação do novo PIN não confere.' }, { status: 400 });
      }

      const verified = await verifyFinanceiroPinResetCode(email, googleSub, otp);
      if (!verified.valid) {
        return NextResponse.json({ error: verified.reason || 'Código inválido.' }, { status: 400 });
      }

      assertPinAllowed(newPin);
      const hash = await hashFinanceiroPin(newPin);

      const { error } = await supabaseAdmin
        .from('onboarding_profiles')
        .update({
          financeiro_pin_hash: hash,
          financeiro_pin_failed_attempts: 0,
          financeiro_pin_locked_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('email', email);

      if (error) throw error;

      await resetPinAttempts(email);

      const res = NextResponse.json({
        success: true,
        message: 'Novo PIN definido. Financeiro desbloqueado por 60 minutos.',
      });
      attachUnlockCookie(res, email);
      return res;
    }

    return NextResponse.json({ error: 'Etapa inválida.' }, { status: 400 });
  } catch (err) {
    console.error('[financeiro/unlock/reset/POST]', err);
    const message = err instanceof Error ? err.message : 'Erro ao redefinir PIN';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
