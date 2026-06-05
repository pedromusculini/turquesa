import { NextRequest, NextResponse } from 'next/server';
import { getInvitePublicInfo } from '@/lib/profissionalGoogleCalendar';

type Params = { params: Promise<{ token: string }> };

/** Dados públicos do convite de agenda (sem tokens). */
export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params;

  if (!token?.trim()) {
    return NextResponse.json({ error: 'Convite inválido' }, { status: 400 });
  }

  try {
    const info = await getInvitePublicInfo(token.trim());
    if (!info) {
      return NextResponse.json({ error: 'Convite não encontrado' }, { status: 404 });
    }

    return NextResponse.json(info);
  } catch (err) {
    console.error('[convite/agenda/GET]', err);
    return NextResponse.json({ error: 'Erro ao carregar convite' }, { status: 500 });
  }
}
