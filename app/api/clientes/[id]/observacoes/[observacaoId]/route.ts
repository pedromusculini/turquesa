import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { requireGoogleAccessToken, isDriveError } from '@/lib/driveAuth';
import { findCliente, loadClientesStore, saveClientesStore } from '@/lib/clientesDrive';

type Params = { params: Promise<{ id: string; observacaoId: string }> };

export async function DELETE(req: NextRequest, { params }: Params) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;
  const { id: clienteId, observacaoId } = await params;

  const tokenResult = await requireGoogleAccessToken(req);
  if (isDriveError(tokenResult)) return tokenResult;

  const store = await loadClientesStore(tokenResult, email);
  const cliente = findCliente(store, clienteId);
  if (!cliente) {
    return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
  }

  cliente.observacoes = cliente.observacoes.filter((o) => o.id !== observacaoId);
  await saveClientesStore(tokenResult, store);
  return NextResponse.json({ success: true });
}
