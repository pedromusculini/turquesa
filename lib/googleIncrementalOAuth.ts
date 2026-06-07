import { createHmac, timingSafeEqual } from 'crypto';

const STATE_TTL_MS = 15 * 60 * 1000;

export type IncrementalOAuthScope = 'calendar' | 'drive' | 'contacts' | 'all';

export type SignedIncrementalOAuthState = {
  redirectTo: string;
  scope: IncrementalOAuthScope;
  googleSub: string;
  exp: number;
};

function oauthStateSecret(): string {
  const secret = process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();
  if (!secret) {
    throw new Error('AUTH_SECRET ou NEXTAUTH_SECRET é obrigatório para OAuth incremental');
  }
  return secret;
}

/** Aceita apenas paths relativos no mesmo host (bloqueia open redirect). */
export function safeAppRedirectPath(
  redirect: string | null | undefined,
  baseUrl: string,
): string {
  let raw = (redirect ?? '/dashboard').trim();
  if (!raw) return '/dashboard';

  try {
    raw = decodeURIComponent(raw);
  } catch {
    return '/dashboard';
  }

  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) {
    return '/dashboard';
  }

  try {
    const resolved = new URL(raw, baseUrl);
    const base = new URL(baseUrl);
    if (resolved.origin !== base.origin) return '/dashboard';
    return resolved.pathname + resolved.search;
  } catch {
    return '/dashboard';
  }
}

export function parseIncrementalOAuthScope(
  scope: string | null,
): IncrementalOAuthScope | null {
  if (
    scope === 'calendar' ||
    scope === 'drive' ||
    scope === 'contacts' ||
    scope === 'all'
  ) {
    return scope;
  }
  return null;
}

/** Todos os escopos do titular em uma única autorização. */
export function googleAllOwnerScopesParam(): string {
  return [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/contacts.readonly',
  ].join(' ');
}

export function googleScopeParamForIncremental(scope: IncrementalOAuthScope): string {
  if (scope === 'all') {
    return googleAllOwnerScopesParam();
  }
  if (scope === 'calendar') {
    return 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly';
  }
  if (scope === 'drive') {
    return 'https://www.googleapis.com/auth/drive.file';
  }
  return 'https://www.googleapis.com/auth/contacts.readonly';
}

export function cookieNameForIncrementalScope(scope: IncrementalOAuthScope): string {
  if (scope === 'calendar') return 'google_calendar_token';
  if (scope === 'drive') return 'google_drive_token';
  if (scope === 'contacts') return 'google_contacts_token';
  return 'google_drive_token';
}

/** Escopos concedidos no callback OAuth incremental / unificado. */
export function ownerScopesGrantedFromOAuth(
  scope: IncrementalOAuthScope,
): Array<'drive' | 'calendar' | 'contacts'> {
  if (scope === 'all') return ['drive', 'calendar', 'contacts'];
  return [scope];
}

export function signIncrementalOAuthState(input: {
  redirectTo: string;
  scope: IncrementalOAuthScope;
  googleSub: string;
}): string {
  const payload: SignedIncrementalOAuthState = {
    redirectTo: input.redirectTo,
    scope: input.scope,
    googleSub: input.googleSub,
    exp: Date.now() + STATE_TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', oauthStateSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyIncrementalOAuthState(
  state: string | null | undefined,
): SignedIncrementalOAuthState | null {
  if (!state?.includes('.')) return null;

  const dot = state.lastIndexOf('.');
  const body = state.slice(0, dot);
  const sig = state.slice(dot + 1);
  if (!body || !sig) return null;

  const expected = createHmac('sha256', oauthStateSecret()).update(body).digest('base64url');
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf-8'),
    ) as SignedIncrementalOAuthState;

    if (
      !parsed?.googleSub ||
      !parsed.scope ||
      !parsed.redirectTo ||
      typeof parsed.exp !== 'number'
    ) {
      return null;
    }
    if (parsed.exp < Date.now()) return null;
    if (!parseIncrementalOAuthScope(parsed.scope)) return null;

    return parsed;
  } catch {
    return null;
  }
}

export function appRedirectUrl(
  baseUrl: string,
  path: string,
  params?: Record<string, string>,
): URL {
  const url = new URL(path, baseUrl);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }
  return url;
}
