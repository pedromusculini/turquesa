import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { ADMIN_API_PREFIX, ADMIN_PANEL_PATH } from '@/lib/constants';
import { getInternalProductId, type InternalProductId } from '@/lib/internalProduct';

/** Único e-mail permitido no painel em produção (sobrescreve lista maior em ADMIN_EMAILS). */
const SOLO_ADMIN_EMAIL = (
  process.env.INTERNAL_ADMIN_SOLO_EMAIL || 'pedromusculini@gmail.com'
)
  .toLowerCase()
  .trim();

function isProductionDeploy(): boolean {
  return (
    process.env.VERCEL_ENV === 'production' ||
    (process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV !== 'preview')
  );
}

/** Pastas físicas no App Router; URL canônica via rewrite em `next.config.ts`. */
const LEGACY_ADMIN_PANEL = '/naomexaaquiseucorno';
const LEGACY_ADMIN_API = '/api/naomexaaquiseucorno';

export function parseAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS?.trim();
  if (!raw) return [];

  const parsed = [
    ...new Set(
      raw
        .split(/[,;]/)
        .map((e) => e.toLowerCase().trim())
        .filter(Boolean),
    ),
  ];

  if (parsed.length === 0) return [];

  // Produção: somente o e-mail solo — máxima segurança operacional.
  if (isProductionDeploy() && process.env.INTERNAL_ADMIN_SOLO !== 'false') {
    return parsed.includes(SOLO_ADMIN_EMAIL) ? [SOLO_ADMIN_EMAIL] : [];
  }

  return parsed;
}

export function isInternalAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.toLowerCase().trim();
  const admins = parseAdminEmails();
  return admins.length > 0 && admins.includes(normalized);
}

export function isInternalApiPath(pathname: string): boolean {
  return (
    pathname.startsWith(ADMIN_API_PREFIX) ||
    pathname.startsWith(LEGACY_ADMIN_API)
  );
}

export function isInternalPath(pathname: string): boolean {
  return (
    pathname === ADMIN_PANEL_PATH ||
    pathname.startsWith(`${ADMIN_PANEL_PATH}/`) ||
    isInternalApiPath(pathname) ||
    pathname === LEGACY_ADMIN_PANEL ||
    pathname.startsWith(`${LEGACY_ADMIN_PANEL}/`)
  );
}

export async function requireInternalAdmin(): Promise<
  { email: string; productId: InternalProductId } | NextResponse
> {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase().trim();
  if (!email) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!isInternalAdminEmail(email)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return { email, productId: getInternalProductId() };
}

export function isInternalAdminError(
  result: { email: string; productId: InternalProductId } | NextResponse,
): result is NextResponse {
  return result instanceof NextResponse;
}
