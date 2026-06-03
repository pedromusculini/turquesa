import { NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import { isAsaasApiConfigured } from '@/lib/asaasApi';
import { getPagamentoLinkForOwner } from '@/lib/asaasConta';

export async function GET() {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;

  if (!isAsaasApiConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        message:
          'Pagamento online ainda não está disponível neste ambiente. Configure ASAAS_API_KEY e ASAAS_API_URL na Vercel (Production) e faça redeploy.',
      },
      { status: 503 },
    );
  }

  try {
    const result = await getPagamentoLinkForOwner(authResult.email);
    return NextResponse.json(result, { status: result.ok ? 200 : 404 });
  } catch (err) {
    console.error('[conta/pagamento]', err);
    const msg = err instanceof Error ? err.message : 'Erro ao obter link de pagamento';
    if (msg.includes('403')) {
      return NextResponse.json(
        {
          ok: false,
          message:
            'API Asaas bloqueou a requisição (IP não autorizado). Use o link enviado por e-mail pelo Asaas ou libere o IP da Vercel na whitelist.',
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}
