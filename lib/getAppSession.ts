import { auth } from '@/auth';
import type { Session } from 'next-auth';
import { getDevMockSession, isDevBypassAuthActive } from '@/lib/devBypassAuth';

/** Server session with dev bypass fallback (use in layouts; APIs prefer requireOwnerEmail). */
export async function getAppSession(): Promise<Session | null> {
  if (isDevBypassAuthActive()) {
    return getDevMockSession();
  }
  return auth();
}
