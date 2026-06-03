import type { NextRequest } from 'next/server';

/** Origem da requisição atual (host + protocolo). */
export function getOriginFromRequest(req: NextRequest): string {
  const forwardedHost = req.headers.get('x-forwarded-host');
  const forwardedProto = req.headers.get('x-forwarded-proto');
  if (forwardedHost) {
    const proto = forwardedProto || 'https';
    return `${proto}://${forwardedHost}`;
  }
  const host = req.headers.get('host');
  if (host) {
    const proto = req.nextUrl.protocol.replace(':', '') || 'http';
    return `${proto}://${host}`;
  }
  return req.nextUrl.origin;
}

/**
 * URL base do app para OAuth.
 * Em desenvolvimento usa a origem da requisição (evita mismatch de porta/host).
 * Em produção usa AUTH_URL / NEXTAUTH_URL quando configurado.
 */
export function getAppBaseUrl(req?: NextRequest): string {
  const fromEnv = process.env.AUTH_URL || process.env.NEXTAUTH_URL;

  if (req) {
    const origin = getOriginFromRequest(req);
    if (process.env.NODE_ENV !== 'production') {
      return origin.replace(/\/$/, '');
    }
    if (!fromEnv) {
      return origin.replace(/\/$/, '');
    }
    try {
      const envHost = new URL(fromEnv).host;
      const reqHost = new URL(origin).host;
      if (envHost !== reqHost) {
        return origin.replace(/\/$/, '');
      }
    } catch {
      return origin.replace(/\/$/, '');
    }
  }

  return (fromEnv || 'http://localhost:3000').replace(/\/$/, '');
}

export function getGoogleOAuthRedirectUris(baseUrl: string): {
  nextAuthLogin: string;
  calendarDrive: string;
} {
  const base = baseUrl.replace(/\/$/, '');
  return {
    nextAuthLogin: `${base}/api/auth/callback/google`,
    calendarDrive: `${base}/api/auth/google-callback`,
  };
}
