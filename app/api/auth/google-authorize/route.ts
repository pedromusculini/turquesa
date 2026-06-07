import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAppBaseUrl } from '@/lib/appUrl';
import {
  googleScopeParamForIncremental,
  parseIncrementalOAuthScope,
  safeAppRedirectPath,
  signIncrementalOAuthState,
} from '@/lib/googleIncrementalOAuth';
import { getOwnerGoogleRow, ownerNeedsOAuthConsent } from '@/lib/ownerGoogleTokens';

/**
 * Inicia autorização incremental do Google (requer sessão).
 * State assinado com googleSub + redirect interno (anti open-redirect / token fixation).
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.googleSub || !session?.user?.email) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('callbackUrl', req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  const { searchParams } = new URL(req.url);
  const scopeRaw = searchParams.get('scope');
  const scope = parseIncrementalOAuthScope(scopeRaw) ?? 'all';

  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.AUTH_GOOGLE_ID;
  if (!clientId) {
    return NextResponse.json({ error: 'Google OAuth não configurado' }, { status: 503 });
  }

  const baseUrl = getAppBaseUrl(req);
  const redirectTo = safeAppRedirectPath(searchParams.get('redirect'), baseUrl);
  const redirectUri = `${baseUrl}/api/auth/google-callback`;

  let state: string;
  try {
    state = signIncrementalOAuthState({
      redirectTo,
      scope,
      googleSub: session.googleSub,
    });
  } catch (err) {
    console.error('[google-authorize] state:', err);
    return NextResponse.json({ error: 'Configuração de autenticação incompleta' }, { status: 503 });
  }

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', googleScopeParamForIncremental(scope));
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('include_granted_scopes', 'true');

  const existingRow = await getOwnerGoogleRow(session.googleSub);
  if (ownerNeedsOAuthConsent(existingRow, scope)) {
    authUrl.searchParams.set('prompt', 'consent');
  }

  authUrl.searchParams.set('state', state);

  return NextResponse.redirect(authUrl.toString());
}
