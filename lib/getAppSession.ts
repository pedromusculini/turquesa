import { auth } from '@/auth';
import type { Session } from 'next-auth';
import { getDevMockSession, isDevBypassAuthActive } from '@/lib/devBypassAuth';

/** Server session with dev bypass fallback (use in layouts; APIs prefer requireOwnerEmail). */
export async function getAppSession(): Promise<Session | null> {
  if (isDevBypassAuthActive()) {
    const session = await auth();
    const mock = getDevMockSession();
    if (!session?.user?.email) return mock;
    return {
      ...mock,
      ...session,
      user: { ...mock.user, ...session.user },
    };
  }
  return auth();
}
