import { NextRequest, NextResponse } from 'next/server';
import {
  verifyAsaasWebhookToken,
  summarizeAsaasWebhook,
  type AsaasWebhookPayload,
} from '@/lib/asaasWebhook';
import { processAsaasWebhook } from '@/lib/asaasWebhookHandler';

function verifyWebhookRequest(headerToken: string | null): { ok: boolean; reason?: string } {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN?.trim();
  if (!expected && process.env.NODE_ENV === 'development') {
    console.warn('[webhooks/asaas] ASAAS_WEBHOOK_TOKEN vazio — aceito só em desenvolvimento');
    return { ok: true };
  }
  return verifyAsaasWebhookToken(headerToken, expected);
}

export async function POST(req: NextRequest) {
  const headerToken = req.headers.get('asaas-access-token');
  const auth = verifyWebhookRequest(headerToken);
  if (!auth.ok) {
    console.warn('[webhooks/asaas] Rejeitado:', auth.reason);
    return NextResponse.json({ error: auth.reason }, { status: 401 });
  }

  let body: AsaasWebhookPayload;
  let raw: unknown;
  try {
    raw = await req.json();
    body = raw as AsaasWebhookPayload;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  console.info('[webhooks/asaas]', summarizeAsaasWebhook(body));

  try {
    const result = await processAsaasWebhook(body, raw);
    return NextResponse.json({ received: true, ...result });
  } catch (err) {
    console.error('[webhooks/asaas] Erro ao processar:', err);
    return NextResponse.json({ error: 'Erro ao processar webhook' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: 'Webhook Asaas ativo. Use POST com header asaas-access-token.',
  });
}
