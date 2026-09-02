import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { requireGoogleAccessToken, isDriveError } from '@/lib/driveAuth';
import { buildResgateMensagemForCliente } from '@/lib/resgatePendentes';
import { getResgateSettings } from '@/lib/resgateSettings';

type Params = { params: Promise<{ clienteId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const tokenResult = await requireGoogleAccessToken(req);
  if (isDriveError(tokenResult)) return tokenResult;

  const { clienteId } = await params;
  const sp = req.nextUrl.searchParams;
  const diasParam = Number(sp.get('dias') || '');
  const contextoParam = sp.get('contexto');
  const contexto =
    contextoParam === 'primeira_visita' ? ('primeira_visita' as const) : ('sem_retorno' as const);
  const settings = await getResgateSettings(email);
  const diasLimite = Number.isFinite(diasParam) && diasParam > 0 ? diasParam : settings.resgate_dias_limite;

  const payload = await buildResgateMensagemForCliente({
    ownerEmail: email,
    accessToken: tokenResult,
    clienteId,
    diasLimite,
    contexto,
  });

  if (!payload) {
    return NextResponse.json({ error: 'Cliente não elegível ou sem telefone' }, { status: 404 });
  }

  return NextResponse.json({
    mensagem: payload.mensagem,
    whatsapp_url: payload.whatsapp?.web ?? null,
    whatsapp_app_url: payload.whatsapp?.app ?? null,
    whatsapp_android_url: payload.whatsapp?.android ?? null,
  });
}
