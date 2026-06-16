import {
  baixarArquivoDoDrive,
  salvarArquivoNoDrive,
} from '@/lib/googleDrive';
import type {
  ClienteAtendimento,
  ClienteObservacao,
  ClientePagamento,
  ClienteStatusAtendimento,
  ClienteStatusPagamento,
} from '@/lib/types';
import {
  calcularValorAtendimento,
  classificarTipoAtendimento,
} from '@/lib/atendimentoFinalizar';
import { STATUS_ATENDIMENTO } from '@/lib/constants';
import {
  formatObservacaoAtendimento,
  normalizeCatalogoItensBody,
  parseObservacaoAtendimento,
  calcularTotalItens,
  type AtendimentoItemLinha,
} from '@/lib/atendimentoItens';
import { filterAndSortByClienteQuery } from '@/lib/clienteSearch';
import {
  formatPhoneDisplay,
  isValidPhone,
  nomesMatch,
  phoneDigits,
  phonesMatch,
} from '@/lib/phoneMatch';
import { telefonePreenchido } from '@/lib/pacienteOpcoesUi';
import type { AnamneseCampo } from '@/lib/anamnese';
import { mergeAnamneseRespostas } from '@/lib/anamnese';
import {
  getClientesDriveCache,
  invalidateClientesDriveCache,
  setClientesDriveCache,
} from '@/lib/clientesDriveCache';

export const CLIENTES_FILE = 'clientes.json';
export const FATURAMENTO_FILE = 'faturamento.json';

export type ClienteDriveRecord = {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  cpf: string | null;
  data_nascimento: string | null;
  convenio: string | null;
  observacoes_gerais: string | null;
  anamnese_respostas?: Record<string, string | boolean> | null;
  servico_interesse_id?: string | null;
  servico_interesse_nome?: string | null;
  /** People API resourceName — evita reimportar após unificação. */
  google_contact_ids?: string[];
  /** IDs de cadastros mesclados neste (auditoria / dedup). */
  merged_from_cliente_ids?: string[];
  created_at: string;
  updated_at: string;
  atendimentos: ClienteAtendimento[];
  observacoes: ClienteObservacao[];
  pagamentos: ClientePagamento[];
};

export type ClientesDriveStore = {
  version: 2;
  owner_email: string;
  atualizado_em: string;
  clientes: ClienteDriveRecord[];
  /** cadastro removido na unificação → id do primário mantido. */
  clientes_merge_map?: Record<string, string>;
};

type FaturamentoDriveStore = {
  version: 1;
  owner_email: string;
  atualizado_em: string;
  transacoes: unknown[];
};

