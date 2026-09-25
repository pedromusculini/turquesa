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
import { normalizeCatalogoItensBody } from '@/lib/atendimentoItens';
import {
  baixarEstoqueAtendimento,
  estoqueErrorResponse,
  restaurarEstoqueAtendimento,
} from '@/lib/catalogoEstoque';
import {
  FORMA_PAGAMENTO_PACOTE,
  formatPacoteResumo,
  pacoteDisponivel,
  usarSessaoPacote,
} from '@/lib/clientePacotes';
import { buildPacoteSessaoMensagem, type MensagemPronta } from '@/lib/mensagensProntas';
import type { ClientePacote } from '@/lib/types';

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
    return NextResponse.json({ error: 'Data do atendimento é obrigatória' }, { status: 400 });
  }
  const pacoteId = body.pacote_id ? String(body.pacote_id) : null;
  if (pacoteId) {
    body.forma_pagamento = FORMA_PAGAMENTO_PACOTE;
    body.valor = 0;
    body.valorOriginal = 0;
    body.descontoPercent = 0;
    body.descontoValor = 0;
    body.parcelas = 1;
  }
  if (body.valor == null || Number(body.valor) < 0) {
    return NextResponse.json({ error: 'Valor inválido' }, { status: 400 });
  }
  if (!pacoteId && (!body.forma_pagamento || !FORMAS_VALIDAS.has(body.forma_pagamento))) {
    return NextResponse.json({ error: 'Forma de pagamento inválida' }, { status: 400 });
  }

  const store = await loadClientesStore(tokenResult, email);
  const cliente = findCliente(store, clienteId);
  if (!cliente) {
    return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
  }
  if (pacoteId) {
    const pacote = (cliente.pacotes ?? []).find((p) => p.id === pacoteId);
    if (!pacote || !pacoteDisponivel(pacote)) {
      return NextResponse.json(
        { error: 'Pacote sem sessões disponíveis (acabou, venceu ou foi cancelado)' },
        { status: 400 },
      );
    }
  }

  const catalogoItens = normalizeCatalogoItensBody(body.catalogo_itens);

  try {
    await baixarEstoqueAtendimento(email, catalogoItens);
  } catch (err) {
    const estoqueErr = estoqueErrorResponse(err);
    if (estoqueErr) {
      return NextResponse.json({ error: estoqueErr.message }, { status: estoqueErr.status });
    }
    console.error('[clientes/finalizar] estoque', err);
    return NextResponse.json({ error: 'Erro ao atualizar estoque' }, { status: 500 });
  }

  let atendimento;
  let pagamento;
  let tipo: 'consulta' | 'retorno';
  let pacoteUsado: ClientePacote | null = null;
  try {
    ({ atendimento, pagamento, tipo } = finalizarAtendimentoNoCliente(cliente, {
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
      catalogoItens,
    }));

    if (pacoteId) {
      const { pacote } = usarSessaoPacote(cliente, pacoteId, {
        atendimento_id: atendimento.id,
        data: body.data,
        medico: body.medico || null,
      });
      pacoteUsado = pacote;
      pagamento.observacao = [pagamento.observacao, formatPacoteResumo(pacote)]
        .filter(Boolean)
        .join(' · ');
    }

    await saveClientesStore(tokenResult, store);
  } catch (err) {
    try {
      await restaurarEstoqueAtendimento(email, catalogoItens);
    } catch (rollbackErr) {
      console.error('[clientes/finalizar] rollback estoque', rollbackErr);
    }
    const message = err instanceof Error ? err.message : 'Erro ao finalizar atendimento';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  let pacoteWhatsapp: MensagemPronta | null = null;
  if (pacoteUsado) {
    try {
      pacoteWhatsapp = await buildPacoteSessaoMensagem({
        ownerEmail: email,
        cliente,
        pacote: pacoteUsado,
        dataSessao: body.data,
      });
    } catch (err) {
      console.warn('[clientes/finalizar] mensagem pacote', err);
    }
  }

  return NextResponse.json(
    {
      atendimento,
      pagamento,
      tipo,
      pacote_resumo: pacoteUsado ? formatPacoteResumo(pacoteUsado) : null,
      pacote_whatsapp: pacoteWhatsapp,
      message: 'Atendimento finalizado com sucesso',
    },
    { status: 201 },
  );
}
