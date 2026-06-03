import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  getGoogleAccessForSession,
  googleAccessDeniedResponse,
} from '@/lib/requireGoogleAccess';

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

  const sessionToken = !!(session as { accessToken?: string }).accessToken;
  const driveCookie = !!req.cookies.get('google_drive_token')?.value;
  const calendarCookie = !!req.cookies.get('google_calendar_token')?.value;
  const contactsCookie = !!req.cookies.get('google_contacts_token')?.value;

  return NextResponse.json({
    drive: driveCookie || sessionToken,
    calendar: calendarCookie || sessionToken,
    contacts: contactsCookie,
    /** Login já inclui Drive + Calendar; contatos exigem autorização extra */
    driveNeedsExtra: !driveCookie && !sessionToken,
    calendarNeedsExtra: !calendarCookie && !sessionToken,
  });
}
