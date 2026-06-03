import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  GOOGLE_ACCESS_TABLE_SETUP_HINT,
  markEmailVerified,
  recordPrivacyConsent,
} from '@/lib/googleAccountAccess';
import { verifyGoogleAccessCode } from '@/lib/googleVerificationCodes';
import { checkRateLimit, resetRateLimit } from '@/lib/rateLimit';
import { PRIVACY_POLICY_VERSION, TERMS_VERSION } from '@/lib/legal';
import { VERIFICATION_CODE_DIGITS } from '@/lib/constants';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email || !session.googleSub) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const code = String(body.code ?? '').trim();
  const privacyConsent = body.privacyConsent === true;

  if (code.length !== VERIFICATION_CODE_DIGITS) {
    return NextResponse.json(
      { error: `Informe o código de ${VERIFICATION_CODE_DIGITS} dígitos.` },
      { status: 400 },
    );
  }

  if (!privacyConsent) {
    return NextResponse.json(
      { error: 'Aceite a Política de Privacidade e os Termos de Uso para continuar.' },
      { status: 400 },
    );
  }

  const email = session.user.email.toLowerCase().trim();
  const limitKey = `verify-code:${email}`;
  const limit = checkRateLimit(limitKey, 10, 15 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: `Muitas tentativas. Aguarde ${limit.retryAfterSec ?? 120}s e tente novamente.`,
      },
      { status: 429 },
    );
  }

  const result = await verifyGoogleAccessCode(email, session.googleSub, code);

  if (!result.valid) {
    return NextResponse.json({ error: result.reason }, { status: 400 });
  }

  try {
    await markEmailVerified(session.googleSub, email);
    await recordPrivacyConsent(
      session.googleSub,
      PRIVACY_POLICY_VERSION,
      TERMS_VERSION,
    );
    resetRateLimit(limitKey);
  } catch (err) {
    console.error('[google-access/verify-code] mark verified:', err);
    const msg =
      err instanceof Error ? err.message : 'Erro ao registrar verificação';
    const hint = msg.includes('MISSING_TABLE') || msg.includes('MISSING_ROW');
    return NextResponse.json(
      {
        error: hint
          ? `Código válido, mas o banco não está configurado. ${GOOGLE_ACCESS_TABLE_SETUP_HINT}`
          : `Código válido, mas falhou ao registrar: ${msg.replace(/^MISSING_[A-Z]+:/, '')}`,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    trialEligible: session.trialConsumed !== true,
    trialConsumed: session.trialConsumed === true,
  });
}
