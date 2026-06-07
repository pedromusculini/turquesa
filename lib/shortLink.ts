import { createHmac, timingSafeEqual } from 'crypto';
import { CANONICAL_APP_URL } from '@/lib/constants';
import { getAppBaseUrl } from '@/lib/mensagensWhatsapp';

const SIG_LEN = 22;

function shortLinkSecret(): string {
  const secret = process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();
  if (!secret) {
    throw new Error('AUTH_SECRET ou NEXTAUTH_SECRET é obrigatório para links curtos');
  }
  return secret;
}

function signBody(body: string): string {
  return createHmac('sha256', shortLinkSecret()).update(body).digest('base64url').slice(0, SIG_LEN);
}

function verifyBodySig(body: string, sig: string): boolean {
  const expected = signBody(body);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
    return true;
  } catch {
    return false;
  }
}

function buildShortLink(body: string): string {
  const sig = signBody(body);
  return `${getAppBaseUrl()}/r/${body}.${sig}`;
}

function extractMapsAddress(targetUrl: string): string | null {
  try {
    const url = new URL(targetUrl);
    const q = url.searchParams.get('q');
    if (q) return q;

    const searchMatch = url.pathname.match(/\/maps\/search\/(.+)/);
    if (searchMatch?.[1]) {
      return decodeURIComponent(searchMatch[1]);
    }
  } catch {
    return null;
  }
  return null;
}

/** Gera URL curta assinada (`/r/...`) para Maps, calendário ou URL genérica. */
export function createShortRedirectUrl(targetUrl: string): string {
  const trimmed = targetUrl.trim();
  if (!trimmed) return '';

  const calMatch = trimmed.match(/\/calendario\/adicionar\/([a-f0-9]+)$/i);
  if (calMatch?.[1]) {
    return buildShortLink(`c${calMatch[1]}`);
  }

  const mapsAddr = extractMapsAddress(trimmed);
  if (mapsAddr) {
    const encoded = Buffer.from(mapsAddr, 'utf8').toString('base64url');
    return buildShortLink(`m${encoded}`);
  }

  const encoded = Buffer.from(trimmed, 'utf8').toString('base64url');
  return buildShortLink(`u${encoded}`);
}

/** Resolve token `/r/{body}.{sig}` para URL de destino. */
export function resolveShortLink(token: string): string | null {
  if (!token?.includes('.')) return null;

  const dot = token.lastIndexOf('.');
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!body || !sig || !verifyBodySig(body, sig)) return null;

  const kind = body[0];
  const payload = body.slice(1);
  if (!payload) return null;

  if (kind === 'c') {
    if (!/^[a-f0-9]+$/i.test(payload)) return null;
    return `${CANONICAL_APP_URL}/calendario/adicionar/${payload}`;
  }

  if (kind === 'm') {
    try {
      const addr = Buffer.from(payload, 'base64url').toString('utf8');
      if (!addr.trim()) return null;
      return `https://maps.google.com/?q=${encodeURIComponent(addr)}`;
    } catch {
      return null;
    }
  }

  if (kind === 'u') {
    try {
      const url = Buffer.from(payload, 'base64url').toString('utf8');
      if (!url.startsWith('http://') && !url.startsWith('https://')) return null;
      return url;
    } catch {
      return null;
    }
  }

  return null;
}

/** Fallback para pré-visualização no cliente (sem AUTH_SECRET). */
export function previewShortRedirectUrl(kind: 'maps' | 'calendario' | 'generic'): string {
  const base = CANONICAL_APP_URL;
  if (kind === 'maps') return `${base}/r/m…`;
  if (kind === 'calendario') return `${base}/r/c…`;
  return `${base}/r/u…`;
}
