import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { requireGoogleAccessToken, isDriveError } from '@/lib/driveAuth';
import {
  appendAnamneseToCliente,
  createClienteRecord,
  findExistingClienteByPhoneOrEmail,
  loadClientesStore,
  paginateClientes,
  saveClientesStore,
} from '@/lib/clientesDrive';
import { findDuplicatePairs } from '@/lib/clientesUnificar';
import { upsertPacienteIndex } from '@/lib/agendamento';
import { parseAnamneseFromBody } from '@/lib/anamnese';
import { normalizarTelefoneCadastro } from '@/lib/phoneMatch';

export async function GET(req: NextRequest) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const tokenResult = await requireGoogleAccessToken(req);
  if (isDriveError(tokenResult)) return tokenResult;

  const params = new URL(req.url).searchParams;
  const q = params.get('q')?.trim() || undefined;
  const all = params.get('all') === '1';
  const comAtendimentos = params.get('com_atendimentos') === '1';
  const limit = Number(params.get('limit'));
  const offset = Number(params.get('offset'));
  const store = await loadClientesStore(tokenResult, email);
  const { clientes: page, total, hasMore } = paginateClientes(store, {
    q,
    all,
    comAtendimentos,
    limit: Number.isFinite(limit) ? limit : undefined,
    offset: Number.isFinite(offset) ? offset : undefined,
  });
  const clientes = page.map(({ atendimentos, observacoes, pagamentos, ...c }) => ({
    ...c,
    atendimentos_count: atendimentos.length,
  }));
  const duplicatas = q ? [] : findDuplicatePairs(store);

  return NextResponse.json({ clientes, total, hasMore, duplicatas, storage: 'google_drive' });
}

export async function POST(req: NextRequest) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const tokenResult = await requireGoogleAccessToken(req);
  if (isDriveError(tokenResult)) return tokenResult;

  const body = await req.json();
  const telefoneNorm = normalizarTelefoneCadastro(
    body.telefone != null ? String(body.telefone) : null,
  );
  const nome = String(body.nome ?? '').trim();
  if (!nome || nome.length < 2) {
    return NextResponse.json({ error: 'Nome é obrigatório (mín. 2 caracteres).' }, { status: 400 });
  }

  const store = await loadClientesStore(tokenResult, email);
  const existente = findExistingClienteByPhoneOrEmail(store, {
    nome,
    telefone: telefoneNorm,
    email: body.email ? String(body.email) : null,
    cpf: body.cpf ? String(body.cpf) : null,
  });

  let cliente = existente;
  let reutilizado = false;

  if (cliente) {
    reutilizado = true;
    if (telefoneNorm) cliente.telefone = telefoneNorm;
    if (body.email && !cliente.email) cliente.email = String(body.email).trim();
    if (body.cpf && !cliente.cpf) cliente.cpf = String(body.cpf).trim();
    if (body.data_nascimento && !cliente.data_nascimento) {
      cliente.data_nascimento = String(body.data_nascimento);
    }
    if (body.convenio && !cliente.convenio) cliente.convenio = String(body.convenio).trim();
    if (body.observacoes_gerais) {
      const prefix = cliente.observacoes_gerais ? `${cliente.observacoes_gerais}\n\n` : '';
      cliente.observacoes_gerais = `${prefix}${String(body.observacoes_gerais).trim()}`;
    }
    cliente.updated_at = new Date().toISOString();
  } else {
    cliente = createClienteRecord(body);
    cliente.telefone = telefoneNorm;
    store.clientes.push(cliente);
  }

  try {
    const anamnese = await parseAnamneseFromBody(email, body);
    if (anamnese) {
      appendAnamneseToCliente(cliente, anamnese.campos, anamnese.respostas, 'cadastro manual');
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Anamnese inválida';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  await saveClientesStore(tokenResult, store);

  if (cliente.telefone) {
    try {
      await upsertPacienteIndex({
        ownerEmail: email,
        telefone: cliente.telefone,
        nome: cliente.nome,
        clienteDriveId: cliente.id,
        cpf: cliente.cpf,
        convenio: cliente.convenio,
      });
    } catch {
      /* índice opcional — não bloqueia cadastro */
    }
  }

  return NextResponse.json(
    {
      cliente,
      reutilizado,
      aviso_duplicata: reutilizado
        ? { id: cliente.id, nome: cliente.nome, mensagem: 'Cliente existente atualizado em vez de criar duplicata.' }
        : null,
      storage: 'google_drive',
    },
    { status: reutilizado ? 200 : 201 },
  );
}
