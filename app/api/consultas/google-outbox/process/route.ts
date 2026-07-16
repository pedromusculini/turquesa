import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { processDueGoogleOutbox } from '@/lib/consultasGoogleOutbox';

export const runtime = 'nodejs';

function isAuthorizedCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = req.headers.get('authorization')?.trim();
  return header === `Bearer ${secret}`;
}

/** Vercel Cron (GET): processa a fila de todos os donos (rede de segurança diária). */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }
  try {
    const result = await processDueGoogleOutbox({ limit: 200 });
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro no worker do outbox';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Gatilho do cliente (POST): processa a fila apenas do dono autenticado.
 * Chamado pelo poll da agenda (25s) e no load — retry quase em tempo real.
 */
export async function POST(req: NextRequest) {
  if (isAuthorizedCron(req)) {
    try {
      const result = await processDueGoogleOutbox({ limit: 200 });
      return NextResponse.json({ success: true, ...result });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro no worker do outbox';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  try {
    const result = await processDueGoogleOutbox({ ownerEmail: email, limit: 50 });
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro no worker do outbox';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
