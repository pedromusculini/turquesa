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
import { normalizeBrazilPhone } from '@/lib/whatsapp';
import { phoneDigits } from '@/lib/phoneMatch';
import { registrarConsultaParaLembrete } from '@/lib/registrarConsultaLembrete';
import { resolveOrCreatePacienteCliente } from '@/lib/resolvePacienteCliente';

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
  if (!body.plano || !String(body.plano).trim()) {
    return NextResponse.json({ error: 'Plano / convênio é obrigatório' }, { status: 400 });
  }
  if (!body.forma_pagamento || !FORMAS_VALIDAS.has(body.forma_pagamento)) {
    return NextResponse.json({ error: 'Forma de pagamento inválida' }, { status: 400 });
  }

  const telefoneRaw = String(body.telefone ?? '').trim();
  const telefoneNorm = telefoneRaw ? normalizeBrazilPhone(telefoneRaw) : '';
  if (!telefoneNorm || phoneDigits(telefoneNorm).length < 10) {
    return NextResponse.json(
      { error: 'Informe o WhatsApp do paciente com DDD (ex.: 11 99999-9999)' },
      { status: 400 },
    );
  }

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
    const message = err instanceof Error ? err.message : 'Erro ao resolver paciente';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const store = await loadClientesStore(tokenResult, email);
  const clienteRef = findCliente(store, cliente.id) ?? cliente;
  if (body.plano) clienteRef.convenio = String(body.plano).trim();

  const { atendimento, pagamento, tipo } = finalizarAtendimentoNoCliente(clienteRef, {
    data: body.data,
    hora: body.hora || null,
    valor: valorOriginal,
    valorOriginal,
    descontoPercent: Number(body.descontoPercent) || 0,
    descontoValor: Number(body.descontoValor) || 0,
    forma_pagamento: body.forma_pagamento,
    plano: body.plano || null,
    medico: body.medico || null,
    parcelas: Math.max(1, Number(body.parcelas) || 1),
    tipo: body.tipo || null,
    observacoes: body.observacoes || null,
  });

  await saveClientesStore(tokenResult, store);

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
        convenio: body.plano || null,
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
    await fetch(new URL('/api/financeiro', req.url).toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: req.headers.get('cookie') ?? '',
      },
      body: JSON.stringify({
        tipo: 'entrada',
        descricao: `${tipo === 'retorno' ? 'Retorno' : 'Consulta'} — ${clienteRef.nome}`,
        data: body.data,
        valor: pagamento.valor,
        categoria: 'consulta',
        medico: body.medico || null,
        observacao: `${formaLabel}${body.plano ? ` · ${body.plano}` : ''}`,
      }),
    });
  } catch {
    /* financeiro opcional */
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
      message:
        tipo === 'retorno'
          ? 'Atendimento finalizado como RETORNO (última consulta há menos de 30 dias)'
          : 'Atendimento finalizado com sucesso',
    },
    { status: 201 },
  );
}
