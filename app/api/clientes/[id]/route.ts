import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { requireGoogleAccessToken, isDriveError } from '@/lib/driveAuth';
import {
  appendAnamneseToCliente,
  findCliente,
  findExistingClienteByPhoneOrEmail,
  loadClientesStore,
  saveClientesStore,
} from '@/lib/clientesDrive';
import { upsertPacienteIndex } from '@/lib/agendamento';
import { mergeAnamneseRespostas, parseAnamneseFromBody } from '@/lib/anamnese';
import { enrichClienteDetalhe } from '@/lib/clienteFicha';
import { normalizarTelefoneCadastro } from '@/lib/phoneMatch';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;
  const { id } = await params;

  const tokenResult = await requireGoogleAccessToken(req);
  if (isDriveError(tokenResult)) return tokenResult;

  const store = await loadClientesStore(tokenResult, email);
  const cliente = findCliente(store, id);
  if (!cliente) {
    return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
  }

  const detalhe = await enrichClienteDetalhe(email, cliente);
  return NextResponse.json({ cliente: detalhe, storage: 'google_drive' });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;
  const { id } = await params;

  const tokenResult = await requireGoogleAccessToken(req);
  if (isDriveError(tokenResult)) return tokenResult;

  const store = await loadClientesStore(tokenResult, email);
  const cliente = findCliente(store, id);
  if (!cliente) {
    return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
  }

  const body = await req.json();
  const nome = body.nome !== undefined ? String(body.nome).trim() : cliente.nome;
  if (!nome || nome.length < 2) {
    return NextResponse.json({ error: 'Nome inválido' }, { status: 400 });
  }

  const telefoneNorm =
    body.telefone !== undefined
      ? normalizarTelefoneCadastro(body.telefone != null ? String(body.telefone) : null)
      : cliente.telefone;
  const emailNorm =
    body.email !== undefined
      ? body.email?.trim() || null
      : cliente.email?.trim() || null;
  const cpfNorm =
    body.cpf !== undefined ? body.cpf?.trim() || null : cliente.cpf?.trim() || null;

  const duplicata = findExistingClienteByPhoneOrEmail(store, {
    nome,
    telefone: telefoneNorm,
    email: emailNorm,
    cpf: cpfNorm,
  });
  if (duplicata && duplicata.id !== cliente.id) {
    return NextResponse.json(
      {
        error: `Já existe outro cliente cadastrado (${duplicata.nome}). Use Unificar clientes se for a mesma pessoa.`,
      },
      { status: 409 },
    );
  }

  cliente.nome = nome;
  if (body.email !== undefined) cliente.email = emailNorm;
  if (body.telefone !== undefined) cliente.telefone = telefoneNorm;
  if (body.cpf !== undefined) cliente.cpf = cpfNorm;
  if (body.data_nascimento !== undefined) cliente.data_nascimento = body.data_nascimento || null;
  if (body.convenio !== undefined) cliente.convenio = body.convenio?.trim() || null;
  if (body.observacoes_gerais !== undefined) {
    cliente.observacoes_gerais = body.observacoes_gerais?.trim() || null;
  }

  try {
    const anamnese = await parseAnamneseFromBody(email, body, { skipRequired: true });
    if (anamnese) {
      cliente.anamnese_respostas = mergeAnamneseRespostas(
        cliente.anamnese_respostas,
        anamnese.respostas,
      );
      appendAnamneseToCliente(cliente, anamnese.campos, anamnese.respostas, 'atualização cadastro');
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Anamnese inválida';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  cliente.updated_at = new Date().toISOString();

  await saveClientesStore(tokenResult, store);

  if (cliente.telefone) {
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

  const detalhe = await enrichClienteDetalhe(email, cliente);
  return NextResponse.json({ cliente: detalhe, storage: 'google_drive' });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;
  const { id } = await params;

  const tokenResult = await requireGoogleAccessToken(req);
  if (isDriveError(tokenResult)) return tokenResult;

  const store = await loadClientesStore(tokenResult, email);
  const idx = store.clientes.findIndex((c) => c.id === id);
  if (idx < 0) {
    return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
  }

  store.clientes.splice(idx, 1);
  await saveClientesStore(tokenResult, store);
  return NextResponse.json({ success: true });
}
