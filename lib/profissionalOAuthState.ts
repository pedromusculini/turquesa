import { createHmac, timingSafeEqual } from 'crypto';

const STATE_TTL_MS = 15 * 60 * 1000;

export type SignedProfissionalOAuthState = {
  inviteToken: string;
  profissionalId: string;
  exp: number;
};

function oauthStateSecret(): string {
  const secret = process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();
  if (!secret) {
    throw new Error('AUTH_SECRET é obrigatório para OAuth de profissional');
  }
  return secret;
}

export function signProfissionalOAuthState(input: {
  inviteToken: string;
  profissionalId: string;
}): string {
  const payload: SignedProfissionalOAuthState = {
    inviteToken: input.inviteToken,
    profissionalId: input.profissionalId,
    exp: Date.now() + STATE_TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', oauthStateSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyProfissionalOAuthState(
  state: string | null | undefined,
): SignedProfissionalOAuthState | null {
  if (!state?.includes('.')) return null;

  const dot = state.lastIndexOf('.');
  const body = state.slice(0, dot);
  const sig = state.slice(dot + 1);
  if (!body || !sig) return null;

  const expected = createHmac('sha256', oauthStateSecret()).update(body).digest('base64url');
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf-8'),
    ) as SignedProfissionalOAuthState;

    if (!parsed?.inviteToken || !parsed.profissionalId || typeof parsed.exp !== 'number') {
      return null;
    }
    if (parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}
