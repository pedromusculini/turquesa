import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { recordPrivacyConsent } from '@/lib/googleAccountAccess';
import { PRIVACY_POLICY_VERSION, TERMS_VERSION } from '@/lib/legal';

export async function POST() {
  const session = await auth();
  if (!session?.googleSub) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  await recordPrivacyConsent(
    session.googleSub,
    PRIVACY_POLICY_VERSION,
    TERMS_VERSION,
  );

  return NextResponse.json({
    ok: true,
    privacy_version: PRIVACY_POLICY_VERSION,
    terms_version: TERMS_VERSION,
  });
}
