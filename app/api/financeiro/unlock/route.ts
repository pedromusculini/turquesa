import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import {
  attachUnlockCookie,
  clearUnlockCookie,
  getModoSalaoStatus,
  tryUnlockWithPin,
} from '@/lib/financeiroPin';

export async function GET() {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;

  try {
    const status = await getModoSalaoStatus(authResult.email);
    return NextResponse.json(status);
  } catch (err) {
    console.error('[financeiro/unlock/status/GET]', err);
    return NextResponse.json({ error: 'Erro ao verificar desbloqueio' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;

  try {
    const body = await req.json();
    const pin = String(body.pin ?? '').trim();
    if (!pin) {
      return NextResponse.json({ error: 'Informe o PIN.' }, { status: 400 });
    }

    const result = await tryUnlockWithPin(authResult.email, pin);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.message, code: result.locked ? 'FINANCEIRO_PIN_LOCKED' : 'FINANCEIRO_PIN_INVALID' },
        { status: result.locked ? 423 : 401 },
      );
    }

    const res = NextResponse.json({ success: true, message: 'Financeiro desbloqueado por 60 minutos.' });
    attachUnlockCookie(res, authResult.email);
    return res;
  } catch (err) {
    console.error('[financeiro/unlock/POST]', err);
    return NextResponse.json({ error: 'Erro ao desbloquear financeiro' }, { status: 500 });
  }
}

export async function DELETE() {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;

  const res = NextResponse.json({ success: true, message: 'Financeiro bloqueado.' });
  clearUnlockCookie(res);
  return res;
}
