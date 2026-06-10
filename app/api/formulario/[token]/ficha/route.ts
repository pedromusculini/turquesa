import { NextRequest, NextResponse } from 'next/server';
import { loadClienteFichaByFormularioToken } from '@/lib/loadClienteFichaPublic';
import { checkRateLimit } from '@/lib/rateLimit';

type Params = { params: Promise<{ token: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params;

  const limit = checkRateLimit(`ficha-get:${token}`, 60, 60 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Muitas consultas. Tente novamente mais tarde.' },
      { status: 429 },
    );
  }

  const result = await loadClienteFichaByFormularioToken(token);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data);
}
