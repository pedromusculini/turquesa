import { mergeAnamneseRespostas } from '@/lib/anamnese';
import type { ClienteDriveRecord, ClientesDriveStore } from '@/lib/clientesDrive';
import { findCliente, newId } from '@/lib/clientesDrive';
import { nomesMatch } from '@/lib/phoneMatch';
import { telefonePreenchido } from '@/lib/pacienteOpcoesUi';
import { supabaseAdmin } from '@/lib/supabaseClient';

/** Conta one-off: importação Marrissa (planilhas sem telefone). */
export const MERGE_CLIENTES_OWNER_EMAIL = 'marrissamartins@gmail.com';

export function isMergeClientesEnabled(email: string): boolean {
  const normalized = email.toLowerCase().trim();
  if (normalized === MERGE_CLIENTES_OWNER_EMAIL) return true;
  const env = process.env.ALLOW_MERGE_CLIENTES_EMAIL?.toLowerCase().trim();
  return !!env && normalized === env;
}

export type DuplicatePairSuggestion = {
  primaryId: string;
  primaryNome: string;
  primaryTelefone: string | null;
  primaryAtendimentos: number;
  secondaryId: string;
  secondaryNome: string;
  secondaryTelefone: string | null;
  secondaryAtendimentos: number;
  motivo: string;
};

export function findDuplicatePairs(store: ClientesDriveStore): DuplicatePairSuggestion[] {
  const pairs: DuplicatePairSuggestion[] = [];
  const seen = new Set<string>();

  for (const semTel of store.clientes) {
    if (telefonePreenchido(semTel.telefone)) continue;

    for (const comTel of store.clientes) {
      if (semTel.id === comTel.id) continue;
      if (!telefonePreenchido(comTel.telefone)) continue;
      if (!nomesMatch(semTel.nome, comTel.nome)) continue;

      const key = [semTel.id, comTel.id].sort().join(':');
      if (seen.has(key)) continue;
      seen.add(key);

      pairs.push({
        primaryId: semTel.id,
        primaryNome: semTel.nome,
        primaryTelefone: semTel.telefone,
        primaryAtendimentos: semTel.atendimentos.length,
        secondaryId: comTel.id,
        secondaryNome: comTel.nome,
        secondaryTelefone: comTel.telefone,
        secondaryAtendimentos: comTel.atendimentos.length,
        motivo: 'Mesmo nome — cadastro importado sem telefone e duplicata com telefone',
      });
    }
  }

  return pairs.sort((a, b) => a.primaryNome.localeCompare(b.primaryNome, 'pt-BR'));
}

export type MergePreview = {
  primary: { id: string; nome: string; telefone: string | null; atendimentos: number };
  secondary: { id: string; nome: string; telefone: string | null; atendimentos: number };
  willGainTelefone: boolean;
  willMergeAtendimentos: number;
  willMergeObservacoes: number;
  willMergePagamentos: number;
  willMergeAnamnese: boolean;
};

export function buildMergePreview(
  store: ClientesDriveStore,
  primaryId: string,
  secondaryId: string,
): MergePreview | null {
  const primary = findCliente(store, primaryId);
  const secondary = findCliente(store, secondaryId);
  if (!primary || !secondary) return null;

  return {
    primary: {
      id: primary.id,
      nome: primary.nome,
      telefone: primary.telefone,
      atendimentos: primary.atendimentos.length,
    },
    secondary: {
      id: secondary.id,
      nome: secondary.nome,
      telefone: secondary.telefone,
      atendimentos: secondary.atendimentos.length,
    },
    willGainTelefone:
      !telefonePreenchido(primary.telefone) && telefonePreenchido(secondary.telefone),
    willMergeAtendimentos: secondary.atendimentos.length,
    willMergeObservacoes: secondary.observacoes.length,
    willMergePagamentos: secondary.pagamentos.length,
    willMergeAnamnese: !!(
      secondary.anamnese_respostas && Object.keys(secondary.anamnese_respostas).length > 0
    ),
  };
}

