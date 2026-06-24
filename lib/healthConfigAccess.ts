import { timingSafeEqual } from 'crypto';
import type { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { isInternalAdminEmail } from '@/lib/internalAdmin';

/** Detalhes de env (nomes de secrets) só para admin interno, dev ou header secreto. */
export async function shouldExposeHealthConfigDetail(
  req: NextRequest,
): Promise<boolean> {
  if (process.env.NODE_ENV === 'development') return true;

  const session = await auth();
  if (isInternalAdminEmail(session?.user?.email)) return true;

  const secret = process.env.HEALTH_CONFIG_SECRET?.trim();
  if (!secret) return false;

  const provided =
    req.headers.get('x-health-config-secret')?.trim() ??
    new URL(req.url).searchParams.get('health_secret')?.trim();
  if (!provided || provided.length !== secret.length) return false;

  try {
    return timingSafeEqual(Buffer.from(provided), Buffer.from(secret));
  } catch {
    return false;
  }
}
