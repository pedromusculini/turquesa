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

/** Status das conexões Google (sem expor tokens). */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const access = await getGoogleAccessForSession(session);
  if (!access?.accessVerified) {
    return googleAccessDeniedResponse();
  }

  const googleSub = session.googleSub;
  if (!googleSub) {
    return NextResponse.json({ error: 'Sessão Google inválida' }, { status: 401 });
  }

  await migrateOwnerTokensFromCookies(req, googleSub);
  const dbStatus = await getOwnerGoogleConnectionStatus(googleSub);

  const driveCookie = !!req.cookies.get('google_drive_token')?.value;
  const calendarCookie = !!req.cookies.get('google_calendar_token')?.value;
  const contactsCookie = !!req.cookies.get('google_contacts_token')?.value;
  const sessionToken = !!(session as { accessToken?: string }).accessToken;

  const drive = dbStatus.drive || driveCookie || sessionToken;
  const calendar = dbStatus.calendar || calendarCookie || sessionToken;
  const contacts = dbStatus.contacts || contactsCookie;
  const connected = dbStatus.connected || drive || calendar || contacts;

  return NextResponse.json({
    connected,
    drive,
    calendar,
    contacts,
    needsConnect: !connected,
  });
}
