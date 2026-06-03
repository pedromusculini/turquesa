import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { requireGoogleAccessToken, isDriveError } from '@/lib/driveAuth';
import {
  addObservacao,
  findCliente,
  loadClientesStore,
  saveClientesStore,
} from '@/lib/clientesDrive';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;
  const { id: clienteId } = await params;

  const tokenResult = await requireGoogleAccessToken(req);
  if (isDriveError(tokenResult)) return tokenResult;

  const body = await req.json();
  const texto = String(body.texto ?? '').trim();
  if (!texto) {
    return NextResponse.json({ error: 'Texto da observação é obrigatório' }, { status: 400 });
  }

  const store = await loadClientesStore(tokenResult, email);
  const cliente = findCliente(store, clienteId);
  if (!cliente) {
    return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
  }

  const observacao = addObservacao(cliente, texto, body.autor?.trim() || email);
  await saveClientesStore(tokenResult, store);
  return NextResponse.json({ observacao }, { status: 201 });
}
