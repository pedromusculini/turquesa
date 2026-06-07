import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  getGoogleAccessForSession,
  googleAccessDeniedResponse,
} from '@/lib/requireGoogleAccess';
import {
  getOwnerGoogleConnectionStatus,
  migrateOwnerTokensFromCookies,
} from '@/lib/ownerGoogleTokens';

/**
 * Indica conexões Google sem expor access/refresh tokens ao browser.
 * Operações de Calendar/Drive devem usar /api/google-calendar e /api/google-drive.
 */
export async function GET(req: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  const access = await getGoogleAccessForSession(session);
  if (!access?.accessVerified) {
    return googleAccessDeniedResponse();
  }

  const googleSub = session.googleSub;
  let drive = false;
  let calendar = false;

  if (googleSub) {
    await migrateOwnerTokensFromCookies(req, googleSub);
    const status = await getOwnerGoogleConnectionStatus(googleSub);
    drive = status.drive;
    calendar = status.calendar;
  }

  const hasCalendar =
    calendar ||
    !!req.cookies.get('google_calendar_token')?.value ||
    !!(session as { accessToken?: string }).accessToken;
  const hasDrive =
    drive ||
    !!req.cookies.get('google_drive_token')?.value ||
    !!(session as { accessToken?: string }).accessToken;

  return NextResponse.json({
    user: {
      id: (session.user as { id?: string })?.id,
      email: session.user.email,
      name: session.user.name,
      image: session.user.image,
    },
    googleSub: (session as { googleSub?: string }).googleSub,
    accessVerified: true,
    calendarConnected: hasCalendar,
    driveConnected: hasDrive,
    tokenExpiresAt: (session as { tokenExpiresAt?: number }).tokenExpiresAt,
  });
}
