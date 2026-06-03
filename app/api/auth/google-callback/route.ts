import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAppBaseUrl } from '@/lib/appUrl';
import {
  appRedirectUrl,
  cookieNameForIncrementalScope,
  safeAppRedirectPath,
  verifyIncrementalOAuthState,
} from '@/lib/googleIncrementalOAuth';

/**
 * Callback OAuth incremental: exige sessão e state assinado com o mesmo googleSub.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const stateRaw = searchParams.get('state');
  const googleError = searchParams.get('error');

  const baseUrl = getAppBaseUrl(req);
  const signed = verifyIncrementalOAuthState(stateRaw);
  const redirectTo = safeAppRedirectPath(signed?.redirectTo, baseUrl);

  const redirectWithParam = (params: Record<string, string>) =>
    NextResponse.redirect(appRedirectUrl(baseUrl, redirectTo, params));

  if (googleError) {
    console.error('[google-callback] Erro do Google:', googleError);
    return redirectWithParam({ google_error: googleError });
  }

  const session = await auth();
  if (!session?.googleSub || !session?.user?.email) {
    const loginUrl = new URL('/login', baseUrl);
    loginUrl.searchParams.set('callbackUrl', redirectTo);
    loginUrl.searchParams.set('google_error', 'sessao_expirada');
    return NextResponse.redirect(loginUrl);
  }

  if (!signed) {
    return redirectWithParam({
      google_error: 'Link de autorização inválido ou expirado. Tente conectar novamente.',
    });
  }

  if (signed.googleSub !== session.googleSub) {
    return redirectWithParam({
      google_error: 'Esta autorização pertence a outra sessão. Entre com a mesma conta e tente de novo.',
    });
  }

  if (!code) {
    return NextResponse.json(
      { error: 'Código de autorização não recebido' },
      { status: 400 },
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.AUTH_GOOGLE_SECRET;
  const redirectUri = `${baseUrl}/api/auth/google-callback`;

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId!,
        client_secret: clientSecret!,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.json();
      console.error('[google-callback] Erro ao obter token:', err);
      return redirectWithParam({
        google_error: `Falha ao autorizar: ${err.error_description || err.error || 'erro desconhecido'}`,
      });
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token as string | undefined;
    if (!accessToken) {
      return redirectWithParam({ google_error: 'Token de acesso não recebido do Google' });
    }

    const refreshToken = tokenData.refresh_token as string | undefined;
    const expiresIn = Number(tokenData.expires_in) || 3600;
    const cookieName = cookieNameForIncrementalScope(signed.scope);

    const response = redirectWithParam({ google_connected: signed.scope });

    response.cookies.set(cookieName, accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: expiresIn,
      path: '/',
    });

    if (refreshToken) {
      response.cookies.set(`${cookieName}_refresh`, refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60,
        path: '/',
      });
    }

    console.log(
      `[google-callback] Autorização incremental (${signed.scope}) para sub ${session.googleSub.slice(0, 8)}…`,
    );

    return response;
  } catch (err) {
    console.error('[google-callback] Erro inesperado:', err);
    return redirectWithParam({
      google_error: 'Erro interno ao processar autorização',
    });
  }
}
