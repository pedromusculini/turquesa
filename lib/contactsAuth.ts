import { NextRequest, NextResponse } from 'next/server';

/** Token do escopo Google Contatos (OAuth incremental). */
export async function getGoogleContactsToken(
  req: NextRequest,
): Promise<string | null> {
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
          'Autorize o acesso aos Contatos Google para importar pacientes da sua agenda de contatos.',
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
