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
import { phonesMatch } from '@/lib/phoneMatch';

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
  created_at: string;
  updated_at: string;
  atendimentos: ClienteAtendimento[];
  observacoes: ClienteObservacao[];
  pagamentos: ClientePagamento[];
};

type ClientesDriveStore = {
  version: 2;
  owner_email: string;
  atualizado_em: string;
  clientes: ClienteDriveRecord[];
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
): Promise<ClientesDriveStore> {
  const fallback: ClientesDriveStore = {
    version: 2,
    owner_email: ownerEmail,
    atualizado_em: new Date().toISOString(),
    clientes: [],
  };
  const { data } = await loadJsonFromDrive(accessToken, CLIENTES_FILE, fallback);
  if (!data.clientes) data.clientes = [];
  data.owner_email = ownerEmail;
  return data;
}

export async function saveClientesStore(
  accessToken: string,
  store: ClientesDriveStore,
): Promise<void> {
  store.atualizado_em = new Date().toISOString();
  await saveJsonToDrive(accessToken, CLIENTES_FILE, store);
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

export function findClienteByContato(
  store: ClientesDriveStore,
  dados: {
    email?: string | null;
    telefone?: string | null;
    cpf?: string | null;
  },
): ClienteDriveRecord | undefined {
  const email = dados.email ? dados.email.toLowerCase().trim() : '';
  const cpf = dados.cpf ? dados.cpf.replace(/\D/g, '') : '';
  const tel = dados.telefone ?? '';
  return store.clientes.find((c) => {
    if (email && c.email?.toLowerCase().trim() === email) return true;
    if (cpf && c.cpf?.replace(/\D/g, '') === cpf) return true;
    if (tel && phonesMatch(c.telefone, tel)) return true;
    return false;
  });
}

export function filterClientes(store: ClientesDriveStore, q?: string): ClienteDriveRecord[] {
  const list = [...store.clientes].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  if (!q) return list;
  const term = q.toLowerCase();
  return list.filter(
    (c) =>
      c.nome.toLowerCase().includes(term) ||
      (c.email?.toLowerCase().includes(term) ?? false) ||
      (c.telefone?.includes(term) ?? false) ||
      (c.cpf?.includes(term) ?? false),
  );
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
  const item: ClienteAtendimento = {
    id: newId(),
    cliente_id: cliente.id,
    data: String(body.data),
    hora: body.hora ? String(body.hora) : null,
    tipo: String(body.tipo || 'consulta'),
    medico: body.medico ? String(body.medico).trim() : null,
    valor: body.valor != null ? Number(body.valor) : null,
    plano: body.plano ? String(body.plano).trim() : null,
    status: (body.status as ClienteStatusAtendimento) || 'realizado',
    observacoes: body.observacoes ? String(body.observacoes).trim() : null,
    created_at: new Date().toISOString(),
  };
  cliente.atendimentos.unshift(item);
  cliente.updated_at = new Date().toISOString();
  return item;
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

  const atendimento = addAtendimento(cliente, {
    data: input.data,
    hora: input.hora ?? null,
    tipo,
    medico: input.medico ?? null,
    valor: valorPago,
    plano: input.plano ?? null,
    status: statusAtend,
    observacoes: input.observacoes ?? null,
  });

  const obsParts = [
    input.observacoes,
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

/** Mescla resposta de formulário público no cliente */
export function mergeFormResponseIntoCliente(
  cliente: ClienteDriveRecord,
  dados: Record<string, unknown>,
): void {
  if (dados.nome && !cliente.nome) cliente.nome = String(dados.nome);
  if (dados.email) cliente.email = String(dados.email);
  if (dados.telefone) cliente.telefone = String(dados.telefone);
  if (dados.cpf) cliente.cpf = String(dados.cpf);
  if (dados.data_nascimento) cliente.data_nascimento = String(dados.data_nascimento);
  if (dados.convenio) cliente.convenio = String(dados.convenio);
  if (dados.medico) {
    const profParts = [String(dados.medico)];
    if (dados.medico_crm) profParts.push(`CRM ${String(dados.medico_crm)}`);
    if (dados.medico_especialidade) profParts.push(String(dados.medico_especialidade));
    addObservacao(
      cliente,
      `[Formulário online] Profissional preferido: ${profParts.join(' · ')}`,
      'paciente',
    );
  }
  if (dados.observacoes || dados.motivo_consulta) {
    const texto = [dados.observacoes, dados.motivo_consulta]
      .filter(Boolean)
      .map(String)
      .join('\n');
    addObservacao(cliente, `[Formulário online]\n${texto}`, 'paciente');
  }
  cliente.updated_at = new Date().toISOString();
}
