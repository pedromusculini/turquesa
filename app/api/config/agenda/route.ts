import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import { getAgendaSettings, saveAgendaSettings } from '@/lib/agendaSettings';

export async function GET() {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;

  try {
    const settings = await getAgendaSettings(authResult.email);
    return NextResponse.json(settings);
  } catch (err) {
    console.error('[config/agenda GET]', err);
    return NextResponse.json({ error: 'Erro ao carregar configurações da agenda' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;

  try {
    const body = await req.json().catch(() => ({}));
    const raw = body.duracao_padrao_minutos;
    const duracao_padrao_minutos =
      raw === null || raw === '' || raw === undefined
        ? null
        : Number(raw);

    const settings = await saveAgendaSettings(authResult.email, {
      duracao_padrao_minutos,
    });
    return NextResponse.json(settings);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao salvar';
    console.error('[config/agenda PUT]', err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
