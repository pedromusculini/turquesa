import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  getOwnerGoogleAccessToken,
  migrateOwnerTokensFromCookies,
} from '@/lib/ownerGoogleTokens';

/** Token do escopo Google Contatos: Supabase com auto-refresh ou cookie legado. */
export async function getGoogleContactsToken(
  req: NextRequest,
): Promise<string | null> {
  const session = await auth();
  const googleSub = session?.googleSub;

  if (googleSub) {
    try {
      await migrateOwnerTokensFromCookies(req, googleSub);
      const dbToken = await getOwnerGoogleAccessToken(googleSub, 'contacts');
      if (dbToken) return dbToken;
    } catch (err) {
      console.warn('[contactsAuth] getOwnerGoogleAccessToken:', err);
    }
  }

  return req.cookies.get('google_contacts_token')?.value ?? null;
}

export async function requireGoogleContactsToken(
  req: NextRequest,
): Promise<string | NextResponse> {
  const token = await getGoogleContactsToken(req);
  if (!token) {
    return NextResponse.json(
      {
        error:
          'Autorize o acesso aos Contatos Google para importar clientes da sua agenda de contatos.',
        code: 'CONTACTS_NOT_CONNECTED',
      },
      { status: 403 },
    );
  }
  return token;
}

export function isContactsError(
  result: string | NextResponse,
): result is NextResponse {
  return result instanceof NextResponse;
}
