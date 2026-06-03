import { NextRequest, NextResponse } from 'next/server';
import { getAppBaseUrl, getGoogleOAuthRedirectUris } from '@/lib/appUrl';
import { CANONICAL_APP_URL } from '@/lib/constants';

/**
 * Lista as URIs de redirecionamento que devem estar no Google Cloud Console.
 * Abra no navegador na mesma URL em que você usa o app (mesma porta/host).
 */
export async function GET(req: NextRequest) {
  const baseUrl = getAppBaseUrl(req);
  const uris = getGoogleOAuthRedirectUris(baseUrl);

  return NextResponse.json({
    baseUrl,
    canonicalUrl: CANONICAL_APP_URL,
    envAuthUrl: process.env.AUTH_URL || process.env.NEXTAUTH_URL || null,
    redirectUris: [uris.nextAuthLogin, uris.calendarDrive],
    productionRedirectUris: getGoogleOAuthRedirectUris(CANONICAL_APP_URL),
    flows: {
      loginGoogle: uris.nextAuthLogin,
      conectarCalendarOuDrive: uris.calendarDrive,
    },
    googleConsole: 'https://console.cloud.google.com/apis/credentials',
    dica:
      'Copie redirectUris para "Authorized redirect URIs" do OAuth Client. Devem ser idênticas (sem barra no final).',
  });
}
