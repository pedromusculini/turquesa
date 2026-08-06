/**
 * Eventos criados pelo Turquesa no Google levam `Cliente:` na description.
 * Bloqueios / pessoais só no Google (ex.: Rani) NÃO têm esse marcador.
 *
 * Eles DEVEM aparecer na agenda Turquesa como ocupação (horário indisponível),
 * mas NUNCA ser apagados/reescritos no Google pelo outbox.
 */

const CLIENTE_LINE = /^Cliente:\s*.+/im;

/** Marcador gravado em observacoes ao espelhar bloqueio pessoal. */
export const GOOGLE_PESSOAL_BLOQUEIO_MARKER = '[bloqueio-google]';

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
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p);
}

export function isGooglePessoalBloqueioObservacoes(
  observacoes: string | null | undefined,
): boolean {
  return String(observacoes ?? '').includes(GOOGLE_PESSOAL_BLOQUEIO_MARKER);
}

export function isGooglePessoalBloqueioConsulta(params: {
  paciente?: string | null;
  observacoes?: string | null;
  telefone?: string | null;
  googleDescription?: string | null;
}): boolean {
  if (isGooglePessoalBloqueioObservacoes(params.observacoes)) return true;
  if (
    params.googleDescription != null &&
    !googleEventDescriptionHasTurquesaCliente(params.googleDescription)
  ) {
    return true;
  }
  if (pacienteLooksLikeEmailAccount(params.paciente)) return true;
  return false;
}

/**
 * Importa tudo que ocupa horário (sessões Turquesa + bloqueios pessoais),
 * para a grade e o autoagendamento enxergarem ocupação.
 */
export function shouldImportGoogleCalendarItemAsConsulta(_params?: {
  description?: string | null;
  alreadyLinkedInTurquesa?: boolean;
}): boolean {
  return true;
}

/**
 * Soft-delete / exclusão no Turquesa NÃO deve apagar o evento no Google se
 * for bloqueio pessoal / espelho de ocupação.
 */
export function shouldDeleteGoogleEventForConsulta(params: {
  paciente: string | null | undefined;
  telefone?: string | null;
  observacoes?: string | null;
  googleDescription?: string | null;
}): boolean {
  if (isGooglePessoalBloqueioConsulta(params)) return false;
  if (googleEventDescriptionHasTurquesaCliente(params.googleDescription)) {
    return true;
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
  return true;
}

/** Outbox sync não deve PATCH/recriar bloqueios pessoais no Google. */
export function shouldPushConsultaToGoogle(params: {
  paciente?: string | null;
  observacoes?: string | null;
  telefone?: string | null;
}): boolean {
  return !isGooglePessoalBloqueioConsulta(params);
}
