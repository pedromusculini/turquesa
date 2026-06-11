import { supabaseAdmin } from '@/lib/supabaseClient';
import {
  buildLegacyServicoCatalog,
  isLegacyCatalogOwner,
  type LegacyServicoCatalog,
} from '@/lib/legacyProcedimentoCatalog';

export async function loadLegacyServicoCatalogForOwner(
  ownerEmail: string,
): Promise<LegacyServicoCatalog | null> {
  if (!isLegacyCatalogOwner(ownerEmail)) return null;

  const email = ownerEmail.toLowerCase().trim();

  const [catalogoRes, financeiroRes, consultasRes] = await Promise.all([
    supabaseAdmin
      .from('servicos_catalogo')
      .select('nome, tipo, ativo')
      .eq('owner_email', email)
      .eq('ativo', true),
    supabaseAdmin
      .from('financeiro_transacoes')
      .select('descricao')
      .eq('owner_email', email)
      .eq('tipo', 'entrada'),
    supabaseAdmin
      .from('consultas_agenda')
      .select('paciente')
      .eq('owner_email', email),
  ]);

  const catalogoServicos =
    catalogoRes.data
      ?.filter((r) => r.tipo === 'servico' || r.tipo == null)
      .map((r) => String(r.nome ?? '').trim())
      .filter(Boolean) ?? [];

  const financeiroDescricoes =
    financeiroRes.data
      ?.map((r) => String(r.descricao ?? '').trim())
      .filter(Boolean) ?? [];

  const clienteNomes = new Set<string>();
  for (const row of consultasRes.data ?? []) {
    const n = String(row.paciente ?? '').trim();
    if (n) clienteNomes.add(n);
  }

  return buildLegacyServicoCatalog({
    catalogoServicos,
    financeiroDescricoes,
    clienteNomes: [...clienteNomes],
  });
}
