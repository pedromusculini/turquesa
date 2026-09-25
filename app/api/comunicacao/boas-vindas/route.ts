import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import { buildBoasVindasMensagem } from '@/lib/mensagensProntas';

/** GET — mensagem de boas-vindas salva, já com os links reais do salão. */
export async function GET() {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;

  try {
    const { mensagem } = await buildBoasVindasMensagem(authResult.email);
    return NextResponse.json({ mensagem });
  } catch (error) {
    console.error('[comunicacao/boas-vindas GET]', error);
    return NextResponse.json({ error: 'Erro ao montar mensagem' }, { status: 500 });
  }
}

/** POST { template } — mesma coisa, mas com o texto que está sendo editado (ainda não salvo). */
export async function POST(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;

  const body = (await req.json().catch(() => ({}))) as { template?: unknown };
  const template = typeof body.template === 'string' ? body.template.slice(0, 4000) : undefined;

  try {
    const { mensagem } = await buildBoasVindasMensagem(authResult.email, template);
    return NextResponse.json({ mensagem });
  } catch (error) {
    console.error('[comunicacao/boas-vindas POST]', error);
    return NextResponse.json({ error: 'Erro ao montar mensagem' }, { status: 500 });
  }
}
