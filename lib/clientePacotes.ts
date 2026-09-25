import type { ClientePacote, ClientePacoteUso } from '@/lib/types';

/** Forma de pagamento gravada quando a sessão é descontada de um pacote já pago. */
export const FORMA_PAGAMENTO_PACOTE = 'pacote';

export type PacoteRecordHolder = { id: string; pacotes?: ClientePacote[] };

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function sessoesRestantes(p: ClientePacote): number {
  return Math.max(0, p.sessoes_total - p.usos.length);
}

export function pacoteVencido(p: ClientePacote, hoje = hojeIso()): boolean {
  return Boolean(p.validade && p.validade < hoje);
}

export function pacoteDisponivel(p: ClientePacote, hoje = hojeIso()): boolean {
  return p.status === 'ativo' && sessoesRestantes(p) > 0 && !pacoteVencido(p, hoje);
}

export function pacotesDisponiveis(cliente: PacoteRecordHolder): ClientePacote[] {
  return (cliente.pacotes ?? []).filter((p) => pacoteDisponivel(p));
}

export type CriarPacoteInput = {
  nome: string;
  servico_catalogo_id?: string | null;
  sessoes_total: number;
  valor_total: number;
  forma_pagamento: string;
  parcelas?: number;
  medico?: string | null;
  validade?: string | null;
  observacao?: string | null;
  data_venda?: string | null;
};

export function validarCriarPacote(body: Record<string, unknown>): CriarPacoteInput | string {
  const nome = String(body.nome ?? '').trim();
  if (nome.length < 2) return 'Informe o nome do pacote';
  const sessoes = Math.floor(Number(body.sessoes_total));
  if (!Number.isFinite(sessoes) || sessoes < 1 || sessoes > 200) {
    return 'Quantidade de sessões deve ser entre 1 e 200';
  }
  const valor = Number(body.valor_total);
  if (!Number.isFinite(valor) || valor < 0) return 'Valor do pacote inválido';
  const forma = String(body.forma_pagamento ?? '').trim();
  if (!forma) return 'Informe a forma de pagamento';
  const validade = body.validade ? String(body.validade).slice(0, 10) : null;
  if (validade && !/^\d{4}-\d{2}-\d{2}$/.test(validade)) return 'Validade inválida';
  const dataVenda = body.data_venda ? String(body.data_venda).slice(0, 10) : null;

  return {
    nome,
    servico_catalogo_id: body.servico_catalogo_id ? String(body.servico_catalogo_id) : null,
    sessoes_total: sessoes,
    valor_total: Math.round(valor * 100) / 100,
    forma_pagamento: forma,
    parcelas: Math.max(1, Math.floor(Number(body.parcelas) || 1)),
    medico: body.medico ? String(body.medico).trim() : null,
    validade,
    observacao: body.observacao ? String(body.observacao).trim() : null,
    data_venda: dataVenda,
  };
}

export function criarPacote(cliente: PacoteRecordHolder, input: CriarPacoteInput): ClientePacote {
  const now = new Date().toISOString();
  const pacote: ClientePacote = {
    id: crypto.randomUUID(),
    cliente_id: cliente.id,
    nome: input.nome,
    servico_catalogo_id: input.servico_catalogo_id ?? null,
    sessoes_total: input.sessoes_total,
    valor_total: input.valor_total,
    forma_pagamento: input.forma_pagamento,
    parcelas: input.parcelas ?? 1,
    medico: input.medico ?? null,
    validade: input.validade ?? null,
    observacao: input.observacao ?? null,
    data_venda: input.data_venda ?? hojeIso(),
    status: 'ativo',
    usos: [],
    created_at: now,
    updated_at: now,
  };
  if (!cliente.pacotes) cliente.pacotes = [];
  cliente.pacotes.unshift(pacote);
  return pacote;
}

export class PacoteError extends Error {}

/** Desconta 1 sessão. Lança PacoteError se o pacote não existe, acabou, venceu ou foi cancelado. */
export function usarSessaoPacote(
  cliente: PacoteRecordHolder,
  pacoteId: string,
  uso: { atendimento_id: string | null; data: string; medico?: string | null },
): { pacote: ClientePacote; uso: ClientePacoteUso } {
  const pacote = (cliente.pacotes ?? []).find((p) => p.id === pacoteId);
  if (!pacote) throw new PacoteError('Pacote não encontrado nesta cliente');
  if (pacote.status === 'cancelado') throw new PacoteError('Este pacote foi cancelado');
  if (pacote.status === 'concluido' || sessoesRestantes(pacote) <= 0) {
    throw new PacoteError('Este pacote não tem sessões restantes');
  }
  if (pacoteVencido(pacote)) throw new PacoteError('Este pacote está vencido');

  const item: ClientePacoteUso = {
    id: crypto.randomUUID(),
    atendimento_id: uso.atendimento_id,
    data: uso.data,
    medico: uso.medico ?? null,
    created_at: new Date().toISOString(),
  };
  pacote.usos.push(item);
  pacote.updated_at = item.created_at;
  if (sessoesRestantes(pacote) === 0) pacote.status = 'concluido';
  return { pacote, uso: item };
}

export function estornarUsoPacote(
  cliente: PacoteRecordHolder,
  pacoteId: string,
  usoId: string,
): ClientePacote {
  const pacote = (cliente.pacotes ?? []).find((p) => p.id === pacoteId);
  if (!pacote) throw new PacoteError('Pacote não encontrado nesta cliente');
  const idx = pacote.usos.findIndex((u) => u.id === usoId);
  if (idx < 0) throw new PacoteError('Uso não encontrado neste pacote');
  pacote.usos.splice(idx, 1);
  if (pacote.status === 'concluido') pacote.status = 'ativo';
  pacote.updated_at = new Date().toISOString();
  return pacote;
}

export function cancelarPacote(cliente: PacoteRecordHolder, pacoteId: string): ClientePacote {
  const pacote = (cliente.pacotes ?? []).find((p) => p.id === pacoteId);
  if (!pacote) throw new PacoteError('Pacote não encontrado nesta cliente');
  pacote.status = 'cancelado';
  pacote.updated_at = new Date().toISOString();
  return pacote;
}

export function formatPacoteResumo(p: ClientePacote): string {
  return `${p.nome} — ${sessoesRestantes(p)} de ${p.sessoes_total} restante(s)`;
}
