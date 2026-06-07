import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import {
  getOwnerGoogleAccessToken,
  migrateOwnerTokensFromCookies,
} from '@/lib/ownerGoogleTokens';

/** Token Google Calendar do titular: Supabase com auto-refresh, cookie legado ou sessão. */
export async function getTitularCalendarAccessToken(
  req: NextRequest,
): Promise<string | null> {
  const session = await auth();
  const googleSub = session?.googleSub;

  if (googleSub) {
    try {
      await migrateOwnerTokensFromCookies(req, googleSub);
      const dbToken = await getOwnerGoogleAccessToken(googleSub, 'calendar');
      if (dbToken) return dbToken;
    } catch (err) {
      console.warn('[calendarAuth] getOwnerGoogleAccessToken:', err);
    }
  }

  const cookieToken = req.cookies.get('google_calendar_token')?.value;
  if (cookieToken) return cookieToken;

  const sessionToken = (session as { accessToken?: string })?.accessToken;
  return sessionToken ?? null;
}
