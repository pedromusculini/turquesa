import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { requireGoogleAccessToken, isDriveError } from '@/lib/driveAuth';
import {
  createClienteRecord,
  findCliente,
  findExistingClienteByPhoneOrEmail,
  loadClientesStore,
  mergeFormResponseIntoCliente,
  saveClientesStore,
} from '@/lib/clientesDrive';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { loadAnamneseCamposOwner } from '@/lib/anamnese';
import { loadServicosCatalogoMap } from '@/lib/clienteFicha';
import { upsertPacienteIndex } from '@/lib/agendamento';
import { ensureClienteFormularioLink } from '@/lib/formularioLinks';

export type ClienteImportadoResumo = {
  id: string;
  nome: string;
  telefone: string | null;
};

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
    return NextResponse.json({ sincronizados: 0, importados: [] as ClienteImportadoResumo[] });
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
  const anamneseCampos = await loadAnamneseCamposOwner(email);
  const servicosMap = await loadServicosCatalogoMap(email);
  let count = 0;
  const importados: ClienteImportadoResumo[] = [];
  const seenIds = new Set<string>();

  function findByContato(dados: Record<string, unknown>) {
    return findExistingClienteByPhoneOrEmail(store, {
      nome: dados.nome ? String(dados.nome) : null,
      email: dados.email ? String(dados.email) : null,
      cpf: dados.cpf ? String(dados.cpf) : null,
      telefone: dados.telefone ? String(dados.telefone) : null,
    });
  }

  function trackImportado(cliente: { id: string; nome: string; telefone: string | null }) {
    if (seenIds.has(cliente.id)) return;
    seenIds.add(cliente.id);
    importados.push({
      id: cliente.id,
      nome: cliente.nome,
      telefone: cliente.telefone,
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
      const servicoId = String(
        resp.servico_catalogo_id ?? dados.servico_catalogo_id ?? '',
      ).trim();
      mergeFormResponseIntoCliente(cliente, dados, {
        anamneseCampos,
        servicoNome: servicoId ? servicosMap.get(servicoId) ?? null : null,
      });
      store.clientes.push(cliente);
    } else {
      const servicoId = String(
        resp.servico_catalogo_id ?? dados.servico_catalogo_id ?? '',
      ).trim();
      mergeFormResponseIntoCliente(cliente, dados, {
        anamneseCampos,
        servicoNome: servicoId ? servicosMap.get(servicoId) ?? null : null,
      });
    }

    trackImportado(cliente);

    await ensureClienteFormularioLink({
      ownerEmail: email,
      clienteDriveId: cliente.id,
      nomeCliente: cliente.nome,
    });

    const telefone = dados.telefone ? String(dados.telefone) : cliente.telefone;
    if (telefone) {
      await upsertPacienteIndex({
        ownerEmail: email,
        telefone,
        nome: cliente.nome,
        clienteDriveId: cliente.id,
        cpf: dados.cpf ? String(dados.cpf) : cliente.cpf ?? null,
      });
    }

    await supabaseAdmin.from('formulario_respostas').delete().eq('id', resp.id);

    count++;
  }

  if (count > 0) {
    await saveClientesStore(tokenResult, store);
  }

  return NextResponse.json({
    sincronizados: count,
    importados,
    storage: 'google_drive',
  });
}
