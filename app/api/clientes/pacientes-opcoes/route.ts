import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { requireGoogleAccessToken, isDriveError } from '@/lib/driveAuth';
import {
  requireGoogleContactsToken,
  isContactsError,
} from '@/lib/contactsAuth';
import type { GoogleContactImport } from '@/lib/googleContacts';
import {
  getGoogleContactsCached,
  GOOGLE_CONTACTS_CACHE_TTL_MS,
} from '@/lib/googleContactsCache';
import {
  filterClientes,
  findClienteByContato,
  findClienteByNome,
  loadClientesStore,
} from '@/lib/clientesDrive';
import {
  enrichOpcoesComGoogle,
  googleOpcaoIdFromContact,
} from '@/lib/pacienteOpcoesUi';
import { phoneDigits } from '@/lib/phoneMatch';
import { clienteMatchesQuery, scoreClienteMatch } from '@/lib/clienteSearch';
import { aplicarMascaraWhatsapp } from '@/lib/constants';
import type { PacienteOpcao } from '@/lib/types';

function mapDrive(c: {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  cpf: string | null;
  data_nascimento: string | null;
  convenio: string | null;
  atendimentos?: { length: number };
}): PacienteOpcao {
  return {
    id: `d:${c.id}`,
    nome: c.nome,
    telefone: c.telefone ? aplicarMascaraWhatsapp(c.telefone) : null,
    email: c.email,
    cpf: c.cpf,
    data_nascimento: c.data_nascimento,
    convenio: c.convenio,
    origem: 'drive',
    atendimentos: c.atendimentos?.length ?? 0,
  };
}

function enrichDriveOpcao(
  opcoes: PacienteOpcao[],
  driveId: string,
  patch: Partial<Pick<PacienteOpcao, 'telefone' | 'telefoneSugerido' | 'email' | 'data_nascimento'>>,
): void {
  const idx = opcoes.findIndex((o) => o.id === `d:${driveId}`);
  if (idx < 0) return;
  const cur = opcoes[idx];
  const googleTel = patch.telefoneSugerido ?? patch.telefone;
  if (googleTel) {
    cur.telefoneSugerido = googleTel;
    if (!cur.telefone) cur.telefone = googleTel;
  }
  if (!cur.email && patch.email) cur.email = patch.email;
  if (!cur.data_nascimento && patch.data_nascimento) {
    cur.data_nascimento = patch.data_nascimento;
  }
}

function appendGoogleContactsFromImports(
  opcoes: PacienteOpcao[],
  seenPhones: Set<string>,
  imports: GoogleContactImport[],
  q: string,
  store: Awaited<ReturnType<typeof loadClientesStore>> | null,
) {
  for (const contact of imports) {
    const tel = contact.telefone ? aplicarMascaraWhatsapp(contact.telefone) : null;
    const pd = phoneDigits(tel);
    const nome = contact.nome?.trim();
    if (!nome) continue;

    if (q) {
      const hay = `${nome} ${tel ?? ''} ${contact.email ?? ''}`;
      if (!clienteMatchesQuery(hay, q)) continue;
    }

    const gid = googleOpcaoIdFromContact(contact);
    if (opcoes.some((o) => o.id === gid)) continue;

    if (pd && seenPhones.has(pd)) continue;

    if (store) {
      const existente =
        findClienteByContato(store, {
          telefone: contact.telefone,
          email: contact.email,
        }) ?? findClienteByNome(store, nome);

      if (existente) {
        enrichDriveOpcao(opcoes, existente.id, {
          telefone: tel,
          telefoneSugerido: tel,
          email: contact.email,
          data_nascimento: contact.data_nascimento,
        });
        if (!opcoes.some((o) => o.id === `d:${existente.id}`)) {
          const merged = mapDrive(existente);
          if (!merged.telefone && tel) {
            merged.telefone = tel;
            merged.telefoneSugerido = tel;
          }
          if (!merged.email && contact.email) merged.email = contact.email;
          if (!merged.data_nascimento && contact.data_nascimento) {
            merged.data_nascimento = contact.data_nascimento;
          }
          opcoes.push(merged);
        }
      }
    }

    if (pd) seenPhones.add(pd);
    opcoes.push({
      id: gid,
      nome,
      telefone: tel,
      email: contact.email,
      cpf: null,
      data_nascimento: contact.data_nascimento,
      convenio: null,
      origem: 'google',
    });
  }
}

