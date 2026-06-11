import { NextRequest, NextResponse } from 'next/server';

export type MiddlewareGateKind = 'email' | 'onboarding' | 'subscription';

const COOKIE_PREFIX = 'mw_gate_';

const TTL_SEC: Record<MiddlewareGateKind, number> = {
  email: 5 * 60,
  onboarding: 10 * 60,
  subscription: 10 * 60,
};

type TokenPayload = {
  sub: string;
  email: string;
  purpose: string;
  exp: number;
};

function cookieName(kind: MiddlewareGateKind): string {
  return `${COOKIE_PREFIX}${kind}`;
}

function authSecret(): string {
  const secret = process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();
  if (!secret) throw new Error('AUTH_SECRET é obrigatório para cache do middleware');
  return secret;
}

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

function encodeBase64Url(data: string): string {
  const bytes = new TextEncoder().encode(data);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeBase64Url(data: string): string {
  const padded = data.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  const pad = padded + '='.repeat(padLen);
  const binary = atob(pad);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function hmacSha256(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return encodeBase64Url(String.fromCharCode(...new Uint8Array(sig)));
}

async function createGateToken(
  kind: MiddlewareGateKind,
  googleSub: string,
  email: string,
): Promise<string> {
  const payload: TokenPayload = {
    sub: googleSub,
    email: normalizeEmail(email),
    purpose: `mw_gate_${kind}`,
    exp: Math.floor(Date.now() / 1000) + TTL_SEC[kind],
  };
  const body = encodeBase64Url(JSON.stringify(payload));
  const sig = await hmacSha256(body, authSecret());
  return `${body}.${sig}`;
}

async function verifyGateToken(
  token: string,
  kind: MiddlewareGateKind,
  googleSub: string,
  email: string,
): Promise<boolean> {
  const dot = token.indexOf('.');
  if (dot <= 0) return false;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = await hmacSha256(body, authSecret());
  if (sig !== expected) return false;
  try {
    const payload = JSON.parse(decodeBase64Url(body)) as TokenPayload;
    return (
      payload.purpose === `mw_gate_${kind}` &&
      payload.sub === googleSub &&
      payload.email === normalizeEmail(email) &&
      payload.exp >= Math.floor(Date.now() / 1000)
    );
  } catch {
    return false;
  }
}

/** Cache positivo apenas — ausência ou token inválido exige consulta ao banco. */
export async function readMiddlewareGateCache(
  req: NextRequest,
  kind: MiddlewareGateKind,
  googleSub: string,
  email: string,
): Promise<boolean> {
  const token = req.cookies.get(cookieName(kind))?.value;
  if (!token) return false;
  return verifyGateToken(token, kind, googleSub, email);
}

export async function attachMiddlewareGateCache(
  res: NextResponse,
  kind: MiddlewareGateKind,
  googleSub: string,
  email: string,
): Promise<void> {
  const token = await createGateToken(kind, googleSub, email);
  res.cookies.set(cookieName(kind), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: TTL_SEC[kind],
    path: '/',
  });
}

export type PendingMiddlewareGateCache = {
  kind: MiddlewareGateKind;
  googleSub: string;
  email: string;
};

export async function applyPendingMiddlewareGateCaches(
  res: NextResponse,
  pending: PendingMiddlewareGateCache[],
): Promise<void> {
  for (const item of pending) {
    await attachMiddlewareGateCache(res, item.kind, item.googleSub, item.email);
  }
}
