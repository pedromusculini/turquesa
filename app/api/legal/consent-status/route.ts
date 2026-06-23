import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getGoogleAccountBySub } from '@/lib/googleAccountAccess';
import {
  needsLegalReaccept,
  PRIVACY_POLICY_VERSION,
  TERMS_VERSION,
} from '@/lib/legal';

export async function GET() {
  const session = await auth();
  if (!session?.googleSub) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const row = await getGoogleAccountBySub(session.googleSub);
  const privacyVersion = (row as { privacy_policy_version?: string } | null)
    ?.privacy_policy_version;
  const termsVersion = (row as { terms_version?: string } | null)?.terms_version;

  return NextResponse.json({
    needsReaccept: needsLegalReaccept(privacyVersion, termsVersion),
    acceptedPrivacy: privacyVersion ?? null,
    acceptedTerms: termsVersion ?? null,
    currentPrivacy: PRIVACY_POLICY_VERSION,
    currentTerms: TERMS_VERSION,
  });
}
