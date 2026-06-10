import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { requireGoogleAccessToken, isDriveError } from '@/lib/driveAuth';
import {
  requireGoogleContactsToken,
  isContactsError,
} from '@/lib/contactsAuth';
import {
  getGoogleContactsCached,
  invalidateGoogleContactsCache,
} from '@/lib/googleContactsCache';
import { importGoogleContactsIntoStore } from '@/lib/clientesGoogleSync';
import { loadClientesStore, saveClientesStore } from '@/lib/clientesDrive';

export const runtime = 'nodejs';

/** Importa contatos do Google para clientes.json no Drive (sem duplicar e-mail/telefone). */
export async function POST(req: NextRequest) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const driveToken = await requireGoogleAccessToken(req);
  if (isDriveError(driveToken)) return driveToken;

  const contactsToken = await requireGoogleContactsToken(req);
  if (isContactsError(contactsToken)) return contactsToken;

  try {
    invalidateGoogleContactsCache(email);
    const { contacts: imports } = await getGoogleContactsCached(
      email,
      contactsToken,
      { force: true },
    );
    const store = await loadClientesStore(driveToken, email);

    const { criados, ignorados, vinculados, changed } = importGoogleContactsIntoStore(
      store,
      imports,
    );

    if (changed) {
      await saveClientesStore(driveToken, store);
    }

    return NextResponse.json({
      success: true,
      totalGoogle: imports.length,
      criados,
      ignorados,
      vinculados,
      storage: 'google_drive',
    });
  } catch (err: unknown) {
    console.error('[sync-google-contacts]', err);
    const message =
      err instanceof Error ? err.message : 'Erro ao importar contatos';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
