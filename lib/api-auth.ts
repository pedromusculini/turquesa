import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { getDevBypassIdentity, isDevBypassAuthActive } from '@/lib/devBypassAuth';
import { getGoogleAccessForSession } from '@/lib/requireGoogleAccess';

function devBypassOwner():
  | { email: string; googleSub: string }
  | null {
  if (!isDevBypassAuthActive()) return null;
  const { email, googleSub } = getDevBypassIdentity();
  return { email, googleSub };
}

export async function requireOwnerEmail(): Promise<
  { email: string; googleSub: string } | NextResponse
> {
  const bypass = devBypassOwner();
  if (bypass) return bypass;

  const session = await auth();
  const email = session?.user?.email?.toLowerCase().trim();
  const googleSub = session?.googleSub;
  if (!email || !googleSub) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  return { email, googleSub };
}

/** Sessão autenticada + e-mail confirmado (LGPD / anti-abuso). */
export async function requireVerifiedOwner(): Promise<
  { email: string; googleSub: string } | NextResponse
> {
  const bypass = devBypassOwner();
  if (bypass) return bypass;

  const session = await auth();
  const email = session?.user?.email?.toLowerCase().trim();
  const googleSub = session?.googleSub;
  if (!email || !googleSub) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const access = await getGoogleAccessForSession(session);
  if (!access?.accessVerified) {
    return NextResponse.json(
      {
        error: 'Confirme seu e-mail com o código enviado antes de continuar.',
        code: 'EMAIL_VERIFICATION_REQUIRED',
      },
      { status: 403 },
    );
  }

  return { email, googleSub };
}

export function isAuthError(
  result: { email: string; googleSub?: string } | NextResponse,
): result is NextResponse {
  return result instanceof NextResponse;
}
