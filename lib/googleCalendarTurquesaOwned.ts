/**
 * Eventos criados pelo Turquesa no Google levam `Cliente:` na description.
 * Bloqueios / pessoais só no Google (ex.: Rani) NÃO têm esse marcador — e o
 * parse antigo usava o e-mail do criador como "paciente", virando consulta
 * fantasma que o outbox apagava de volta no Calendar.
 */

const CLIENTE_LINE = /^Cliente:\s*.+/im;

export function googleEventDescriptionHasTurquesaCliente(
  description: string | null | undefined,
): boolean {
  return CLIENTE_LINE.test(String(description ?? ''));
}

/** E-mail no campo paciente = tipicamente conta Google importada, não cliente. */
export function pacienteLooksLikeEmailAccount(
  paciente: string | null | undefined,
): boolean {
  const p = String(paciente ?? '').trim().toLowerCase();
  if (!p.includes('@')) return false;
  // e-mail simples; evita nomes com @ acidental
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p);
}

/**
 * Importar do Google → Turquesa só eventos do produto (marcador Cliente:)
 * ou já vinculados a uma linha existente (atualização).
 */
export function shouldImportGoogleCalendarItemAsConsulta(params: {
  description?: string | null;
  alreadyLinkedInTurquesa: boolean;
}): boolean {
  if (params.alreadyLinkedInTurquesa) return true;
  return googleEventDescriptionHasTurquesaCliente(params.description);
}

/**
 * Soft-delete / exclusão no Turquesa NÃO deve apagar o evento no Google se
 * a linha parece bloqueio pessoal importado por engano.
 */
export function shouldDeleteGoogleEventForConsulta(params: {
  paciente: string | null | undefined;
  telefone?: string | null;
  /** Description do evento Google, se já buscada. */
  googleDescription?: string | null;
}): boolean {
  if (googleEventDescriptionHasTurquesaCliente(params.googleDescription)) {
    return true;
  }
  if (pacienteLooksLikeEmailAccount(params.paciente)) {
    return false;
  }
  const generic = String(params.paciente ?? '')
    .trim()
    .toLowerCase();
  if (
    (!generic || generic === 'cliente' || generic === 'novo cliente') &&
    !String(params.telefone ?? '').replace(/\D/g, '')
  ) {
    return false;
  }
  // Sem description: assume Turquesa (sessões normais têm nome de cliente).
  return true;
}
