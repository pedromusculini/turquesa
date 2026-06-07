/** Extrai nome do cliente a partir da descrição de uma entrada financeira. */
export function extractClienteFromDescricao(
  descricao: string,
  tipo: 'entrada' | 'saida',
): string | null {
  if (tipo !== 'entrada') return null;
  const trimmed = descricao.trim();
  if (!trimmed) return null;

  for (const sep of [' — ', ' - ']) {
    const partes = trimmed.split(sep);
    if (partes.length >= 2) {
      const candidate = partes[1]?.trim();
      if (candidate) return candidate;
    }
  }
  return null;
}
