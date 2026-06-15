import { mergeAnamneseRespostas } from '@/lib/anamnese';
import type { ClienteDriveRecord, ClientesDriveStore } from '@/lib/clientesDrive';
import { findCliente, newId } from '@/lib/clientesDrive';
import {
  mergeGoogleContactIds,
  recordClienteMergeMap,
  resolveMergedPrimaryId,
} from '@/lib/clientesGoogleSync';
import { nomesMatch, phonesMatch } from '@/lib/phoneMatch';
import { telefonePreenchido } from '@/lib/pacienteOpcoesUi';
import { supabaseAdmin } from '@/lib/supabaseClient';

/** Conta histórica com importação CSV sem telefone (referência em docs). */
export function isMergeClientesEnabled(_email: string): boolean {
  return true;
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

function pushPair(
  pairs: DuplicatePairSuggestion[],
  seen: Set<string>,
  a: ClienteDriveRecord,
  b: ClienteDriveRecord,
  motivo: string,
  preferPrimary?: ClienteDriveRecord,
) {
  const key = [a.id, b.id].sort().join(':');
  if (seen.has(key)) return;
  seen.add(key);

  const primary =
    preferPrimary ??
    (a.atendimentos.length >= b.atendimentos.length ? a : b);
  const secondary = primary.id === a.id ? b : a;

  pairs.push({
    primaryId: primary.id,
    primaryNome: primary.nome,
    primaryTelefone: primary.telefone,
    primaryAtendimentos: primary.atendimentos.length,
    secondaryId: secondary.id,
    secondaryNome: secondary.nome,
    secondaryTelefone: secondary.telefone,
    secondaryAtendimentos: secondary.atendimentos.length,
    motivo,
  });
}

export function findDuplicatePairs(store: ClientesDriveStore): DuplicatePairSuggestion[] {
  const pairs: DuplicatePairSuggestion[] = [];
  const seen = new Set<string>();

  for (const semTel of store.clientes) {
    if (telefonePreenchido(semTel.telefone)) continue;

    for (const comTel of store.clientes) {
      if (semTel.id === comTel.id) continue;
      if (!telefonePreenchido(comTel.telefone)) continue;
      if (!nomesMatch(semTel.nome, comTel.nome)) continue;

      pushPair(
        pairs,
        seen,
        semTel,
        comTel,
        'Mesmo nome — cadastro importado sem telefone e duplicata com telefone',
        semTel,
      );
    }
  }

  for (let i = 0; i < store.clientes.length; i++) {
    for (let j = i + 1; j < store.clientes.length; j++) {
      const a = store.clientes[i];
      const b = store.clientes[j];

      if (
        telefonePreenchido(a.telefone) &&
        telefonePreenchido(b.telefone) &&
        phonesMatch(a.telefone, b.telefone)
      ) {
        pushPair(pairs, seen, a, b, 'Mesmo telefone em cadastros diferentes');
        continue;
      }

      const emailA = a.email?.toLowerCase().trim();
      const emailB = b.email?.toLowerCase().trim();
      if (emailA && emailB && emailA === emailB) {
        pushPair(pairs, seen, a, b, 'Mesmo e-mail em cadastros diferentes');
        continue;
      }

      if (nomesMatch(a.nome, b.nome) && telefonePreenchido(a.telefone) && telefonePreenchido(b.telefone)) {
        pushPair(pairs, seen, a, b, 'Nome muito parecido com telefones diferentes');
      }
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

/** Valida par de unificação e devolve mensagem amigável ou null. */
export function validateMergePair(
  store: ClientesDriveStore,
  primaryId: string,
  secondaryId: string,
): string | null {
  if (primaryId === secondaryId) {
    return 'Selecione dois clientes diferentes.';
  }

  const resolvedPrimary = resolveMergedPrimaryId(store, primaryId);
  const resolvedSecondary = resolveMergedPrimaryId(store, secondaryId);

  if (resolvedPrimary === resolvedSecondary) {
    return 'Estes cadastros já foram unificados. Atualize a página.';
  }

  const map = store.clientes_merge_map ?? {};
  if (map[secondaryId] && map[secondaryId] !== primaryId && !findCliente(store, secondaryId)) {
    return 'O cadastro a mesclar já foi unificado anteriormente. Atualize a página.';
  }

  const primary = findCliente(store, resolvedPrimary);
  const secondary = findCliente(store, resolvedSecondary);
  if (!primary || !secondary) {
    return 'Cliente não encontrado. Atualize a página e tente novamente.';
  }

  return null;
}

export function buildMergePreview(
  store: ClientesDriveStore,
  primaryId: string,
  secondaryId: string,
): MergePreview | null {
  if (validateMergePair(store, primaryId, secondaryId)) return null;

  const primary = findCliente(store, resolveMergedPrimaryId(store, primaryId));
  const secondary = findCliente(store, resolveMergedPrimaryId(store, secondaryId));
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
  const validationError = validateMergePair(store, primaryId, secondaryId);
  if (validationError) {
    throw new Error(validationError);
  }

  const resolvedPrimaryId = resolveMergedPrimaryId(store, primaryId);
  const resolvedSecondaryId = resolveMergedPrimaryId(store, secondaryId);

  const primary = findCliente(store, resolvedPrimaryId);
  const secondary = findCliente(store, resolvedSecondaryId);
  if (!primary || !secondary) {
    throw new Error('Cliente não encontrado. Atualize a página e tente novamente.');
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

  mergeGoogleContactIds(primary, secondary);
  recordClienteMergeMap(store, resolvedPrimaryId, resolvedSecondaryId);

  if (!primary.merged_from_cliente_ids) primary.merged_from_cliente_ids = [];
  if (!primary.merged_from_cliente_ids.includes(resolvedSecondaryId)) {
    primary.merged_from_cliente_ids.push(resolvedSecondaryId);
  }

  primary.updated_at = now;

  const idx = store.clientes.findIndex((c) => c.id === resolvedSecondaryId);
  if (idx >= 0) store.clientes.splice(idx, 1);

  return primary;
}

async function repointPacientesIndex(
  owner: string,
  primaryId: string,
  secondaryId: string,
): Promise<void> {
  const { data: secondaryRows, error: selErr } = await supabaseAdmin
    .from('pacientes_index')
    .select('telefone_normalizado')
    .eq('owner_email', owner)
    .eq('cliente_drive_id', secondaryId);

  if (selErr && selErr.code !== 'PGRST205') {
    throw new Error(`Erro ao consultar pacientes_index: ${selErr.message}`);
  }

  for (const row of secondaryRows ?? []) {
    const tel = row.telefone_normalizado;
    if (!tel) continue;

    const { data: existing, error: existErr } = await supabaseAdmin
      .from('pacientes_index')
      .select('cliente_drive_id')
      .eq('owner_email', owner)
      .eq('telefone_normalizado', tel)
      .maybeSingle();

    if (existErr && existErr.code !== 'PGRST205') {
      throw new Error(`Erro ao consultar pacientes_index: ${existErr.message}`);
    }

    if (existing?.cliente_drive_id === primaryId) {
      const { error: delDupErr } = await supabaseAdmin
        .from('pacientes_index')
        .delete()
        .eq('owner_email', owner)
        .eq('cliente_drive_id', secondaryId)
        .eq('telefone_normalizado', tel);

      if (delDupErr && delDupErr.code !== 'PGRST205') {
        throw new Error(
          `Erro ao remover índice duplicado do cadastro secundário: ${delDupErr.message}`,
        );
      }
      continue;
    }

    const { error: updErr } = await supabaseAdmin
      .from('pacientes_index')
      .update({ cliente_drive_id: primaryId })
      .eq('owner_email', owner)
      .eq('cliente_drive_id', secondaryId)
      .eq('telefone_normalizado', tel);

    if (updErr && updErr.code !== 'PGRST205') {
      throw new Error(`Erro ao atualizar pacientes_index: ${updErr.message}`);
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
  ] as const;

  for (const table of tables) {
    const { error } = await supabaseAdmin
      .from(table)
      .update({ cliente_drive_id: primaryId })
      .eq('owner_email', owner)
      .eq('cliente_drive_id', secondaryId);

    if (error && error.code !== 'PGRST205') {
      throw new Error(
        `Erro ao atualizar referências (${table}): ${error.message}. A unificação não foi salva.`,
      );
    }
  }

  await repointPacientesIndex(owner, primaryId, secondaryId);
}
