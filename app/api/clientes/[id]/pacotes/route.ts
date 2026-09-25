import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { requireGoogleAccessToken, isDriveError } from '@/lib/driveAuth';
import { findCliente, loadClientesStore, saveClientesStore } from '@/lib/clientesDrive';
import { resolveMergedPrimaryId } from '@/lib/clientesGoogleSync';
import { FORMAS_PAGAMENTO_ATENDIMENTO } from '@/lib/atendimentoFinalizar';
import { criarPacote, validarCriarPacote } from '@/lib/clientePacotes';
import {
  percentualProfissionalPadrao,
  registrarEntradaFinanceira,
} from '@/lib/registrarEntradaFinanceira';

type Params = { params: Promise<{ id: string }> };

const FORMAS_VALIDAS = new Set<string>(FORMAS_PAGAMENTO_ATENDIMENTO.map((f) => f.id));

export async function GET(req: NextRequest, { params }: Params) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;
  const { id } = await params;

  const tokenResult = await requireGoogleAccessToken(req);
  if (isDriveError(tokenResult)) return tokenResult;

  const store = await loadClientesStore(tokenResult, email);
  const cliente = findCliente(store, resolveMergedPrimaryId(store, id));
  if (!cliente) {
    return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
  }
  return NextResponse.json({ pacotes: cliente.pacotes ?? [] });
}

export async function POST(req: NextRequest, { params }: Params) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;
  const { id } = await params;

  const tokenResult = await requireGoogleAccessToken(req);
  if (isDriveError(tokenResult)) return tokenResult;

  const body = (await req.json()) as Record<string, unknown>;
  const input = validarCriarPacote(body);
  if (typeof input === 'string') {
    return NextResponse.json({ error: input }, { status: 400 });
  }
  if (!FORMAS_VALIDAS.has(input.forma_pagamento)) {
    return NextResponse.json({ error: 'Forma de pagamento inválida' }, { status: 400 });
  }

  const store = await loadClientesStore(tokenResult, email);
  const cliente = findCliente(store, resolveMergedPrimaryId(store, id));
  if (!cliente) {
    return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
  }

  const pacote = criarPacote(cliente, input);
  cliente.updated_at = new Date().toISOString();
  await saveClientesStore(tokenResult, store);

  let financeiroOk = true;
  if (input.valor_total > 0) {
    try {
      const medicoNome = input.medico || 'Salão';
      let pct = Number(body.percentual_profissional);
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
        pct = input.medico ? await percentualProfissionalPadrao(email, medicoNome) : 0;
      }
      const formaLabel =
        FORMAS_PAGAMENTO_ATENDIMENTO.find((f) => f.id === input.forma_pagamento)?.label ??
        input.forma_pagamento;
      await registrarEntradaFinanceira({
        ownerEmail: email,
        descricao: `Pacote ${input.nome} (${input.sessoes_total} sessões) — ${cliente.nome}`,
        data: pacote.data_venda,
        valorBruto: input.valor_total,
        categoria: 'pacote',
        medico: medicoNome,
        observacao: [input.observacao, formaLabel].filter(Boolean).join(' · '),
        formaPagamento: input.forma_pagamento,
        parcelas: input.parcelas ?? 1,
        percentualProfissional: pct,
      });
    } catch (err) {
      financeiroOk = false;
      console.warn('[clientes/pacotes] financeiro', err);
    }
  }

  return NextResponse.json({ pacote, financeiro_registrado: financeiroOk }, { status: 201 });
}
