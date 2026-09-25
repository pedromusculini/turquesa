import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { requireGoogleAccessToken, isDriveError } from '@/lib/driveAuth';
import { findCliente, loadClientesStore, saveClientesStore } from '@/lib/clientesDrive';
import { resolveMergedPrimaryId } from '@/lib/clientesGoogleSync';
import { cancelarPacote, estornarUsoPacote, PacoteError } from '@/lib/clientePacotes';
import { buildPacoteSessaoMensagem } from '@/lib/mensagensProntas';

type Params = { params: Promise<{ id: string; pacoteId: string }> };

/** GET — mensagem de controle de sessões (WhatsApp) com o estado atual do pacote. */
export async function GET(req: NextRequest, { params }: Params) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;
  const { id, pacoteId } = await params;

  const tokenResult = await requireGoogleAccessToken(req);
  if (isDriveError(tokenResult)) return tokenResult;

  const store = await loadClientesStore(tokenResult, email);
  const cliente = findCliente(store, resolveMergedPrimaryId(store, id));
  const pacote = cliente?.pacotes?.find((p) => p.id === pacoteId);
  if (!cliente || !pacote) {
    return NextResponse.json({ error: 'Pacote não encontrado' }, { status: 404 });
  }
  if (pacote.usos.length === 0) {
    return NextResponse.json(
      { error: 'Nenhuma sessão feita ainda neste pacote' },
      { status: 400 },
    );
  }
  const pronta = await buildPacoteSessaoMensagem({ ownerEmail: email, cliente, pacote });
  return NextResponse.json(pronta);
}

/** Body: { acao: 'cancelar' } | { acao: 'estornar_uso', uso_id } */
export async function PATCH(req: NextRequest, { params }: Params) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;
  const { id, pacoteId } = await params;

  const tokenResult = await requireGoogleAccessToken(req);
  if (isDriveError(tokenResult)) return tokenResult;

  const body = (await req.json()) as { acao?: string; uso_id?: string };
  const store = await loadClientesStore(tokenResult, email);
  const cliente = findCliente(store, resolveMergedPrimaryId(store, id));
  if (!cliente) {
    return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
  }

  try {
    let pacote;
    if (body.acao === 'cancelar') {
      pacote = cancelarPacote(cliente, pacoteId);
    } else if (body.acao === 'estornar_uso' && body.uso_id) {
      pacote = estornarUsoPacote(cliente, pacoteId, body.uso_id);
    } else {
      return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
    }
    cliente.updated_at = new Date().toISOString();
    await saveClientesStore(tokenResult, store);
    return NextResponse.json({ pacote });
  } catch (err) {
    if (err instanceof PacoteError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
