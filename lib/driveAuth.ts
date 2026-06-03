import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

/** Token Google (Drive) do cookie incremental ou da sessão NextAuth */
export async function getGoogleAccessToken(req: NextRequest): Promise<string | null> {
  const cookieToken = req.cookies.get('google_drive_token')?.value;
  if (cookieToken) return cookieToken;

  const session = await auth();
  const sessionToken = (session as { accessToken?: string })?.accessToken;
  return sessionToken ?? null;
}

export async function requireGoogleAccessToken(
  req: NextRequest,
): Promise<string | NextResponse> {
  const token = await getGoogleAccessToken(req);
  if (!token) {
    return NextResponse.json(
      {
        error:
          'Conecte o Google Drive para salvar clientes e faturamento. Vá em Backup ou Agenda e autorize o Drive.',
        code: 'DRIVE_NOT_CONNECTED',
      },
      { status: 403 },
    );
  }
  return token;
}

export function isDriveError(
  result: string | NextResponse,
): result is NextResponse {
  return result instanceof NextResponse;
}
