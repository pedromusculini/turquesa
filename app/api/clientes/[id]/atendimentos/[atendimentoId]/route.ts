import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { requireGoogleAccessToken, isDriveError } from '@/lib/driveAuth';
import {
  findCliente,
  loadClientesStore,
  saveClientesStore,
  updateAtendimento,
} from '@/lib/clientesDrive';
import { STATUS_ATENDIMENTO } from '@/lib/constants';
import type { ClienteStatusAtendimento } from '@/lib/types';
import { FORMAS_PAGAMENTO_ATENDIMENTO } from '@/lib/atendimentoFinalizar';

type Params = { params: Promise<{ id: string; atendimentoId: string }> };

const FORMAS_VALIDAS = new Set(FORMAS_PAGAMENTO_ATENDIMENTO.map((f) => f.id));

export async function PUT(req: NextRequest, { params }: Params) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;
  const { id: clienteId, atendimentoId } = await params;

  const tokenResult = await requireGoogleAccessToken(req);
  if (isDriveError(tokenResult)) return tokenResult;

  const body = await req.json();

  if (body.data !== undefined && !body.data) {
    return NextResponse.json({ error: 'Data do atendimento é obrigatória' }, { status: 400 });
  }
  if (body.status && !STATUS_ATENDIMENTO.includes(body.status as ClienteStatusAtendimento)) {
    return NextResponse.json({ error: 'Status inválido' }, { status: 400 });
  }
  if (
    body.forma_pagamento &&
    !(FORMAS_VALIDAS as Set<string>).has(String(body.forma_pagamento))
  ) {
    return NextResponse.json({ error: 'Forma de pagamento inválida' }, { status: 400 });
  }

  const store = await loadClientesStore(tokenResult, email);
  const cliente = findCliente(store, clienteId);
  if (!cliente) {
    return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
  }

  const atendimento = updateAtendimento(cliente, atendimentoId, body);
  if (!atendimento) {
    return NextResponse.json({ error: 'Atendimento não encontrado' }, { status: 404 });
  }

  await saveClientesStore(tokenResult, store);
  return NextResponse.json({ atendimento });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;
  const { id: clienteId, atendimentoId } = await params;

  const tokenResult = await requireGoogleAccessToken(req);
  if (isDriveError(tokenResult)) return tokenResult;

  const store = await loadClientesStore(tokenResult, email);
  const cliente = findCliente(store, clienteId);
  if (!cliente) {
    return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
  }

  cliente.atendimentos = cliente.atendimentos.filter((a) => a.id !== atendimentoId);
  await saveClientesStore(tokenResult, store);
  return NextResponse.json({ success: true });
}
