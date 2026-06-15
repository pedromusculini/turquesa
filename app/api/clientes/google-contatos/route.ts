import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import {
  requireGoogleContactsToken,
  isContactsError,
} from '@/lib/contactsAuth';
import {
  getGoogleContactsCached,
  GOOGLE_CONTACTS_CACHE_TTL_MS,
} from '@/lib/googleContactsCache';
import { filterAndSortByClienteQuery } from '@/lib/clienteSearch';
import { googleOpcaoIdFromContact } from '@/lib/pacienteOpcoesUi';
import { aplicarMascaraWhatsapp } from '@/lib/constants';
import type { PacienteOpcao } from '@/lib/types';

export async function GET(req: NextRequest) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  const limitRaw = Number.parseInt(
    req.nextUrl.searchParams.get('limit') ?? '25',
    10,
  );
  const limit = Number.isFinite(limitRaw)
    ? Math.min(50, Math.max(1, limitRaw))
    : 25;

  const contactsToken = await requireGoogleContactsToken(req);
  const googleContatosDisponivel = !isContactsError(contactsToken);

  if (q.length < 2) {
    return NextResponse.json({
      contatos: [] as PacienteOpcao[],
      aviso: null,
      google_contatos_disponivel: googleContatosDisponivel,
    });
  }

  if (!googleContatosDisponivel) {
    return NextResponse.json({
      contatos: [] as PacienteOpcao[],
      aviso: 'Conecte os Contatos Google no Dashboard para buscar contatos.',
      google_contatos_disponivel: false,
    });
  }

  let aviso: string | null = null;
  try {
    const cached = await getGoogleContactsCached(email, contactsToken);
    if (cached.quotaExceeded && cached.error) {
      aviso = cached.error;
    }

    const filtered = filterAndSortByClienteQuery(
      cached.contacts,
      q,
      (c) => `${c.nome} ${c.telefone ?? ''} ${c.email ?? ''}`,
      (c) => c.nome,
    );

    const contatos: PacienteOpcao[] = filtered.slice(0, limit).map((contact) => {
      const tel = contact.telefone
        ? aplicarMascaraWhatsapp(contact.telefone)
        : null;
      return {
        id: googleOpcaoIdFromContact(contact),
        nome: contact.nome,
        telefone: tel,
        email: contact.email,
        cpf: null,
        data_nascimento: contact.data_nascimento,
        convenio: null,
        origem: 'google' as const,
      };
    });

    const maxAgeSec = Math.floor(GOOGLE_CONTACTS_CACHE_TTL_MS / 1000);

    return NextResponse.json(
      { contatos, aviso, google_contatos_disponivel: true },
      {
        headers: {
          'Cache-Control': `private, max-age=${maxAgeSec}`,
        },
      },
    );
  } catch {
    return NextResponse.json({
      contatos: [] as PacienteOpcao[],
      aviso:
        aviso ??
        'Não foi possível consultar Contatos Google — tente novamente em instantes.',
      google_contatos_disponivel: true,
    });
  }
}
