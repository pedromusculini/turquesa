import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { requireGoogleAccessToken, isDriveError } from '@/lib/driveAuth';
import {
  appendAnamneseToCliente,
  finalizarAtendimentoNoCliente,
  findCliente,
  loadClientesStore,
  saveClientesStore,
} from '@/lib/clientesDrive';
import { parseAnamneseFromBody } from '@/lib/anamnese';
import { FORMAS_PAGAMENTO_ATENDIMENTO } from '@/lib/atendimentoFinalizar';
import { isValidPhone, normalizePhoneForWhatsApp } from '@/lib/phoneMatch';
import { registrarConsultaParaLembrete } from '@/lib/registrarConsultaLembrete';
import { resolveOrCreatePacienteCliente } from '@/lib/resolvePacienteCliente';
import {
  percentualProfissionalPadrao,
  registrarEntradaFinanceira,
} from '@/lib/registrarEntradaFinanceira';
import { formatItensResumo, normalizeCatalogoItensBody } from '@/lib/atendimentoItens';
import {
  baixarEstoqueAtendimento,
  estoqueErrorResponse,
  restaurarEstoqueAtendimento,
} from '@/lib/catalogoEstoque';

const FORMAS_VALIDAS = new Set(FORMAS_PAGAMENTO_ATENDIMENTO.map((f) => f.id));

export async function POST(req: NextRequest) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const tokenResult = await requireGoogleAccessToken(req);
  if (isDriveError(tokenResult)) return tokenResult;

  const body = await req.json();

  if (!body.data) {
    return NextResponse.json({ error: 'Data do atendimento é obrigatória' }, { status: 400 });
  }
  if (!body.hora) {
    return NextResponse.json({ error: 'Hora do atendimento é obrigatória' }, { status: 400 });
  }
  if (!body.medico || !String(body.medico).trim()) {
    return NextResponse.json({ error: 'Profissional é obrigatório' }, { status: 400 });
  }
  if (!body.forma_pagamento || !FORMAS_VALIDAS.has(body.forma_pagamento)) {
    return NextResponse.json({ error: 'Forma de pagamento inválida' }, { status: 400 });
  }

  const telefoneRaw = String(body.telefone ?? '').trim();
  if (!telefoneRaw || !isValidPhone(telefoneRaw)) {
    return NextResponse.json(
      { error: 'Informe o WhatsApp do cliente (BR com DDD ou internacional com +)' },
      { status: 400 },
    );
  }
  const telefoneNorm = normalizePhoneForWhatsApp(telefoneRaw);

  const valorOriginal = Number(body.valorOriginal ?? body.valor ?? 0);
  if (body.forma_pagamento !== 'permuta' && valorOriginal <= 0) {
    return NextResponse.json({ error: 'Informe o valor do atendimento' }, { status: 400 });
  }

  let cliente;
  try {
    cliente = await resolveOrCreatePacienteCliente(tokenResult, email, {
      nome: body.nome,
      telefone: telefoneNorm,
      cliente_id: body.cliente_id,
      paciente_sel: body.paciente_sel,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao resolver cliente';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const store = await loadClientesStore(tokenResult, email);
  const clienteRef = findCliente(store, cliente.id) ?? cliente;

  try {
    const anamnese = await parseAnamneseFromBody(email, body, { skipRequired: true });
    if (anamnese) {
      appendAnamneseToCliente(clienteRef, anamnese.campos, anamnese.respostas, 'atendimento avulso');
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Anamnese inválida';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const catalogoItens = normalizeCatalogoItensBody(body.catalogo_itens);

  try {
    await baixarEstoqueAtendimento(email, catalogoItens);
  } catch (err) {
    const estoqueErr = estoqueErrorResponse(err);
    if (estoqueErr) {
      return NextResponse.json({ error: estoqueErr.message }, { status: estoqueErr.status });
    }
    console.error('[atendimento-avulso] estoque', err);
    return NextResponse.json({ error: 'Erro ao atualizar estoque' }, { status: 500 });
  }

  let atendimento;
  let pagamento;
  let tipo: 'consulta' | 'retorno';
  try {
    ({ atendimento, pagamento, tipo } = finalizarAtendimentoNoCliente(clienteRef, {
      data: body.data,
      hora: body.hora || null,
      valor: valorOriginal,
      valorOriginal,
      descontoPercent: Number(body.descontoPercent) || 0,
      descontoValor: Number(body.descontoValor) || 0,
      forma_pagamento: body.forma_pagamento,
      medico: body.medico || null,
      parcelas: Math.max(1, Number(body.parcelas) || 1),
      tipo: body.tipo || null,
      observacoes: body.observacoes || null,
      catalogoItens,
    }));

    await saveClientesStore(tokenResult, store);
  } catch (err) {
    try {
      await restaurarEstoqueAtendimento(email, catalogoItens);
    } catch (rollbackErr) {
      console.error('[atendimento-avulso] rollback estoque', rollbackErr);
    }
    const message = err instanceof Error ? err.message : 'Erro ao finalizar atendimento';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const lembretesOn = body.lembretes_whatsapp !== false;
  if (lembretesOn) {
    try {
      await registrarConsultaParaLembrete({
        ownerEmail: email,
        consultaId: `avulso-${atendimento.id}`,
        paciente: clienteRef.nome,
        telefone: telefoneNorm,
        data: body.data,
        hora: body.hora || null,
        medico: body.medico || null,
        clienteDriveId: clienteRef.id,
        lembretesWhatsapp: true,
      });
    } catch (err) {
      console.error('[atendimento-avulso] lembrete consulta', err);
    }
  }

  try {
    const formaLabel =
      FORMAS_PAGAMENTO_ATENDIMENTO.find((f) => f.id === body.forma_pagamento)?.label ??
      body.forma_pagamento;
    const medicoNome = String(body.medico).trim();
    let pct = Number(body.percentual_profissional);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      pct = await percentualProfissionalPadrao(email, medicoNome);
    }
    const itensResumo = formatItensResumo(catalogoItens);
    const obsAtendimento = String(body.observacoes ?? '').trim();
    const financeiroObs = [itensResumo, obsAtendimento, formaLabel].filter(Boolean).join(' · ');

    await registrarEntradaFinanceira({
      ownerEmail: email,
      descricao: [
        'Atendimento',
        itensResumo || null,
        clienteRef.nome,
      ]
        .filter(Boolean)
        .join(' — '),
      data: body.data,
      valorBruto: pagamento.valor,
      categoria: 'consulta',
      medico: medicoNome,
      observacao: financeiroObs,
      formaPagamento: body.forma_pagamento,
      parcelas: Math.max(1, Number(body.parcelas) || 1),
      percentualProfissional: pct,
      catalogoItens,
    });
  } catch (err) {
    console.warn('[atendimento-avulso] financeiro', err);
  }

  const { atendimentos, observacoes, pagamentos, ...clienteResumo } = clienteRef;

  return NextResponse.json(
    {
      cliente: clienteResumo,
      atendimento,
      pagamento,
      tipo,
      criadoSemCadastro: !body.cliente_id && !body.paciente_sel?.startsWith('d:'),
      lembrete_registrado: lembretesOn,
      message: 'Atendimento finalizado com sucesso',
    },
    { status: 201 },
  );
}