export async function GET(req: NextRequest) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const q = req.nextUrl.searchParams.get('q')?.trim().toLowerCase() ?? '';
  const includeGoogleParam = req.nextUrl.searchParams.get('includeGoogle');
  const includeGoogle =
    includeGoogleParam === '1' || includeGoogleParam === 'true';
  const limitRaw = req.nextUrl.searchParams.get('limit');
  const limit = limitRaw
    ? Math.min(Math.max(parseInt(limitRaw, 10) || 0, 1), 500)
    : undefined;

  const opcoes: PacienteOpcao[] = [];
  const seenPhones = new Set<string>();
  let driveConectado = false;
  let aviso: string | null = null;

  const contactsToken = await requireGoogleContactsToken(req);
  const googleContatosDisponivel = !isContactsError(contactsToken);

  let googleImports: GoogleContactImport[] = [];
  if (includeGoogle && googleContatosDisponivel) {
    try {
      const cached = await getGoogleContactsCached(email, contactsToken);
      googleImports = cached.contacts;
      if (cached.quotaExceeded && cached.error) {
        aviso = cached.error;
      }
    } catch {
      aviso =
        aviso ??
        'Não foi possível carregar Contatos Google — mostrando apenas clientes do Drive.';
    }
  }

  const driveToken = await requireGoogleAccessToken(req);
  if (isDriveError(driveToken)) {
    const errBody = await driveToken.json().catch(() => ({}));
    aviso =
      aviso ??
      (errBody as { error?: string }).error ??
      'Conecte o Google Drive no Dashboard para ver clientes cadastrados.';
  } else {
    driveConectado = true;
    const store = await loadClientesStore(driveToken, email);
    const driveList = filterClientes(store, q || undefined);
    for (const c of driveList) {
      opcoes.push(mapDrive(c));
      const pd = phoneDigits(c.telefone);
      if (pd) seenPhones.add(pd);
    }

    if (includeGoogle && googleContatosDisponivel && googleImports.length > 0) {
      appendGoogleContactsFromImports(opcoes, seenPhones, googleImports, q, store);
    }
  }

  if (
    includeGoogle &&
    !driveConectado &&
    googleContatosDisponivel &&
    googleImports.length > 0
  ) {
    appendGoogleContactsFromImports(opcoes, seenPhones, googleImports, q, null);
  }

  const opcoesEnriquecidas = (includeGoogle ? enrichOpcoesComGoogle(opcoes) : opcoes).sort(
    (a, b) => {
    if (q) {
      const sa = scoreClienteMatch(`${a.nome} ${a.telefone ?? ''} ${a.email ?? ''}`, q);
      const sb = scoreClienteMatch(`${b.nome} ${b.telefone ?? ''} ${b.email ?? ''}`, q);
      if (sb !== sa) return sb - sa;
    }
    return a.nome.localeCompare(b.nome, 'pt-BR');
    },
  );

  const opcoesFinal = limit ? opcoesEnriquecidas.slice(0, limit) : opcoesEnriquecidas;
  const total = opcoesEnriquecidas.length;

  const maxAgeSec = Math.floor(GOOGLE_CONTACTS_CACHE_TTL_MS / 1000);

  return NextResponse.json(
    {
      opcoes: opcoesFinal,
      total,
      google_contatos_disponivel: googleContatosDisponivel,
      drive_conectado: driveConectado,
      aviso,
    },
    {
      headers: {
        'Cache-Control': `private, max-age=${maxAgeSec}`,
      },
    },
  );
}
