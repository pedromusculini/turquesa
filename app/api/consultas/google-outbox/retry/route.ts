import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { processDueGoogleOutbox, retryGoogleOutbox } from '@/lib/consultasGoogleOutbox';

export const runtime = 'nodejs';

/** Reenvia itens do outbox em erro (botão "reenviar" no badge). */
export async function POST(req: NextRequest) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const body = await req.json().catch(() => ({}));
  const consultaId = body?.consultaId ? String(body.consultaId) : undefined;

  try {
    const requeued = await retryGoogleOutbox(email, consultaId);
    const result = await processDueGoogleOutbox({ ownerEmail: email, limit: 50 });
    return NextResponse.json({ success: true, requeued, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao reenviar';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
