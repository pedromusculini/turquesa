import { NextRequest, NextResponse } from 'next/server';
import { isAuthError, requireClienteFichaAccess } from '@/lib/api-auth';
import { loadClienteFichaByFormularioToken } from '@/lib/loadClienteFichaPublic';
import { checkRateLimit } from '@/lib/rateLimit';

type Params = { params: Promise<{ token: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { token } = await params;
  const sessaoAgendada = req.nextUrl.searchParams.get('sessao');

  const limit = checkRateLimit(`ficha-get:${token}`, 60, 60 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Muitas consultas. Tente novamente mais tarde.' },
      { status: 429 },
    );
  }

  const authResult = await requireClienteFichaAccess(token);
  if (isAuthError(authResult)) return authResult;

  const result = await loadClienteFichaByFormularioToken(token, { sessaoAgendada });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data);
}
