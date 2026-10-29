import { fetchAgendaConsultasForCliente } from '@/lib/clienteConsultaLinks';
import type { ClienteDriveRecord, ClientesDriveStore } from '@/lib/clientesDrive';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { listSplitsForTransacoes } from '@/lib/financeiroList';
import {
  parseAnamneseFromObservacoes,
  type ClienteDetalheEnriquecido,
  type ClienteFinanceiroEntrada,
} from '@/lib/clienteFichaFormat';

export * from '@/lib/clienteFichaFormat';

/** Resolve nome do serviço no catálogo do salão */
export async function resolveServicoCatalogoNome(
  ownerEmail: string,
  servicoId: string | null | undefined,
): Promise<string | null> {
  const id = String(servicoId ?? '').trim();
  if (!id) return null;
  const { data } = await supabaseAdmin
    .from('servicos_catalogo')
    .select('nome')
    .eq('id', id)
    .eq('owner_email', ownerEmail.toLowerCase().trim())
    .maybeSingle();
  return data?.nome ? String(data.nome) : null;
}

export async function loadServicosCatalogoMap(
  ownerEmail: string,
): Promise<Map<string, string>> {
  const { data } = await supabaseAdmin
    .from('servicos_catalogo')
    .select('id, nome')
    .eq('owner_email', ownerEmail.toLowerCase().trim())
    .eq('ativo', true);
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    map.set(String(row.id), String(row.nome));
  }
  return map;
}

export function driveRecordToDetalhe(
  cliente: ClienteDriveRecord,
  ownerEmail: string,
): ClienteDetalheEnriquecido {
  const anamneseFromObs = parseAnamneseFromObservacoes(cliente.observacoes);
  return {
    id: cliente.id,
    owner_email: ownerEmail,
    nome: cliente.nome,
    email: cliente.email,
    telefone: cliente.telefone,
    cpf: cliente.cpf,
    data_nascimento: cliente.data_nascimento,
    convenio: cliente.convenio,
    observacoes_gerais: cliente.observacoes_gerais,
    created_at: cliente.created_at,
    updated_at: cliente.updated_at,
    atendimentos: cliente.atendimentos,
    observacoes: cliente.observacoes,
    pagamentos: cliente.pagamentos,
    pacotes: cliente.pacotes ?? [],
    anamnese_respostas:
      cliente.anamnese_respostas ?? anamneseFromObs ?? null,
    servico_interesse_id: cliente.servico_interesse_id ?? null,
    servico_interesse_nome: cliente.servico_interesse_nome ?? null,
  };
}

export async function enrichClienteDetalhe(
  ownerEmail: string,
  cliente: ClienteDriveRecord,
  options?: { store?: ClientesDriveStore | null },
): Promise<ClienteDetalheEnriquecido> {
  const base = driveRecordToDetalhe(cliente, ownerEmail);
  const owner = ownerEmail.toLowerCase().trim();

  const [agenda_consultas, financeiroRes] = await Promise.all([
    fetchAgendaConsultasForCliente(ownerEmail, cliente, options?.store),
    supabaseAdmin
      .from('financeiro_transacoes')
      .select('*')
      .eq('owner_email', owner)
      .eq('tipo', 'entrada')
      .ilike('descricao', `%${cliente.nome.replace(/[%_]/g, '')}%`)
      .order('data', { ascending: false })
      .limit(30),
  ]);

  const splitsRows = await listSplitsForTransacoes(
    (financeiroRes.data ?? []).map((t) => String(t.id)),
  );
  const financeiro_entradas: ClienteFinanceiroEntrada[] = (financeiroRes.data ?? []).map(
    (t) => ({
      id: String(t.id),
      data: String(t.data),
      descricao: String(t.descricao ?? ''),
      valor: Number(t.valor) || 0,
      forma_pagamento: t.forma_pagamento ? String(t.forma_pagamento) : null,
      medico: t.medico ? String(t.medico) : null,
      observacao: t.observacao ? String(t.observacao) : null,
      editavel: {
        ...t,
        id: String(t.id),
        tipo: 'entrada',
        splits: splitsRows.filter((s) => String(s.transacao_id) === String(t.id)),
      } as ClienteFinanceiroEntrada['editavel'],
    }),
  );

  return { ...base, agenda_consultas, financeiro_entradas };
}
