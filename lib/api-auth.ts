import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import {
  canAccessClienteFichaProfissional,
  resolveOwnerEmailFromFormularioToken,
} from '@/lib/clienteFichaAccess';
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

export type ClienteFichaAuthContext = {
  email: string;
  googleSub: string;
  ownerEmail: string;
  role: 'titular' | 'equipe';
  nomeProfissional?: string;
};

/** Sessão + vínculo ao salão do token (titular ou equipe com agenda conectada). */
export async function requireClienteFichaAccess(
  token: string,
): Promise<ClienteFichaAuthContext | NextResponse> {
  const ownerResult = await resolveOwnerEmailFromFormularioToken(token);
  if (!ownerResult.ok) {
    return NextResponse.json({ error: ownerResult.error }, { status: ownerResult.status });
  }

  const bypass = devBypassOwner();
  let email: string;
  let googleSub: string;
  let session = bypass ? null : await auth();

  if (bypass) {
    email = bypass.email;
    googleSub = bypass.googleSub;
  } else {
    email = session?.user?.email?.toLowerCase().trim() ?? '';
    googleSub = session?.googleSub ?? '';
    if (!email || !googleSub) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
  }

  const access = await canAccessClienteFichaProfissional({
    googleSub,
    sessionEmail: email,
    ownerEmail: ownerResult.ownerEmail,
  });

  if (!access.allowed) {
    return NextResponse.json({ error: access.reason }, { status: 403 });
  }

  if (access.role === 'titular' && !bypass) {
    const verified = await getGoogleAccessForSession(session);
    if (!verified?.accessVerified) {
      return NextResponse.json(
        {
          error: 'Confirme seu e-mail com o código enviado antes de continuar.',
          code: 'EMAIL_VERIFICATION_REQUIRED',
        },
        { status: 403 },
      );
    }
  }

  return {
    email,
    googleSub,
    ownerEmail: ownerResult.ownerEmail,
    role: access.role,
    ...(access.role === 'equipe' ? { nomeProfissional: access.nomeProfissional } : {}),
  };
}
