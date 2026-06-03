import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { requireGoogleAccessToken, isDriveError } from '@/lib/driveAuth';
import {
  createClienteRecord,
  findCliente,
  findClienteByContato,
  loadClientesStore,
  mergeFormResponseIntoCliente,
  saveClientesStore,
} from '@/lib/clientesDrive';
import { supabaseAdmin } from '@/lib/supabaseClient';

/** Sincroniza respostas pendentes do Supabase → Google Drive */
export async function POST(req: NextRequest) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const tokenResult = await requireGoogleAccessToken(req);
  if (isDriveError(tokenResult)) return tokenResult;

  const { data: links } = await supabaseAdmin
    .from('formulario_links')
    .select('id, token, cliente_drive_id')
    .eq('owner_email', email);

  const tokens = (links ?? []).map((l) => l.token);
  if (tokens.length === 0) {
    return NextResponse.json({ sincronizados: 0 });
  }

  const { data: pendentes, error } = await supabaseAdmin
    .from('formulario_respostas')
    .select('*')
    .in('token', tokens)
    .eq('sincronizado_drive', false)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const store = await loadClientesStore(tokenResult, email);
  let count = 0;

  function findByContato(dados: Record<string, unknown>) {
    return findClienteByContato(store, {
      email: dados.email ? String(dados.email) : null,
      cpf: dados.cpf ? String(dados.cpf) : null,
      telefone: dados.telefone ? String(dados.telefone) : null,
    });
  }

  for (const resp of pendentes ?? []) {
    const link = links?.find((l) => l.token === resp.token);
    const dados = resp.dados as Record<string, unknown>;

    let cliente = link?.cliente_drive_id
      ? findCliente(store, link.cliente_drive_id)
      : findByContato(dados);

    if (!cliente) {
      cliente = createClienteRecord(dados);
      store.clientes.push(cliente);
    } else {
      mergeFormResponseIntoCliente(cliente, dados);
    }

    await supabaseAdmin.from('formulario_respostas').delete().eq('id', resp.id);

    count++;
  }

  if (count > 0) {
    await saveClientesStore(tokenResult, store);
  }

  return NextResponse.json({ sincronizados: count, storage: 'google_drive' });
}
