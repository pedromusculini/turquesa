import { NextRequest, NextResponse } from 'next/server';
import { getAppBaseUrl } from '@/lib/appUrl';
import {
  getInvitePublicInfo,
  googleCalendarScopeParam,
} from '@/lib/profissionalGoogleCalendar';
import { signProfissionalOAuthState } from '@/lib/profissionalOAuthState';

/**
 * Inicia OAuth Google Calendar para profissional via convite (sem login no Turquesa).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const inviteToken = searchParams.get('token')?.trim();

  if (!inviteToken) {
    return NextResponse.json({ error: 'Token de convite é obrigatório' }, { status: 400 });
  }

  const info = await getInvitePublicInfo(inviteToken);
  if (!info) {
    return NextResponse.json({ error: 'Convite não encontrado' }, { status: 404 });
  }
  if (info.alreadyConnected) {
    return NextResponse.json({ error: 'Agenda já conectada' }, { status: 400 });
  }
  if (info.inviteExpired) {
    return NextResponse.json(
      { error: 'Convite expirado. Peça um novo link ao salão.' },
      { status: 410 },
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.AUTH_GOOGLE_ID;
  if (!clientId) {
    return NextResponse.json({ error: 'Google OAuth não configurado' }, { status: 503 });
  }

  const baseUrl = getAppBaseUrl(req);
  const redirectUri = `${baseUrl}/api/auth/profissional-google-callback`;

  let state: string;
  try {
    state = signProfissionalOAuthState({
      inviteToken,
      profissionalId: info.profissionalId,
    });
  } catch (err) {
    console.error('[profissional-google-authorize] state:', err);
    return NextResponse.json({ error: 'Configuração de autenticação incompleta' }, { status: 503 });
  }

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', googleCalendarScopeParam());
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');
  authUrl.searchParams.set('state', state);

  return NextResponse.redirect(authUrl);
}
