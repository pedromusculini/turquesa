/** Escopos Google API do titular (Drive, Calendar, Contatos). */
export const GOOGLE_OWNER_API_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/contacts.readonly',
] as const;

/** Todos os escopos do titular em uma única autorização (login ou incremental `all`). */
export function googleAllOwnerScopesParam(): string {
  return GOOGLE_OWNER_API_SCOPES.join(' ');
}

/** Escopos completos no login NextAuth (um único consentimento). */
export function googleLoginScopeParam(): string {
  return ['openid', 'email', 'profile', ...GOOGLE_OWNER_API_SCOPES].join(' ');
}
