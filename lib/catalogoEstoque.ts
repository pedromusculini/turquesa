import { supabaseAdmin } from '@/lib/supabaseClient';
import type { AtendimentoItemLinha } from '@/lib/atendimentoItens';

export class EstoqueInsuficienteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EstoqueInsuficienteError';
  }
}

function aggregateProdutoQuantities(itens: AtendimentoItemLinha[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of itens) {
    if (item.tipo !== 'produto') continue;
    const id = item.catalogoId.trim();
    if (!id) continue;
    map.set(id, (map.get(id) ?? 0) + Math.max(1, item.quantidade));
  }
  return map;
}

async function loadProdutosComEstoque(ownerEmail: string, ids: string[]) {
  const { data, error } = await supabaseAdmin
    .from('servicos_catalogo')
    .select('id, nome, estoque, tipo')
    .eq('owner_email', ownerEmail)
    .in('id', ids);

  if (error) throw error;
  return data ?? [];
}

/** Retorna mensagem de erro ou null se estoque OK. */
export async function validarEstoqueAtendimento(
  ownerEmail: string,
  itens: AtendimentoItemLinha[],
): Promise<string | null> {
  const qtyById = aggregateProdutoQuantities(itens);
  if (qtyById.size === 0) return null;

  const rows = await loadProdutosComEstoque(ownerEmail, [...qtyById.keys()]);
  const found = new Map(rows.map((r) => [r.id, r]));

  for (const [id, needed] of qtyById) {
    const row = found.get(id);
    if (!row) {
      return 'Produto do catálogo não encontrado ou removido';
    }
    if (row.tipo !== 'produto' || row.estoque == null) continue;
    if (row.estoque < needed) {
      return `Estoque insuficiente para "${row.nome}": disponível ${row.estoque}, solicitado ${needed}`;
    }
  }
  return null;
}

/** Baixa estoque dos produtos vendidos no atendimento. Falha se insuficiente. */
export async function baixarEstoqueAtendimento(
  ownerEmail: string,
  itens: AtendimentoItemLinha[],
): Promise<void> {
  const qtyById = aggregateProdutoQuantities(itens);
  if (qtyById.size === 0) return;

  const validationError = await validarEstoqueAtendimento(ownerEmail, itens);
  if (validationError) {
    throw new EstoqueInsuficienteError(validationError);
  }

  const rows = await loadProdutosComEstoque(ownerEmail, [...qtyById.keys()]);

  for (const row of rows) {
    if (row.tipo !== 'produto' || row.estoque == null) continue;
    const needed = qtyById.get(row.id) ?? 0;
    if (needed <= 0) continue;

    const newEstoque = row.estoque - needed;
    const { data: updated, error: updError } = await supabaseAdmin
      .from('servicos_catalogo')
      .update({ estoque: newEstoque, updated_at: new Date().toISOString() })
      .eq('id', row.id)
      .eq('owner_email', ownerEmail)
      .gte('estoque', needed)
      .select('id')
      .maybeSingle();

    if (updError) throw updError;
    if (!updated) {
      throw new EstoqueInsuficienteError(
        `Estoque insuficiente para "${row.nome}" (atualizado por outro atendimento)`,
      );
    }
  }
}

/** Reverte baixa de estoque (ex.: falha ao salvar atendimento). */
export async function restaurarEstoqueAtendimento(
  ownerEmail: string,
  itens: AtendimentoItemLinha[],
): Promise<void> {
  const qtyById = aggregateProdutoQuantities(itens);
  if (qtyById.size === 0) return;

  const rows = await loadProdutosComEstoque(ownerEmail, [...qtyById.keys()]);

  for (const row of rows) {
    if (row.tipo !== 'produto' || row.estoque == null) continue;
    const qty = qtyById.get(row.id) ?? 0;
    if (qty <= 0) continue;

    const { error } = await supabaseAdmin
      .from('servicos_catalogo')
      .update({
        estoque: row.estoque + qty,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .eq('owner_email', ownerEmail);

    if (error) throw error;
  }
}

export function estoqueErrorResponse(err: unknown): { message: string; status: number } | null {
  if (err instanceof EstoqueInsuficienteError) {
    return { message: err.message, status: 400 };
  }
  return null;
}
