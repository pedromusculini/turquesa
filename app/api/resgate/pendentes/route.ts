import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { requireGoogleAccessToken, isDriveError } from '@/lib/driveAuth';
import { buildResgatePendentesResponse } from '@/lib/resgatePendentes';

export async function GET(req: NextRequest) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const tokenResult = await requireGoogleAccessToken(req);
  if (isDriveError(tokenResult)) return tokenResult;

  try {
    const payload = await buildResgatePendentesResponse(email, tokenResult);
    return NextResponse.json(payload);
  } catch (error) {
    console.error('[resgate/pendentes]', error);
    return NextResponse.json({ error: 'Erro ao carregar resgates' }, { status: 500 });
  }
}
