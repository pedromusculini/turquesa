import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { requireGoogleAccessToken, isDriveError } from '@/lib/driveAuth';
import {
  requireGoogleContactsToken,
  isContactsError,
} from '@/lib/contactsAuth';
import { fetchGoogleContacts } from '@/lib/googleContacts';
import {
  createClienteRecord,
  findClienteByContato,
  loadClientesStore,
  saveClientesStore,
} from '@/lib/clientesDrive';

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
    const imports = await fetchGoogleContacts(contactsToken);
    const store = await loadClientesStore(driveToken, email);

    let criados = 0;
    let ignorados = 0;

    for (const contact of imports) {
      const existente = findClienteByContato(store, {
        email: contact.email,
        telefone: contact.telefone,
      });

      if (existente) {
        ignorados++;
        if (!existente.email && contact.email) existente.email = contact.email;
        if (!existente.telefone && contact.telefone) {
          existente.telefone = contact.telefone;
        }
        if (!existente.data_nascimento && contact.data_nascimento) {
          existente.data_nascimento = contact.data_nascimento;
        }
        const tag = 'Importado do Google Contatos';
        if (
          existente.observacoes_gerais &&
          !existente.observacoes_gerais.includes(tag)
        ) {
          existente.observacoes_gerais = `${existente.observacoes_gerais}\n${tag}`;
        } else if (!existente.observacoes_gerais) {
          existente.observacoes_gerais = tag;
        }
        existente.updated_at = new Date().toISOString();
        continue;
      }

      const cliente = createClienteRecord({
        nome: contact.nome,
        email: contact.email,
        telefone: contact.telefone,
        data_nascimento: contact.data_nascimento,
        observacoes_gerais: 'Importado do Google Contatos',
      });
      store.clientes.push(cliente);
      criados++;
    }

    if (criados > 0 || ignorados > 0) {
      await saveClientesStore(driveToken, store);
    }

    return NextResponse.json({
      success: true,
      totalGoogle: imports.length,
      criados,
      ignorados,
      storage: 'google_drive',
    });
  } catch (err: unknown) {
    console.error('[sync-google-contacts]', err);
    const message =
      err instanceof Error ? err.message : 'Erro ao importar contatos';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
