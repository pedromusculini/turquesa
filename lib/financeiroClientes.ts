function isCatalogoSegment(s: string): boolean {
  return /^(Serviço|Produto):/i.test(s.trim());
}

/** Extrai procedimento/serviço (antes do traço) em "Procedimento — Cliente". */
export function extractProcedimentoFromDescricao(descricao: string): string | null {
  const trimmed = descricao.trim();
  if (!trimmed) return null;

  for (const sep of [' — ', ' - ']) {
    const partes = trimmed.split(sep);
    if (partes.length >= 2) {
      const proc = partes[0]?.trim();
      if (proc && !isCatalogoSegment(proc)) return proc;
    }
  }
  return null;
}

/** Extrai nome do cliente a partir da descrição de uma entrada financeira. */
export function extractClienteFromDescricao(
  descricao: string,
  tipo: 'entrada' | 'saida',
): string | null {
  if (tipo !== 'entrada') return null;
  const trimmed = descricao.trim();
  if (!trimmed) return null;

  // Cadeia do app: Tipo - Itens - Cliente - Forma (separador " - ")
  const dashParts = trimmed.split(' - ');
  if (dashParts.length >= 3) {
    const candidate = dashParts[2]?.trim();
    if (candidate && !isCatalogoSegment(candidate)) {
      return candidate;
    }
  }

  // Import Marrissa / simples: "Procedimento — Cliente"
  for (const sep of [' — ', ' - ']) {
    const partes = trimmed.split(sep);
    if (partes.length >= 2) {
      const candidate = partes[1]?.trim();
      if (candidate && !isCatalogoSegment(candidate)) {
        return candidate;
      }
    }
  }
  return null;
}
