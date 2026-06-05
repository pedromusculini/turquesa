import { NextRequest, NextResponse } from 'next/server';
import { getAppBaseUrl } from '@/lib/appUrl';
import { saveProfissionalCalendarConnection } from '@/lib/profissionalGoogleCalendar';
import { verifyProfissionalOAuthState } from '@/lib/profissionalOAuthState';

/**
 * Callback OAuth da profissional: persiste refresh token criptografado.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const stateRaw = searchParams.get('state');
  const googleError = searchParams.get('error');

  const baseUrl = getAppBaseUrl(req);
  const signed = verifyProfissionalOAuthState(stateRaw);

  const successUrl = (inviteToken: string) =>
    new URL(`/convite/agenda/${inviteToken}`, baseUrl);

  const errorUrl = (inviteToken: string | null, message: string) => {
    const path = inviteToken ? `/convite/agenda/${inviteToken}` : '/convite/agenda/erro';
    const url = new URL(path, baseUrl);
    url.searchParams.set('erro', message);
    return url;
  };

  if (googleError) {
    console.error('[profissional-google-callback] Google:', googleError);
    return NextResponse.redirect(
      errorUrl(signed?.inviteToken ?? null, 'Autorização cancelada ou negada'),
    );
  }

  if (!signed) {
    return NextResponse.redirect(
      errorUrl(null, 'Link de autorização inválido ou expirado'),
    );
  }

  if (!code) {
    return NextResponse.json({ error: 'Código de autorização não recebido' }, { status: 400 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.AUTH_GOOGLE_SECRET;
  const redirectUri = `${baseUrl}/api/auth/profissional-google-callback`;

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
      console.error('[profissional-google-callback] token:', err);
      return NextResponse.redirect(
        errorUrl(
          signed.inviteToken,
          err.error_description || err.error || 'Falha ao autorizar',
        ),
      );
    }

    const tokenData = await tokenRes.json();
    const refreshToken = tokenData.refresh_token as string | undefined;
    if (!refreshToken) {
      return NextResponse.redirect(
        errorUrl(
          signed.inviteToken,
          'O Google não enviou permissão permanente. Tente autorizar novamente.',
        ),
      );
    }

    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userInfo = userInfoRes.ok ? await userInfoRes.json() : {};
    const googleSub = (userInfo.sub as string | undefined) || 'unknown';

    await saveProfissionalCalendarConnection({
      profissionalId: signed.profissionalId,
      inviteToken: signed.inviteToken,
      googleSub,
      refreshToken,
    });

    const url = successUrl(signed.inviteToken);
    url.searchParams.set('conectado', '1');
    return NextResponse.redirect(url);
  } catch (err) {
    console.error('[profissional-google-callback]', err);
    return NextResponse.redirect(
      errorUrl(signed.inviteToken, 'Erro interno ao processar autorização'),
    );
  }
}
