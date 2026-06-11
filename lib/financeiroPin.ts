import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const FINANCEIRO_UNLOCK_COOKIE = 'financeiro_unlock';
export const FINANCEIRO_UNLOCK_TTL_SEC = 60 * 60;
export const MAX_PIN_ATTEMPTS = 3;
export const FINANCEIRO_PIN_RESET_PURPOSE = 'financeiro_pin_reset';

const OBVIOUS_PIN_SEQUENCES = new Set(['123456', '654321', '012345', '543210', '123123', '121212']);

type PinRow = {
  modo_salao_enabled: boolean;
  financeiro_pin_hash: string | null;
  financeiro_pin_failed_attempts: number;
  financeiro_pin_locked_at: string | null;
};

export type ModoSalaoStatus = {
  enabled: boolean;
  hasPin: boolean;
  locked: boolean;
  unlocked: boolean;
  failedAttempts: number;
};

function authSecret(): string {
  const secret = process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();
  if (!secret) throw new Error('AUTH_SECRET é obrigatório para desbloqueio do financeiro');
  return secret;
}

export function validatePinFormat(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}

export function isObviousPin(pin: string): boolean {
  if (!validatePinFormat(pin)) return true;
  if (OBVIOUS_PIN_SEQUENCES.has(pin)) return true;
  if (/^(\d)\1{5}$/.test(pin)) return true;

  const digits = pin.split('').map(Number);
  let ascending = true;
  let descending = true;
  for (let i = 1; i < digits.length; i++) {
    if (digits[i] !== digits[i - 1] + 1) ascending = false;
    if (digits[i] !== digits[i - 1] - 1) descending = false;
  }
  return ascending || descending;
}

export function assertPinAllowed(pin: string): void {
  if (!validatePinFormat(pin)) {
    throw new Error('O PIN deve ter exatamente 6 dígitos numéricos.');
  }
  if (isObviousPin(pin)) {
    throw new Error('Escolha um PIN menos óbvio (evite sequências e dígitos repetidos).');
  }
}

export async function hashFinanceiroPin(pin: string): Promise<string> {
  assertPinAllowed(pin);
  return bcrypt.hash(pin, 12);
}

export async function verifyFinanceiroPin(pin: string, hash: string | null): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(pin, hash);
}

async function loadPinRow(email: string): Promise<PinRow | null> {
  const normalized = email.toLowerCase().trim();
  const { data, error } = await supabaseAdmin
    .from('onboarding_profiles')
    .select(
      'modo_salao_enabled, financeiro_pin_hash, financeiro_pin_failed_attempts, financeiro_pin_locked_at',
    )
    .eq('email', normalized)
    .maybeSingle();

  if (error) throw error;
  return data as PinRow | null;
}

export function isPinLocked(row: PinRow | null): boolean {
  return Boolean(row?.financeiro_pin_locked_at);
}

export function createUnlockToken(email: string): string {
  const normalized = email.toLowerCase().trim();
  return jwt.sign({ sub: normalized, purpose: 'financeiro_unlock' }, authSecret(), {
    expiresIn: FINANCEIRO_UNLOCK_TTL_SEC,
  });
}

export function verifyUnlockToken(token: string, email: string): boolean {
  try {
    const payload = jwt.verify(token, authSecret()) as jwt.JwtPayload;
    return (
      payload.purpose === 'financeiro_unlock' &&
      String(payload.sub).toLowerCase().trim() === email.toLowerCase().trim()
    );
  } catch {
    return false;
  }
}

export async function readUnlockCookie(email: string): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(FINANCEIRO_UNLOCK_COOKIE)?.value;
  if (!token) return false;
  return verifyUnlockToken(token, email);
}

export function readUnlockCookieFromRequest(req: NextRequest, email: string): boolean {
  const token = req.cookies.get(FINANCEIRO_UNLOCK_COOKIE)?.value;
  if (!token) return false;
  return verifyUnlockToken(token, email);
}

export function attachUnlockCookie(res: NextResponse, email: string): void {
  const token = createUnlockToken(email);
  res.cookies.set(FINANCEIRO_UNLOCK_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: FINANCEIRO_UNLOCK_TTL_SEC,
    path: '/',
  });
}

