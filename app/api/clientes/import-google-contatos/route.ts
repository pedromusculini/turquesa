import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { requireGoogleAccessToken, isDriveError } from '@/lib/driveAuth';
import type { GoogleContactImport } from '@/lib/googleContacts';
import { loadClientesStore, saveClientesStore } from '@/lib/clientesDrive';
import { importGoogleContactsAsNew } from '@/lib/clientesGoogleSync';
import { upsertPacienteIndex } from '@/lib/agendamento';
import { normalizarTelefoneCadastro } from '@/lib/phoneMatch';

function parseContato(body: unknown): GoogleContactImport | null {
  if (!body || typeof body !== 'object') return null;
  const row = body as Record<string, unknown>;
  const nome = String(row.nome ?? '').trim();
  if (nome.length < 2) return null;
  const telefoneRaw = row.telefone != null ? String(row.telefone) : null;
  return {
    nome,
    email: row.email ? String(row.email).trim() : null,
    telefone: telefoneRaw ? normalizarTelefoneCadastro(telefoneRaw) : null,
    data_nascimento: row.data_nascimento ? String(row.data_nascimento) : null,
    googleResourceName: row.googleResourceName
      ? String(row.googleResourceName).trim()
      : '',
  };
}

/** Importa contatos Google selecionados como novos clientes (sem unificar automaticamente). */
export async function POST(req: NextRequest) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const tokenResult = await requireGoogleAccessToken(req);
  if (isDriveError(tokenResult)) return tokenResult;

  const body = await req.json();
  const rawList = Array.isArray(body.contatos) ? body.contatos : [];
  if (rawList.length === 0) {
    return NextResponse.json({ error: 'Nenhum contato para importar.' }, { status: 400 });
  }
  if (rawList.length > 50) {
    return NextResponse.json(
      { error: 'Importe no máximo 50 contatos por vez.' },
      { status: 400 },
    );
  }

  const contacts: GoogleContactImport[] = [];
  for (const raw of rawList) {
    const parsed = parseContato(raw);
    if (parsed) contacts.push(parsed);
  }
  if (contacts.length === 0) {
    return NextResponse.json({ error: 'Contatos inválidos.' }, { status: 400 });
  }

  const store = await loadClientesStore(tokenResult, email);
  const { criados, ignorados } = importGoogleContactsAsNew(store, contacts);

  if (criados.length > 0) {
    await saveClientesStore(tokenResult, store);
    for (const cliente of criados) {
      if (!cliente.telefone) continue;
      try {
        await upsertPacienteIndex({
          ownerEmail: email,
          telefone: cliente.telefone,
          nome: cliente.nome,
          clienteDriveId: cliente.id,
          cpf: cliente.cpf,
          convenio: cliente.convenio,
        });
      } catch {
        /* índice opcional */
      }
    }
  }

  return NextResponse.json({
    criados: criados.length,
    ignorados,
    clientes: criados,
    storage: 'google_drive',
  });
}
