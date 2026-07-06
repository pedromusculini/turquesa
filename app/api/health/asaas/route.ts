import { NextRequest, NextResponse } from 'next/server';
import { isAsaasApiConfigured } from '@/lib/asaasApi';
import { shouldExposeHealthConfigDetail } from '@/lib/healthConfigAccess';

/** Testa API Asaas a partir do servidor (Vercel) — útil após ajustar whitelist de IP. */
export async function GET(req: NextRequest) {
  const detail = await shouldExposeHealthConfigDetail(req);
  if (!detail) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  if (!isAsaasApiConfigured()) {
    return NextResponse.json({ ok: false, error: 'ASAAS_API_KEY ausente' }, { status: 503 });
  }

  const base = (process.env.ASAAS_API_URL || 'https://api.asaas.com/v3').replace(/\/$/, '');
  const key = process.env.ASAAS_API_KEY!.trim();

  try {
    const res = await fetch(`${base}/finance/balance`, {
      headers: { access_token: key },
      cache: 'no-store',
    });
    const text = await res.text();
    let data: { balance?: number; errors?: { code?: string; description?: string }[] };
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = {};
    }

    if (!res.ok) {
      const code = data.errors?.[0]?.code;
      const description = data.errors?.[0]?.description;
      return NextResponse.json({
        ok: false,
        status: res.status,
        code,
        description,
        hint:
          code === 'not_allowed_ip'
            ? 'Asaas → Integrações → Mecanismos de segurança → adicione o IP de saída da Vercel (npm run asaas:fix-ip).'
            : undefined,
      });
    }

    return NextResponse.json({
      ok: true,
      apiUrl: base,
      balance: data.balance,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Erro' },
      { status: 500 },
    );
  }
}