export function clearUnlockCookie(res: NextResponse): void {
  res.cookies.set(FINANCEIRO_UNLOCK_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
}

export async function getModoSalaoStatus(email: string): Promise<ModoSalaoStatus> {
  const row = await loadPinRow(email);
  const enabled = row?.modo_salao_enabled === true;
  const hasPin = Boolean(row?.financeiro_pin_hash);
  const locked = isPinLocked(row);
  const unlocked = enabled && hasPin && !locked ? await readUnlockCookie(email) : false;

  return {
    enabled,
    hasPin,
    locked,
    unlocked,
    failedAttempts: row?.financeiro_pin_failed_attempts ?? 0,
  };
}

export async function isFinanceiroProtected(email: string): Promise<boolean> {
  const row = await loadPinRow(email);
  return row?.modo_salao_enabled === true && Boolean(row.financeiro_pin_hash) && !isPinLocked(row);
}

export async function recordFailedPinAttempt(email: string): Promise<{ locked: boolean }> {
  const normalized = email.toLowerCase().trim();
  const row = await loadPinRow(normalized);
  const attempts = (row?.financeiro_pin_failed_attempts ?? 0) + 1;
  const locked = attempts >= MAX_PIN_ATTEMPTS;

  const { error } = await supabaseAdmin
    .from('onboarding_profiles')
    .update({
      financeiro_pin_failed_attempts: attempts,
      financeiro_pin_locked_at: locked ? new Date().toISOString() : row?.financeiro_pin_locked_at,
      updated_at: new Date().toISOString(),
    })
    .eq('email', normalized);

  if (error) throw error;
  return { locked };
}

export async function resetPinAttempts(email: string): Promise<void> {
  const normalized = email.toLowerCase().trim();
  const { error } = await supabaseAdmin
    .from('onboarding_profiles')
    .update({
      financeiro_pin_failed_attempts: 0,
      financeiro_pin_locked_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('email', normalized);

  if (error) throw error;
}

export async function tryUnlockWithPin(
  email: string,
  pin: string,
): Promise<{ ok: true } | { ok: false; locked: boolean; message: string }> {
  const normalized = email.toLowerCase().trim();
  const row = await loadPinRow(normalized);

  if (!row?.modo_salao_enabled || !row.financeiro_pin_hash) {
    return { ok: false, locked: false, message: 'Modo salão não está ativo.' };
  }

  if (isPinLocked(row)) {
    return {
      ok: false,
      locked: true,
      message: 'PIN bloqueado após várias tentativas. Use “Esqueci a senha” para redefinir.',
    };
  }

  const valid = await verifyFinanceiroPin(pin, row.financeiro_pin_hash);
  if (!valid) {
    const { locked } = await recordFailedPinAttempt(normalized);
    const remaining = Math.max(0, MAX_PIN_ATTEMPTS - ((row.financeiro_pin_failed_attempts ?? 0) + 1));
    if (locked) {
      return {
        ok: false,
        locked: true,
        message: 'PIN bloqueado após 3 tentativas. Redefina por e-mail.',
      };
    }
    return {
      ok: false,
      locked: false,
      message:
        remaining > 0
          ? `PIN incorreto. ${remaining} tentativa(s) restante(s).`
          : 'PIN incorreto.',
    };
  }

  await resetPinAttempts(normalized);
  return { ok: true };
}

/** Bloqueia APIs de financeiro/backup quando modo salão exige PIN. */
export async function requireFinanceiroUnlocked(
  email: string,
  req?: NextRequest,
): Promise<NextResponse | null> {
  const row = await loadPinRow(email);
  if (!row?.modo_salao_enabled || !row.financeiro_pin_hash) {
    return null;
  }

  if (isPinLocked(row)) {
    return NextResponse.json(
      {
        error: 'PIN bloqueado. Redefina pelo e-mail da conta Google.',
        code: 'FINANCEIRO_PIN_LOCKED',
      },
      { status: 423 },
    );
  }

  const unlocked = req
    ? readUnlockCookieFromRequest(req, email)
    : await readUnlockCookie(email);

  if (!unlocked) {
    return NextResponse.json(
      {
        error: 'Informe o PIN do modo salão para acessar esta área.',
        code: 'FINANCEIRO_PIN_REQUIRED',
      },
      { status: 403 },
    );
  }

  return null;
}
