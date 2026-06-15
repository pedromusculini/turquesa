import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import {
  requireGoogleContactsToken,
  isContactsError,
} from '@/lib/contactsAuth';
import { getGoogleContactsCached } from '@/lib/googleContactsCache';

/** Pré-aquece o cache server-side de Contatos Google (People API). */
export async function POST(req: NextRequest) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const contactsToken = await requireGoogleContactsToken(req);
  if (isContactsError(contactsToken)) {
    return NextResponse.json(
      { ok: false, error: 'Contatos Google não conectados.' },
      { status: 400 },
    );
  }

  try {
    const result = await getGoogleContactsCached(email, contactsToken);
    return NextResponse.json({
      ok: true,
      fromCache: result.fromCache,
      count: result.contacts.length,
      quotaExceeded: result.quotaExceeded ?? false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao carregar contatos';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
