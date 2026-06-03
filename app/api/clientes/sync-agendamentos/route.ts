import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { requireGoogleAccessToken, isDriveError } from '@/lib/driveAuth';
import {
  createClienteRecord,
  findCliente,
  findClienteByContato,
  loadClientesStore,
  saveClientesStore,
  addAtendimento,
} from '@/lib/clientesDrive';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { upsertPacienteIndex } from '@/lib/agendamento';

export async function POST(req: NextRequest) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const tokenResult = await requireGoogleAccessToken(req);
  if (isDriveError(tokenResult)) return tokenResult;

  const { data: pendentes, error } = await supabaseAdmin
    .from('agendamentos_pendentes_drive')
    .select('*')
    .eq('owner_email', email.toLowerCase().trim())
    .eq('sincronizado', false)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const store = await loadClientesStore(tokenResult, email);
  let count = 0;

  for (const row of pendentes ?? []) {
    const dados = row.dados as Record<string, unknown>;
    let cliente = row.cliente_drive_id
      ? findCliente(store, row.cliente_drive_id)
      : findClienteByContato(store, {
          telefone: dados.telefone ? String(dados.telefone) : null,
          cpf: dados.cpf ? String(dados.cpf) : null,
          email: dados.email ? String(dados.email) : null,
        });

    if (!cliente) {
      cliente = createClienteRecord(dados);
      store.clientes.push(cliente);
    } else {
      if (dados.nome) cliente.nome = String(dados.nome);
      if (dados.telefone) cliente.telefone = String(dados.telefone);
      if (dados.convenio) cliente.convenio = String(dados.convenio);
      cliente.updated_at = new Date().toISOString();
    }

    const { data: consulta } = await supabaseAdmin
      .from('consultas_agenda')
      .select('inicio, fim, medico, servico')
      .eq('id', row.consulta_id)
      .maybeSingle();

    if (consulta) {
      const inicio = new Date(consulta.inicio);
      addAtendimento(cliente, {
        data: inicio.toISOString().slice(0, 10),
        hora: inicio.toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'America/Sao_Paulo',
        }),
        tipo: String(dados.tipo) === 'retorno' ? 'retorno' : 'consulta',
        medico: consulta.medico,
        status: 'agendado',
      });
    }

    await upsertPacienteIndex({
      ownerEmail: email,
      telefone: String(dados.telefone),
      nome: cliente.nome,
      clienteDriveId: cliente.id,
      cpf: dados.cpf ? String(dados.cpf) : null,
      convenio: cliente.convenio,
    });

    await supabaseAdmin
      .from('consultas_agenda')
      .update({ cliente_drive_id: cliente.id })
      .eq('id', row.consulta_id);

    await supabaseAdmin
      .from('agendamentos_pendentes_drive')
      .update({ sincronizado: true, cliente_drive_id: cliente.id })
      .eq('id', row.id);

    count++;
  }

  if (count > 0) {
    await saveClientesStore(tokenResult, store);
  }

  return NextResponse.json({ sincronizados: count });
}
