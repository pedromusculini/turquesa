import { NextRequest, NextResponse } from 'next/server';
import { shouldExposeHealthConfigDetail } from '@/lib/healthConfigAccess';

/** IP de saída deste deploy (para whitelist Asaas). Pode mudar sem Vercel Static IPs. */
export async function GET(req: NextRequest) {
  const detail = await shouldExposeHealthConfigDetail(req);
  if (!detail) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  try {
    const res = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' });
    const data = (await res.json()) as { ip?: string };
    return NextResponse.json({
      ok: true,
      egressIp: data.ip ?? null,
      region: process.env.VERCEL_REGION ?? null,
      hint: 'Cadastre este IP no Asaas (Integrações → Mecanismos de segurança). Sem Vercel Static IPs ele pode mudar após redeploy.',
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Erro' },
      { status: 500 },
    );
  }
}
