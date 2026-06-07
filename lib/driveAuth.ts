import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  getOwnerGoogleAccessToken,
  migrateOwnerTokensFromCookies,
} from '@/lib/ownerGoogleTokens';

/** Token Google (Drive): Supabase com auto-refresh, cookie legado ou sessão NextAuth. */
export async function getGoogleAccessToken(req: NextRequest): Promise<string | null> {
  const session = await auth();
  const googleSub = session?.googleSub;

  if (googleSub) {
    try {
      await migrateOwnerTokensFromCookies(req, googleSub);
      const dbToken = await getOwnerGoogleAccessToken(googleSub, 'drive');
      if (dbToken) return dbToken;
    } catch (err) {
      console.warn('[driveAuth] getOwnerGoogleAccessToken:', err);
    }
  }

  const cookieToken = req.cookies.get('google_drive_token')?.value;
  if (cookieToken) return cookieToken;

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
          'Conecte o Google para salvar clientes e faturamento. No Dashboard, clique em "Conectar Google".',
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
