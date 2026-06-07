import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { encryptSecret, decryptSecret } from '@/lib/tokenEncryption';
import { refreshGoogleAccessToken } from '@/lib/profissionalGoogleCalendar';

export type OwnerGoogleScope = 'drive' | 'calendar' | 'contacts';

export type OwnerGoogleScopes = Record<OwnerGoogleScope, boolean>;

export type OwnerGoogleRow = {
  google_sub: string;
  scopes: OwnerGoogleScopes;
  refresh_token_encrypted: string;
  access_token_cache: string | null;
  access_token_expires_at: string | null;
  connected_at: string;
  updated_at: string;
};

const EMPTY_SCOPES: OwnerGoogleScopes = {
  drive: false,
  calendar: false,
  contacts: false,
};

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

function normalizeScopes(input: Partial<OwnerGoogleScopes> | null | undefined): OwnerGoogleScopes {
  return {
    drive: !!input?.drive,
    calendar: !!input?.calendar,
    contacts: !!input?.contacts,
  };
}

function mergeScopes(
  existing: OwnerGoogleScopes,
  granted: OwnerGoogleScope[],
): OwnerGoogleScopes {
  const next = { ...existing };
  for (const s of granted) {
    next[s] = true;
  }
  return next;
}

function scopesFromIncremental(
  scope: OwnerGoogleScope | 'all',
): OwnerGoogleScope[] {
  if (scope === 'all') return ['drive', 'calendar', 'contacts'];
  return [scope];
}

export async function getOwnerGoogleRow(
  googleSub: string,
): Promise<OwnerGoogleRow | null> {
  const { data, error } = await supabaseAdmin
    .from('owner_google_integracao')
    .select('*')
    .eq('google_sub', googleSub)
    .maybeSingle();

  if (error) {
    console.error('[ownerGoogleTokens] getRow:', error);
    return null;
  }
  if (!data) return null;

  return {
    ...(data as Omit<OwnerGoogleRow, 'scopes'>),
    scopes: normalizeScopes(data.scopes as Partial<OwnerGoogleScopes>),
  };
}

export async function saveOwnerGoogleTokens(
  googleSub: string,
  refreshToken: string,
  grantedScopes: OwnerGoogleScope[] | 'all',
): Promise<void> {
  const scopesToGrant =
    grantedScopes === 'all'
      ? (['drive', 'calendar', 'contacts'] as OwnerGoogleScope[])
      : grantedScopes;

  const existing = await getOwnerGoogleRow(googleSub);
  const scopes = mergeScopes(existing?.scopes ?? EMPTY_SCOPES, scopesToGrant);
  const encrypted = encryptSecret(refreshToken);
  const now = new Date().toISOString();

  const { error } = await supabaseAdmin.from('owner_google_integracao').upsert(
    {
      google_sub: googleSub,
      scopes,
      refresh_token_encrypted: encrypted,
      access_token_cache: null,
      access_token_expires_at: null,
      connected_at: existing?.connected_at ?? now,
      updated_at: now,
    },
    { onConflict: 'google_sub' },
  );

  if (error) throw error;
}

async function cacheAccessToken(
  googleSub: string,
  accessToken: string,
  expiresIn: number,
): Promise<void> {
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  await supabaseAdmin
    .from('owner_google_integracao')
    .update({
      access_token_cache: accessToken,
      access_token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('google_sub', googleSub);
}

function isCachedTokenValid(row: OwnerGoogleRow): boolean {
  if (!row.access_token_cache || !row.access_token_expires_at) return false;
  return (
    new Date(row.access_token_expires_at).getTime() - TOKEN_REFRESH_BUFFER_MS > Date.now()
  );
}

/** Renova access token via refresh token armazenado; retorna null se escopo não concedido. */
export async function getOwnerGoogleAccessToken(
  googleSub: string,
  scope: OwnerGoogleScope,
): Promise<string | null> {
  const row = await getOwnerGoogleRow(googleSub);
  if (!row?.refresh_token_encrypted || !row.scopes[scope]) return null;

  if (isCachedTokenValid(row)) {
    return row.access_token_cache!;
  }

  const refreshToken = decryptSecret(row.refresh_token_encrypted);
  const { accessToken, expiresIn } = await refreshGoogleAccessToken(refreshToken);
  await cacheAccessToken(googleSub, accessToken, expiresIn);
  return accessToken;
}

export async function getOwnerGoogleConnectionStatus(
  googleSub: string,
): Promise<OwnerGoogleScopes & { connected: boolean }> {
  const row = await getOwnerGoogleRow(googleSub);
  if (!row?.refresh_token_encrypted) {
    return { ...EMPTY_SCOPES, connected: false };
  }
  return { ...row.scopes, connected: true };
}

export function ownerNeedsOAuthConsent(
  row: OwnerGoogleRow | null,
  requested: OwnerGoogleScope | 'all',
): boolean {
  if (!row?.refresh_token_encrypted) return true;
  const needed = scopesFromIncremental(requested);
  return needed.some((s) => !row.scopes[s]);
}

const COOKIE_REFRESH_MAP: Record<OwnerGoogleScope, string> = {
  drive: 'google_drive_token_refresh',
  calendar: 'google_calendar_token_refresh',
  contacts: 'google_contacts_token_refresh',
};

/** Migra refresh tokens legados dos cookies para Supabase (uma vez). */
export async function migrateOwnerTokensFromCookies(
  req: NextRequest,
  googleSub: string,
): Promise<void> {
  const existing = await getOwnerGoogleRow(googleSub);
  if (existing?.refresh_token_encrypted) return;

  let refreshToken: string | undefined;
  const granted: OwnerGoogleScope[] = [];

  for (const scope of ['drive', 'calendar', 'contacts'] as OwnerGoogleScope[]) {
    const val = req.cookies.get(COOKIE_REFRESH_MAP[scope])?.value;
    if (val) {
      refreshToken = val;
      granted.push(scope);
    }
  }

  if (!refreshToken || !granted.length) return;

  try {
    await saveOwnerGoogleTokens(googleSub, refreshToken, granted);
    console.log(
      `[ownerGoogleTokens] Migrados cookies → Supabase para sub ${googleSub.slice(0, 8)}… (${granted.join(', ')})`,
    );
  } catch (err) {
    console.error('[ownerGoogleTokens] migrateFromCookies:', err);
  }
}
