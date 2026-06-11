import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
import {
  assertPinAllowed,
  clearUnlockCookie,
  getModoSalaoStatus,
  hashFinanceiroPin,
  resetPinAttempts,
  tryUnlockWithPin,
  verifyFinanceiroPin,
} from '@/lib/financeiroPin';

async function loadPinHash(email: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('onboarding_profiles')
    .select('financeiro_pin_hash')
    .eq('email', email.toLowerCase().trim())
    .maybeSingle();

  if (error) throw error;
  return (data?.financeiro_pin_hash as string | null) ?? null;
}

export async function GET() {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;

  try {
    const status = await getModoSalaoStatus(authResult.email);
    return NextResponse.json(status);
  } catch (err) {
    console.error('[config/modo-salao/GET]', err);
    return NextResponse.json({ error: 'Erro ao carregar modo salão' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  try {
    const body = await req.json();
    const action = String(body.action ?? '').trim();

    if (action === 'enable') {
      const pin = String(body.pin ?? '').trim();
      const pinConfirm = String(body.pinConfirm ?? '').trim();
      if (pin !== pinConfirm) {
        return NextResponse.json({ error: 'A confirmação do PIN não confere.' }, { status: 400 });
      }

      assertPinAllowed(pin);
      const hash = await hashFinanceiroPin(pin);

      const { error } = await supabaseAdmin
        .from('onboarding_profiles')
        .update({
          modo_salao_enabled: true,
          financeiro_pin_hash: hash,
          financeiro_pin_failed_attempts: 0,
          financeiro_pin_locked_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('email', email);

      if (error) throw error;

      const res = NextResponse.json({
        success: true,
        message: 'Modo salão ativado. Financeiro e backup passam a exigir PIN.',
      });
      clearUnlockCookie(res);
      return res;
    }

    if (action === 'disable') {
      const pin = String(body.pin ?? '').trim();
      const hash = await loadPinHash(email);
      if (!hash) {
        return NextResponse.json({ error: 'PIN não configurado.' }, { status: 400 });
      }

      const valid = await verifyFinanceiroPin(pin, hash);
      if (!valid) {
        const attempt = await tryUnlockWithPin(email, pin);
        if (!attempt.ok) {
          return NextResponse.json(
            { error: attempt.message, code: attempt.locked ? 'FINANCEIRO_PIN_LOCKED' : undefined },
            { status: attempt.locked ? 423 : 400 },
          );
        }
        return NextResponse.json({ error: 'PIN inválido.' }, { status: 400 });
      }

      const { error } = await supabaseAdmin
        .from('onboarding_profiles')
        .update({
          modo_salao_enabled: false,
          financeiro_pin_hash: null,
          financeiro_pin_failed_attempts: 0,
          financeiro_pin_locked_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('email', email);

      if (error) throw error;

      const res = NextResponse.json({
        success: true,
        message: 'Modo salão desativado.',
      });
      clearUnlockCookie(res);
      return res;
    }

    if (action === 'change') {
      const currentPin = String(body.currentPin ?? '').trim();
      const newPin = String(body.newPin ?? '').trim();
      const newPinConfirm = String(body.newPinConfirm ?? '').trim();

      if (newPin !== newPinConfirm) {
        return NextResponse.json({ error: 'A confirmação do novo PIN não confere.' }, { status: 400 });
      }

      const hash = await loadPinHash(email);
      if (!hash) {
        return NextResponse.json({ error: 'Configure o modo salão antes de alterar o PIN.' }, { status: 400 });
      }

      const valid = await verifyFinanceiroPin(currentPin, hash);
      if (!valid) {
        const attempt = await tryUnlockWithPin(email, currentPin);
        if (!attempt.ok) {
          return NextResponse.json(
            { error: attempt.message, code: attempt.locked ? 'FINANCEIRO_PIN_LOCKED' : undefined },
            { status: attempt.locked ? 423 : 400 },
          );
        }
        return NextResponse.json({ error: 'PIN atual incorreto.' }, { status: 400 });
      }

      assertPinAllowed(newPin);
      const newHash = await hashFinanceiroPin(newPin);

      const { error } = await supabaseAdmin
        .from('onboarding_profiles')
        .update({
          financeiro_pin_hash: newHash,
          financeiro_pin_failed_attempts: 0,
          financeiro_pin_locked_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('email', email);

      if (error) throw error;

      const res = NextResponse.json({
        success: true,
        message: 'PIN alterado com sucesso.',
      });
      clearUnlockCookie(res);
      return res;
    }

    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
  } catch (err) {
    console.error('[config/modo-salao/POST]', err);
    const message = err instanceof Error ? err.message : 'Erro ao salvar modo salão';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