async function loadJsonFromDrive<T>(
  accessToken: string,
  fileName: string,
  fallback: T,
): Promise<{ data: T; fileId?: string }> {
  const DRIVE_API = 'https://www.googleapis.com/drive/v3';
  const folderQuery = encodeURIComponent(
    `name='MedSupApp' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  );
  const folderRes = await fetch(`${DRIVE_API}/files?q=${folderQuery}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const folderData = await folderRes.json();
  const folderId = folderData.files?.[0]?.id;
  if (!folderId) return { data: fallback };

  const fileQuery = encodeURIComponent(
    `name='${fileName}' and '${folderId}' in parents and trashed=false`,
  );
  const fileRes = await fetch(`${DRIVE_API}/files?q=${fileQuery}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const fileData = await fileRes.json();
  const fileId = fileData.files?.[0]?.id;
  if (!fileId) return { data: fallback };

  const content = await baixarArquivoDoDrive(accessToken, fileId);
  try {
    return { data: JSON.parse(content) as T, fileId };
  } catch {
    return { data: fallback, fileId };
  }
}

async function saveJsonToDrive(
  accessToken: string,
  fileName: string,
  data: unknown,
): Promise<void> {
  const json = JSON.stringify(data, null, 2);
  await salvarArquivoNoDrive(accessToken, fileName, json, 'application/json');
}

export async function loadClientesStore(
  accessToken: string,
  ownerEmail: string,
  options?: { force?: boolean },
): Promise<ClientesDriveStore> {
  if (!options?.force) {
    const cached = getClientesDriveCache(ownerEmail);
    if (cached) return cached;
  }

  const fallback: ClientesDriveStore = {
    version: 2,
    owner_email: ownerEmail,
    atualizado_em: new Date().toISOString(),
    clientes: [],
  };
  const { data } = await loadJsonFromDrive(accessToken, CLIENTES_FILE, fallback);
  if (!data.clientes) data.clientes = [];
  data.owner_email = ownerEmail;
  setClientesDriveCache(ownerEmail, data);
  return data;
}

export async function saveClientesStore(
  accessToken: string,
  store: ClientesDriveStore,
): Promise<void> {
  store.atualizado_em = new Date().toISOString();
  await saveJsonToDrive(accessToken, CLIENTES_FILE, store);
  invalidateClientesDriveCache(store.owner_email);
  setClientesDriveCache(store.owner_email, store);
}

export async function loadFaturamentoStore(
  accessToken: string,
  ownerEmail: string,
): Promise<FaturamentoDriveStore> {
  const fallback: FaturamentoDriveStore = {
    version: 1,
    owner_email: ownerEmail,
    atualizado_em: new Date().toISOString(),
    transacoes: [],
  };
  const { data } = await loadJsonFromDrive(accessToken, FATURAMENTO_FILE, fallback);
  if (!data.transacoes) data.transacoes = [];
  data.owner_email = ownerEmail;
  return data;
}

export async function saveFaturamentoStore(
  accessToken: string,
  store: FaturamentoDriveStore,
): Promise<void> {
  store.atualizado_em = new Date().toISOString();
  await saveJsonToDrive(accessToken, FATURAMENTO_FILE, store);
}

export function newId(): string {
  return crypto.randomUUID();
}

export function findCliente(
  store: ClientesDriveStore,
  id: string,
): ClienteDriveRecord | undefined {
  return store.clientes.find((c) => c.id === id);
}

export type FindClienteDedupInput = {
  telefone?: string | null;
  email?: string | null;
  nome?: string | null;
  cpf?: string | null;
  /** Ignora este id na busca (ex.: PUT do próprio cliente). */
  excludeId?: string | null;
};

/**
 * Busca cliente existente antes de criar duplicata.
 * Prioridade: telefone normalizado → e-mail → CPF → nome + telefone → nome (import sem tel).
 */
export function findExistingClienteByPhoneOrEmail(
  store: ClientesDriveStore,
  dados: FindClienteDedupInput,
): ClienteDriveRecord | undefined {
  const tel = dados.telefone?.trim() || '';
  const email = dados.email ? dados.email.toLowerCase().trim() : '';
  const nome = dados.nome?.trim() || '';
  const cpf = dados.cpf ? dados.cpf.replace(/\D/g, '') : '';
  const excludeId = dados.excludeId?.trim() || '';
  const notExcluded = (c: ClienteDriveRecord) => !excludeId || c.id !== excludeId;

  if (tel && isValidPhone(tel)) {
    const byTel = store.clientes.find((c) => notExcluded(c) && phonesMatch(c.telefone, tel));
    if (byTel) return byTel;
  }

  if (email) {
    const byEmail = store.clientes.find(
      (c) => notExcluded(c) && c.email?.toLowerCase().trim() === email,
    );
    if (byEmail) return byEmail;
  }

  if (cpf) {
    const byCpf = store.clientes.find(
      (c) => notExcluded(c) && c.cpf?.replace(/\D/g, '') === cpf,
    );
    if (byCpf) return byCpf;
  }

  if (nome && tel && phoneDigits(tel).length >= 10) {
    const byNomeImport = store.clientes.find(
      (c) =>
        notExcluded(c) && nomesMatch(c.nome, nome) && !telefonePreenchido(c.telefone),
    );
    if (byNomeImport) return byNomeImport;
  }

  return undefined;
}

/** @deprecated Prefer findExistingClienteByPhoneOrEmail (inclui nome). */
export function findClienteByContato(
  store: ClientesDriveStore,
  dados: FindClienteDedupInput,
): ClienteDriveRecord | undefined {
  return findExistingClienteByPhoneOrEmail(store, dados);
}

/** Busca cliente Drive pelo nome (import CSV sem telefone + Google Contatos). */
export function findClienteByNome(
  store: ClientesDriveStore,
  nome: string,
): ClienteDriveRecord | undefined {
  const trimmed = nome?.trim();
  if (!trimmed) return undefined;
  return store.clientes.find((c) => nomesMatch(c.nome, trimmed));
}

export function filterClientes(store: ClientesDriveStore, q?: string): ClienteDriveRecord[] {
  const list = [...store.clientes].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  if (!q?.trim()) return list;
  return filterAndSortByClienteQuery(
    list,
    q,
    (c) => {
      const parts = [c.nome, c.email, c.cpf];
      if (c.telefone) {
        parts.push(c.telefone, formatPhoneDisplay(c.telefone), phoneDigits(c.telefone));
      }
      return parts.filter(Boolean).join(' ');
    },
    (c) => c.nome,
  );
}

export function paginateClientes(
  store: ClientesDriveStore,
  options?: {
    q?: string;
    limit?: number;
    offset?: number;
    all?: boolean;
    /** Só cadastros com ao menos um atendimento registrado. */
    comAtendimentos?: boolean;
  },
): { clientes: ClienteDriveRecord[]; total: number; hasMore: boolean } {
  let filtered = filterClientes(store, options?.q);
  if (options?.comAtendimentos) {
    filtered = filtered.filter((c) => c.atendimentos.length > 0);
  }
  const total = filtered.length;
  if (options?.all) {
    return { clientes: filtered, total, hasMore: false };
  }
  const limit = Math.min(200, Math.max(1, options?.limit ?? 50));
  const offset = Math.max(0, options?.offset ?? 0);
  const clientes = filtered.slice(offset, offset + limit);
  return { clientes, total, hasMore: offset + clientes.length < total };
}

export function createClienteRecord(
  body: Record<string, unknown>,
): ClienteDriveRecord {
  const now = new Date().toISOString();
  return {
    id: newId(),
    nome: String(body.nome ?? '').trim(),
    email: body.email ? String(body.email).trim() : null,
    telefone: body.telefone ? String(body.telefone).trim() : null,
    cpf: body.cpf ? String(body.cpf).trim() : null,
    data_nascimento: body.data_nascimento ? String(body.data_nascimento) : null,
    convenio: body.convenio ? String(body.convenio).trim() : null,
    observacoes_gerais: body.observacoes_gerais ? String(body.observacoes_gerais).trim() : null,
    created_at: now,
    updated_at: now,
    atendimentos: [],
    observacoes: [],
    pagamentos: [],
  };
}

export function addAtendimento(
  cliente: ClienteDriveRecord,
  body: Record<string, unknown>,
): ClienteAtendimento {
  const catalogoItens = normalizeCatalogoItensBody(body.catalogo_itens);
  const obsInput = body.observacoes ? String(body.observacoes).trim() : '';
  const observacoesFinal =
    catalogoItens.length > 0
      ? formatObservacaoAtendimento(obsInput, catalogoItens)
      : obsInput || null;

  let valor: number | null = null;
  if (body.valor != null && body.valor !== '') {
    valor = Number(body.valor);
  } else if (catalogoItens.length > 0) {
    valor = calcularTotalItens(catalogoItens);
  }

  const item: ClienteAtendimento = {
    id: newId(),
    cliente_id: cliente.id,
    data: String(body.data),
    hora: body.hora ? String(body.hora) : null,
    tipo: String(body.tipo || 'consulta'),
    medico: body.medico ? String(body.medico).trim() : null,
    valor,
    plano: body.plano ? String(body.plano).trim() : null,
    status: (body.status as ClienteStatusAtendimento) || 'realizado',
    observacoes: observacoesFinal,
    created_at: new Date().toISOString(),
  };
  cliente.atendimentos.unshift(item);
  cliente.updated_at = new Date().toISOString();
  return item;
}

export function updateAtendimento(
  cliente: ClienteDriveRecord,
  atendimentoId: string,
  body: Record<string, unknown>,
): ClienteAtendimento | null {
  const idx = cliente.atendimentos.findIndex((a) => a.id === atendimentoId);
  if (idx < 0) return null;

  const atendimento = cliente.atendimentos[idx];

  if (body.data) atendimento.data = String(body.data);
  if (body.hora !== undefined) {
    atendimento.hora = body.hora ? String(body.hora) : null;
  }
  if (body.medico !== undefined) {
    atendimento.medico = body.medico ? String(body.medico).trim() : null;
  }
  if (
    body.status &&
    (STATUS_ATENDIMENTO as readonly string[]).includes(String(body.status))
  ) {
    atendimento.status = body.status as ClienteStatusAtendimento;
  }

  const catalogoItens = normalizeCatalogoItensBody(body.catalogo_itens);
  const obsExplicita =
    body.observacoes !== undefined ? String(body.observacoes).trim() : undefined;

  if (catalogoItens.length > 0 || obsExplicita !== undefined) {
    const textoLivre =
      obsExplicita ??
      parseObservacaoAtendimento(atendimento.observacoes).textoLivre;
    atendimento.observacoes =
      formatObservacaoAtendimento(textoLivre, catalogoItens) || null;
  }

  if (body.valor !== undefined && body.valor !== '') {
    atendimento.valor = Number(body.valor);
  } else if (catalogoItens.length > 0) {
    atendimento.valor = calcularTotalItens(catalogoItens);
  }

  const pagamento = cliente.pagamentos.find((p) => p.atendimento_id === atendimentoId);
  if (pagamento) {
    if (body.valor !== undefined && body.valor !== '') {
      pagamento.valor = Number(body.valor);
    } else if (atendimento.valor != null) {
      pagamento.valor = atendimento.valor;
    }
    if (body.forma_pagamento) {
      pagamento.forma_pagamento = String(body.forma_pagamento);
    }
  }

  cliente.updated_at = new Date().toISOString();
  return atendimento;
}

export function addObservacao(
  cliente: ClienteDriveRecord,
  texto: string,
  autor: string,
): ClienteObservacao {
  const item: ClienteObservacao = {
    id: newId(),
    cliente_id: cliente.id,
    texto,
    autor,
    created_at: new Date().toISOString(),
  };
  cliente.observacoes.unshift(item);
  cliente.updated_at = new Date().toISOString();
  return item;
}

export function addPagamento(
  cliente: ClienteDriveRecord,
  body: Record<string, unknown>,
): ClientePagamento {
  const item: ClientePagamento = {
    id: newId(),
    cliente_id: cliente.id,
    atendimento_id: body.atendimento_id ? String(body.atendimento_id) : null,
    valor: Number(body.valor),
    data: String(body.data),
    status: (body.status as ClienteStatusPagamento) || 'pago',
    forma_pagamento: body.forma_pagamento ? String(body.forma_pagamento) : null,
    observacao: body.observacao ? String(body.observacao).trim() : null,
    created_at: new Date().toISOString(),
  };
  cliente.pagamentos.unshift(item);
  cliente.updated_at = new Date().toISOString();
  return item;
}

export type FinalizarAtendimentoInput = {
  data: string;
  hora?: string | null;
  valor: number;
  valorOriginal?: number;
  descontoPercent?: number;
  descontoValor?: number;
  forma_pagamento: string;
  plano?: string | null;
  medico?: string | null;
  parcelas?: number;
  tipo?: string | null;
  observacoes?: string | null;
  catalogoItens?: AtendimentoItemLinha[];
};

export function finalizarAtendimentoNoCliente(
  cliente: ClienteDriveRecord,
  input: FinalizarAtendimentoInput,
): {
  atendimento: ClienteAtendimento;
  pagamento: ClientePagamento;
  tipo: 'consulta' | 'retorno';
} {
  const valorBase = input.valorOriginal ?? input.valor;
  const valorPago = calcularValorAtendimento(
    valorBase,
    input.descontoPercent ?? 0,
    input.descontoValor ?? 0,
  );

  const tipo = classificarTipoAtendimento(
    cliente.atendimentos,
    input.data,
    input.tipo,
  );

  if (input.plano) {
    cliente.convenio = input.plano;
  }

  const dataRef = new Date(`${input.data}T12:00:00`);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const statusAtend =
    !Number.isNaN(dataRef.getTime()) && dataRef > hoje ? 'agendado' : 'realizado';

  const itens = input.catalogoItens?.filter((i) => i.catalogoId) ?? [];
  const observacoesFinal = formatObservacaoAtendimento(
    input.observacoes ?? '',
    itens,
  );

  const atendimento = addAtendimento(cliente, {
    data: input.data,
    hora: input.hora ?? null,
    tipo,
    medico: input.medico ?? null,
    valor: valorPago,
    plano: input.plano ?? null,
    status: statusAtend,
    observacoes: observacoesFinal || null,
  });

  const obsParts = [
    observacoesFinal || input.observacoes,
    input.parcelas && input.parcelas > 1 ? `Parcelado em ${input.parcelas}x` : null,
    input.descontoPercent || input.descontoValor ? 'Desconto aplicado' : null,
  ].filter(Boolean);

  const pagamento = addPagamento(cliente, {
    atendimento_id: atendimento.id,
    valor: valorPago,
    data: input.data,
    status: 'pago',
    forma_pagamento: input.forma_pagamento,
    observacao:
      obsParts.length > 0
        ? obsParts.join(' · ')
        : `Atendimento ${tipo} — ${new Date(input.data).toLocaleDateString('pt-BR')}`,
  });

  return { atendimento, pagamento, tipo };
}

export function appendAnamneseToCliente(
  cliente: ClienteDriveRecord,
  campos: { id: string; label: string }[],
  respostas: Record<string, string | boolean>,
  origem: string,
): void {
  const linhas = campos
    .map((c) => {
      const v = respostas[c.id];
      if (v === undefined || v === null || (typeof v === 'string' && !v.trim())) {
        return null;
      }
      const val = typeof v === 'boolean' ? (v ? 'Sim' : 'Não') : String(v).trim();
      return `• ${c.label}: ${val}`;
    })
    .filter((x): x is string => !!x);
  if (linhas.length > 0) {
    addObservacao(cliente, `[Anamnese — ${origem}]\n${linhas.join('\n')}`, 'salão');
  }
}

export type MergeFormResponseOpts = {
  anamneseCampos?: AnamneseCampo[];
  servicoNome?: string | null;
};

/** Mescla resposta de formulário público no cliente (Drive) */
export function mergeFormResponseIntoCliente(
  cliente: ClienteDriveRecord,
  dados: Record<string, unknown>,
  opts?: MergeFormResponseOpts,
): void {
  if (dados.nome) cliente.nome = String(dados.nome).trim();
  if (dados.email) cliente.email = String(dados.email).trim() || null;
  if (dados.telefone) cliente.telefone = String(dados.telefone).trim();
  if (dados.cpf) cliente.cpf = String(dados.cpf).trim();
  if (dados.data_nascimento) cliente.data_nascimento = String(dados.data_nascimento);
  if (dados.convenio) cliente.convenio = String(dados.convenio);

  const obsForm = [dados.observacoes, dados.motivo_consulta]
    .filter(Boolean)
    .map(String)
    .join('\n')
    .trim();
  if (obsForm) {
    const prefix = cliente.observacoes_gerais ? `${cliente.observacoes_gerais}\n\n` : '';
    cliente.observacoes_gerais = `${prefix}[Formulário online]\n${obsForm}`;
  }

  const servicoId = String(dados.servico_catalogo_id ?? '').trim();
  if (servicoId) {
    cliente.servico_interesse_id = servicoId;
    cliente.servico_interesse_nome =
      opts?.servicoNome?.trim() ||
      cliente.servico_interesse_nome ||
      servicoId;
    addObservacao(
      cliente,
      `[Formulário online] Serviço de interesse: ${cliente.servico_interesse_nome}`,
      'salão',
    );
  }

  if (dados.medico) {
    const profParts = [String(dados.medico)];
    if (dados.medico_crm) profParts.push(String(dados.medico_crm));
    if (dados.medico_especialidade) profParts.push(String(dados.medico_especialidade));
    addObservacao(
      cliente,
      `[Formulário online] Profissional preferido: ${profParts.join(' · ')}`,
      'salão',
    );
  }

  if (dados.autorizacao_imagem === true || dados.autorizacao_imagem === false) {
    addObservacao(
      cliente,
      `[Formulário online] Autorização uso de imagens: ${
        dados.autorizacao_imagem ? 'Aceito' : 'Não aceito'
      }`,
      'salão',
    );
  }

  const anamnese = dados.anamnese_respostas;
  if (anamnese && typeof anamnese === 'object' && Object.keys(anamnese).length > 0) {
    const incoming = anamnese as Record<string, string | boolean>;
    cliente.anamnese_respostas = mergeAnamneseRespostas(cliente.anamnese_respostas, incoming);
    const campos = opts?.anamneseCampos ?? [];
    if (campos.length > 0) {
      appendAnamneseToCliente(cliente, campos, incoming, 'formulário online');
    } else {
      const linhas = Object.entries(incoming).map(([k, v]) => {
        const label = typeof v === 'boolean' ? (v ? 'Sim' : 'Não') : String(v);
        return `• ${k}: ${label}`;
      });
      addObservacao(cliente, `[Anamnese — formulário online]\n${linhas.join('\n')}`, 'salão');
    }
  }

  cliente.updated_at = new Date().toISOString();
}