/** Mescla secondary em primary (mutação in-place) e remove secondary do store. */
export function mergeClienteIntoPrimary(
  store: ClientesDriveStore,
  primaryId: string,
  secondaryId: string,
): ClienteDriveRecord {
  if (primaryId === secondaryId) {
    throw new Error('Selecione dois clientes diferentes.');
  }

  const primary = findCliente(store, primaryId);
  const secondary = findCliente(store, secondaryId);
  if (!primary || !secondary) {
    throw new Error('Cliente não encontrado.');
  }

  if (!telefonePreenchido(primary.telefone) && secondary.telefone) {
    primary.telefone = secondary.telefone;
  }
  if (!primary.email && secondary.email) primary.email = secondary.email;
  if (!primary.cpf && secondary.cpf) primary.cpf = secondary.cpf;
  if (!primary.data_nascimento && secondary.data_nascimento) {
    primary.data_nascimento = secondary.data_nascimento;
  }
  if (!primary.convenio && secondary.convenio) primary.convenio = secondary.convenio;
  if (!primary.servico_interesse_id && secondary.servico_interesse_id) {
    primary.servico_interesse_id = secondary.servico_interesse_id;
    primary.servico_interesse_nome = secondary.servico_interesse_nome ?? null;
  }

  if (secondary.observacoes_gerais) {
    const prefix = primary.observacoes_gerais ? `${primary.observacoes_gerais}\n\n` : '';
    primary.observacoes_gerais = `${prefix}[Unificação]\n${secondary.observacoes_gerais}`;
  }

  if (secondary.anamnese_respostas && Object.keys(secondary.anamnese_respostas).length > 0) {
    primary.anamnese_respostas = mergeAnamneseRespostas(
      primary.anamnese_respostas,
      secondary.anamnese_respostas,
    );
  }

  const now = new Date().toISOString();
  for (const a of secondary.atendimentos) {
    primary.atendimentos.push({ ...a, cliente_id: primary.id });
  }
  for (const o of secondary.observacoes) {
    primary.observacoes.push({ ...o, cliente_id: primary.id });
  }
  for (const p of secondary.pagamentos) {
    primary.pagamentos.push({ ...p, cliente_id: primary.id });
  }

  primary.atendimentos.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  primary.observacoes.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  primary.pagamentos.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  primary.observacoes.unshift({
    id: newId(),
    cliente_id: primary.id,
    texto: `[Unificação] Cadastro "${secondary.nome}" (${secondary.id.slice(0, 8)}…) mesclado neste cliente.`,
    autor: 'sistema',
    created_at: now,
  });

  primary.updated_at = now;

  const idx = store.clientes.findIndex((c) => c.id === secondaryId);
  if (idx >= 0) store.clientes.splice(idx, 1);

  return primary;
}

/** Reponta referências Supabase e remove índice do cadastro secundário. */
export async function repointMergedClienteRefs(
  ownerEmail: string,
  primaryId: string,
  secondaryId: string,
): Promise<void> {
  const owner = ownerEmail.toLowerCase().trim();

  const tables = [
    'consultas_agenda',
    'formulario_links',
    'paciente_agendamento_tokens',
    'pacientes_index',
  ] as const;

  for (const table of tables) {
    const { error } = await supabaseAdmin
      .from(table)
      .update({ cliente_drive_id: primaryId })
      .eq('owner_email', owner)
      .eq('cliente_drive_id', secondaryId);

    if (error && error.code !== 'PGRST205') {
      throw new Error(`Erro ao atualizar ${table}: ${error.message}`);
    }
  }

  const { error: delErr } = await supabaseAdmin
    .from('pacientes_index')
    .delete()
    .eq('owner_email', owner)
    .eq('cliente_drive_id', secondaryId);

  if (delErr && delErr.code !== 'PGRST205') {
    throw new Error(`Erro ao limpar pacientes_index: ${delErr.message}`);
  }
}
