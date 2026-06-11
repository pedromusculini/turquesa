/** URLs públicas do formulário de cadastro (/f) e vitrine de catálogo (/c). */

export function getPublicAppBaseUrl(): string {
  return process.env.NEXTAUTH_URL || 'http://localhost:3000';
}

export function buildFormularioPublicPath(token: string): string {
  return `/f/${token}`;
}

/** Ficha read-only para profissional (anamnese + histórico), com login do salão/equipe. */
export function buildClienteFichaProfissionalPath(token: string): string {
  return `/f/${token}?view=profissional`;
}

export function buildCatalogoPublicPath(token: string): string {
  return `/c/${token}`;
}

export function buildFormularioPublicUrl(token: string, baseUrl?: string): string {
  const base = baseUrl ?? getPublicAppBaseUrl();
  return `${base}${buildFormularioPublicPath(token)}`;
}

export function buildClienteFichaProfissionalUrl(token: string, baseUrl?: string): string {
  const base = baseUrl ?? getPublicAppBaseUrl();
  return `${base}${buildClienteFichaProfissionalPath(token)}`;
}

export function buildCatalogoPublicUrl(token: string, baseUrl?: string): string {
  const base = baseUrl ?? getPublicAppBaseUrl();
  return `${base}${buildCatalogoPublicPath(token)}`;
}
