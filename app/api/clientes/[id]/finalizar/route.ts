import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { requireGoogleAccessToken, isDriveError } from '@/lib/driveAuth';
import {
  finalizarAtendimentoNoCliente,
  findCliente,
  loadClientesStore,
  saveClientesStore,
} from '@/lib/clientesDrive';
import { FORMAS_PAGAMENTO_ATENDIMENTO } from '@/lib/atendimentoFinalizar';

const FORMAS_VALIDAS = new Set(FORMAS_PAGAMENTO_ATENDIMENTO.map((f) => f.id));

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;
  const { id: clienteId } = await params;

  const tokenResult = await requireGoogleAccessToken(req);
  if (isDriveError(tokenResult)) return tokenResult;

  const body = await req.json();

  // Validações básicas
  if (!body.data) {
    return NextResponse.json({ error: 'Data da consulta é obrigatória' }, { status: 400 });
  }
  if (body.valor == null || Number(body.valor) < 0) {
    return NextResponse.json({ error: 'Valor inválido' }, { status: 400 });
  }
  if (!body.forma_pagamento || !FORMAS_VALIDAS.has(body.forma_pagamento)) {
    return NextResponse.json({ error: 'Forma de pagamento inválida' }, { status: 400 });
  }

  const store = await loadClientesStore(tokenResult, email);
  const cliente = findCliente(store, clienteId);
  if (!cliente) {
    return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
  }

  const { atendimento, pagamento, tipo } = finalizarAtendimentoNoCliente(cliente, {
    data: body.data,
    hora: body.hora || null,
    valor: Number(body.valorOriginal ?? body.valor),
    valorOriginal: Number(body.valorOriginal ?? body.valor),
    descontoPercent: Number(body.descontoPercent) || 0,
    descontoValor: Number(body.descontoValor) || Number(body.desconto) || 0,
    forma_pagamento: body.forma_pagamento,
    plano: body.plano || null,
    medico: body.medico || null,
    parcelas: Math.max(1, Number(body.parcelas) || 1),
    tipo: body.tipo || null,
    observacoes: body.observacoes || null,
  });

  await saveClientesStore(tokenResult, store);

  return NextResponse.json(
    {
      atendimento,
      pagamento,
      tipo,
      message:
        tipo === 'retorno'
          ? 'Consulta finalizada como RETORNO (paciente retornou em menos de 30 dias)'
          : 'Consulta finalizada com sucesso',
    },
    { status: 201 },
  );
}
