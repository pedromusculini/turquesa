import type { Session } from 'next-auth';
import { NextResponse } from 'next/server';
import {
  buildAccessState,
  getGoogleAccountBySub,
  type GoogleAccessState,
} from '@/lib/googleAccountAccess';

export type GoogleAccessCheck = {
  googleSub: string;
  email: string;
  accessVerified: boolean;
  state: GoogleAccessState;
};

/** Estado de verificação de e-mail a partir do banco (fonte da verdade). */
export async function getGoogleAccessFromDb(
  googleSub: string,
  email: string,
): Promise<GoogleAccessCheck> {
  const normalizedEmail = email.toLowerCase().trim();
  const row = await getGoogleAccountBySub(googleSub);
  const state = buildAccessState(row, normalizedEmail, googleSub);
  return {
    googleSub,
    email: normalizedEmail,
    accessVerified: state.accessVerified,
    state,
  };
}

export async function getGoogleAccessForSession(
  session: Session | null,
): Promise<GoogleAccessCheck | null> {
  const googleSub = session?.googleSub;
  const email = session?.user?.email;
  if (!googleSub || !email) return null;
  return getGoogleAccessFromDb(googleSub, email);
}

export function googleAccessDeniedResponse() {
  return NextResponse.json(
    {
      error: 'Confirme seu e-mail com o código enviado antes de continuar.',
      code: 'EMAIL_VERIFICATION_REQUIRED',
    },
    { status: 403 },
  );
}
