import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { ADMIN_API_PREFIX, ADMIN_PANEL_PATH } from '@/lib/constants';
import { getInternalProductId, type InternalProductId } from '@/lib/internalProduct';

export function parseAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS?.trim();
  if (!raw) return [];
  return raw
    .split(/[,;]/)
    .map((e) => e.toLowerCase().trim())
    .filter(Boolean);
}

export function isInternalAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.toLowerCase().trim();
  const admins = parseAdminEmails();
  return admins.length > 0 && admins.includes(normalized);
}

export function isInternalPath(pathname: string): boolean {
  return (
    pathname === ADMIN_PANEL_PATH ||
    pathname.startsWith(`${ADMIN_PANEL_PATH}/`) ||
    pathname.startsWith(ADMIN_API_PREFIX)
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
