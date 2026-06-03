import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { requireGoogleAccessToken, isDriveError } from '@/lib/driveAuth';
import {
  addAtendimento,
  findCliente,
  loadClientesStore,
  saveClientesStore,
} from '@/lib/clientesDrive';
import { STATUS_ATENDIMENTO } from '@/lib/constants';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;
  const { id: clienteId } = await params;

  const tokenResult = await requireGoogleAccessToken(req);
  if (isDriveError(tokenResult)) return tokenResult;

  const body = await req.json();
  if (!body.data) {
    return NextResponse.json({ error: 'Data do atendimento é obrigatória' }, { status: 400 });
  }
  const status = body.status ?? 'realizado';
  if (!STATUS_ATENDIMENTO.includes(status)) {
    return NextResponse.json({ error: 'Status inválido' }, { status: 400 });
  }

  const store = await loadClientesStore(tokenResult, email);
  const cliente = findCliente(store, clienteId);
  if (!cliente) {
    return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
  }

  const atendimento = addAtendimento(cliente, body);
  await saveClientesStore(tokenResult, store);
  return NextResponse.json({ atendimento }, { status: 201 });
}
