import { NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import { isAsaasApiConfigured } from '@/lib/asaasApi';
import { AsaasBillingError, getPagamentoLinkForOwner } from '@/lib/asaasConta';

export async function GET() {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;

  if (!isAsaasApiConfigured()) {
    console.error('[conta/pagamento] ASAAS_API_KEY ausente no servidor');
    return NextResponse.json(
      {
        ok: false,
        message:
          'Pagamento online temporariamente indisponível. Tente novamente em alguns minutos ou fale com o suporte.',
      },
      { status: 503 },
    );
  }

  try {
    const result = await getPagamentoLinkForOwner(authResult.email);
    return NextResponse.json(result, { status: result.ok ? 200 : 404 });
  } catch (err) {
    console.error('[conta/pagamento]', err);
    if (err instanceof AsaasBillingError) {
      return NextResponse.json(
        {
          ok: false,
          code: err.code,
          message: err.message,
          profileUrl: '/dashboard/perfil',
        },
        { status: 400 },
      );
    }
    const msg = err instanceof Error ? err.message : 'Erro ao obter link de pagamento';
    if (
      msg.includes('CPF ou CNPJ') ||
      msg.includes('cpfCnpj') ||
      msg.includes('cpf ou cnpj')
    ) {
      return NextResponse.json(
        {
          ok: false,
          code: 'MISSING_CPF_CNPJ',
          message: 'Para gerar a cobrança, informe seu CPF ou CNPJ em Meu Perfil.',
          profileUrl: '/dashboard/perfil',
        },
        { status: 400 },
      );
    }
    if (msg.includes('403') || msg.includes('not_allowed_ip')) {
      return NextResponse.json(
        {
          ok: false,
          code: 'ASAAS_IP_BLOCKED',
          message:
            'Pagamento temporariamente indisponível. O Asaas está bloqueando o servidor (whitelist de IP). Peça ao suporte do salão para liberar em asaas.com → Integrações → Mecanismos de segurança (deixe a lista de IPs vazia).',
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}
