import type { Session } from 'next-auth';
import type { NextRequest, NextResponse } from 'next/server';
import type { JWT } from '@auth/core/jwt';
import { encode } from '@auth/core/jwt';

/** Cookie names Auth.js uses (non-HTTPS vs HTTPS). */
export const DEV_SESSION_COOKIE_PLAIN = 'authjs.session-token';
export const DEV_SESSION_COOKIE_SECURE = '__Secure-authjs.session-token';

/** @deprecated Use DEV_SESSION_COOKIE_PLAIN */
export const DEV_SESSION_COOKIE_NAME = DEV_SESSION_COOKIE_PLAIN;

/**
 * Local-only auth bypass for UI/visual verification.
 * Never active on Vercel Production — see docs/DEV_LOCAL.md.
 */
export function isDevLocalCompiledAllowed(): boolean {
  return (
    process.env.DEV_LOCAL_COMPILED === 'true' ||
    process.env.ALLOW_DEV_BYPASS_COMPILED === 'true'
  );
}

export function isDevBypassAuthActive(): boolean {
  if (process.env.DEV_BYPASS_AUTH !== 'true') return false;
  if (process.env.VERCEL_ENV === 'production') return false;

  if (process.env.NODE_ENV === 'development') return true;
  // `npm run start:local` / build local — never on Vercel (preview included)
  if (isDevLocalCompiledAllowed()) return true;

  return false;
}

export function getDevBypassIdentity() {
  const userType = process.env.DEV_BYPASS_USER_TYPE?.trim() || 'clinica';
  return {
    id: process.env.DEV_BYPASS_USER_ID?.trim() || 'dev-bypass-user-id',
    email:
      process.env.DEV_BYPASS_EMAIL?.toLowerCase().trim() ||
      'dev-local@turquesaagenda.local',
    name: process.env.DEV_BYPASS_NAME?.trim() || 'Dev Local',
    googleSub: process.env.DEV_BYPASS_GOOGLE_SUB?.trim() || 'dev-bypass-google-sub',
    plan: process.env.DEV_BYPASS_PLAN?.trim() || 'ilimitado',
    userType,
  };
}

export function getDevBypassProfile(email?: string) {
  const { email: defaultEmail, name, plan, userType } = getDevBypassIdentity();
  return {
    email: (email ?? defaultEmail).toLowerCase().trim(),
    full_name: name,
    clinic_name: 'Salão Dev Local',
    user_type: userType,
    plan,
    onboarding_completed: true,
    street: 'Av. Paulista',
    address_number: '1000',
    neighborhood: 'Bela Vista',
    city: 'São Paulo',
    state: 'SP',
  };
}

export function getDevMockSession(): Session {
  const { id, email, name, googleSub, plan } = getDevBypassIdentity();
  return {
    user: { id, email, name },
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    googleSub,
    plan,
    accessVerified: true,
    trialEligible: true,
    trialConsumed: false,
  };
}

/** Session shape used by NextAuth middleware (`req.auth`). */
export function getDevMockMiddlewareAuth(): Session {
  return getDevMockSession();
}

/** Fills JWT for Auth.js when bypass is on (dev server + /api/auth/session). */
export function applyDevBypassToToken(token: JWT): JWT {
  const { id, email, name, googleSub, plan } = getDevBypassIdentity();
  token.sub = id;
  token.id = id;
  token.email = email;
  token.name = name;
  token.googleSub = googleSub;
  token.plan = plan;
  token.accessVerified = true;
  token.trialEligible = true;
  token.trialConsumed = false;
  return token;
}

export function resolveDevSessionCookieName(req?: NextRequest): string {
  if (req) {
    if (req.nextUrl.protocol === 'https:') return DEV_SESSION_COOKIE_SECURE;
    if (req.cookies.get(DEV_SESSION_COOKIE_SECURE)?.value) {
      return DEV_SESSION_COOKIE_SECURE;
    }
    if (req.cookies.get(DEV_SESSION_COOKIE_PLAIN)?.value) {
      return DEV_SESSION_COOKIE_PLAIN;
    }
  }
  const url = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? '';
  if (url.startsWith('https://')) return DEV_SESSION_COOKIE_SECURE;
  return DEV_SESSION_COOKIE_PLAIN;
}

function hasDevSessionCookie(req: NextRequest): boolean {
  return (
    !!req.cookies.get(DEV_SESSION_COOKIE_PLAIN)?.value ||
    !!req.cookies.get(DEV_SESSION_COOKIE_SECURE)?.value
  );
}

/**
 * Issues an Auth.js session cookie so `useSession()` and `/api/auth/session` work without Google login.
 */
export async function appendDevBypassSessionCookie(
  req: NextRequest,
  res: NextResponse,
): Promise<NextResponse> {
  if (!isDevBypassAuthActive()) return res;
  if (hasDevSessionCookie(req)) return res;

  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) {
    console.warn('[devBypassAuth] AUTH_SECRET missing — cannot issue dev session cookie');
    return res;
  }

  const cookieName = resolveDevSessionCookieName(req);
  const secure = cookieName === DEV_SESSION_COOKIE_SECURE;
  const { id, email, name, googleSub, plan } = getDevBypassIdentity();

  try {
    const token = await encode({
      token: {
        sub: id,
        id,
        email,
        name,
        googleSub,
        plan,
        accessVerified: true,
        trialEligible: true,
        trialConsumed: false,
      },
      secret,
      salt: cookieName,
    });

    res.cookies.set(cookieName, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure,
      maxAge: 30 * 24 * 60 * 60,
    });
  } catch (err) {
    console.error('[devBypassAuth] session cookie encode:', err);
  }

  return res;
}
