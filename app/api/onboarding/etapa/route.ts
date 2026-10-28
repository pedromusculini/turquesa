import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import {
  isOnboardingEtapa,
  registrarEtapaOnboarding,
} from '@/lib/onboardingEtapas';

export const runtime = 'nodejs';

/** Registra uma etapa do primeiro uso (medição do funil; nunca bloqueia o usuário). */
export async function POST(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;

  const body = await req.json().catch(() => ({}));
  if (!isOnboardingEtapa(body?.etapa)) {
    return NextResponse.json({ error: 'Etapa inválida.' }, { status: 400 });
  }

  await registrarEtapaOnboarding(authResult.email, body.etapa);
  return NextResponse.json({ ok: true });
}
