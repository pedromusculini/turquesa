import type { FaturamentoDriveStore } from '@/lib/clientesDrive';
import {
  listFinanceiroTransacoes,
  listSplitsForTransacoes,
} from '@/lib/financeiroList';

/** Reconstrói faturamento.json a partir do Supabase (fonte primária). */
export async function buildFullFaturamentoStoreFromSupabase(
  ownerEmail: string,
): Promise<FaturamentoDriveStore> {
  const owner = ownerEmail.toLowerCase().trim();
  const transacoes = await listFinanceiroTransacoes(owner);
  const entradaIds = transacoes
    .filter((t) => t.tipo === 'entrada')
    .map((t) => String(t.id));

  const splits = await listSplitsForTransacoes(entradaIds);
  const splitsByTx = new Map<string, unknown[]>();
  for (const split of splits) {
    const tid = String(split.transacao_id);
    if (!splitsByTx.has(tid)) splitsByTx.set(tid, []);
    splitsByTx.get(tid)!.push(split);
  }

  const hydrated = transacoes.map((t) => ({
    ...t,
    splits: splitsByTx.get(String(t.id)) ?? [],
  }));

  return {
    version: 1,
    owner_email: owner,
    atualizado_em: new Date().toISOString(),
    transacoes: hydrated,
  };
}
