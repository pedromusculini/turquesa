import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import { buildLembretesPendentesResponse } from '@/lib/lembretesPendentes';

/** GET — lembretes pendentes. ?syncGoogle=1 força sync com Calendar (botão Atualizar). */
export async function GET(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  try {
    const syncGoogle = req.nextUrl.searchParams.get('syncGoogle') === '1';
    const { lembretes7, lembretes1, settings } = await buildLembretesPendentesResponse(
      email,
      { syncGoogle },
    );

    return NextResponse.json({ lembretes7, lembretes1, settings });
  } catch (error) {
    console.error('[lembretes/pendentes]', error);
    return NextResponse.json({ error: 'Erro ao listar lembretes' }, { status: 500 });
  }
}
