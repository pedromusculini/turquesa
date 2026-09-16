import 'server-only';

import { cookies, headers } from 'next/headers';
import type { NextRequest } from 'next/server';
import { CANONICAL_APP_URL } from '@/lib/constants';
import { META_PIXEL_ID } from '@/lib/metaPixel';

const GRAPH_VERSION = 'v21.0';

export type MetaCapiEventName = 'Lead' | 'CompleteRegistration';

export type MetaCapiUserContext = {
  fbp?: string;
  fbc?: string;
  ip?: string;
  ua?: string;
  sourceUrl?: string;
};

function capiAccessToken(): string {
  return (
    process.env.META_CAPI_ACCESS_TOKEN?.trim() ||
    process.env.META_ADS_ACCESS_TOKEN?.trim() ||
    process.env.META_ACCESS_TOKEN?.trim() ||
    ''
  );
}

export function isMetaCapiConfigured(): boolean {
  return META_PIXEL_ID.length > 0 && capiAccessToken().length > 0;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function metaCapiEventId(prefix: string, key: string): Promise<string> {
  return `${prefix}_${(await sha256Hex(key)).slice(0, 32)}`;
}

async function hashEmail(email: string): Promise<string> {
  return sha256Hex(email.toLowerCase().trim());
}

export function metaContextFromCookiesAndHeaders(params: {
  fbp?: string | null;
  fbc?: string | null;
  ip?: string | null;
  ua?: string | null;
  sourceUrl?: string | null;
}): MetaCapiUserContext {
  return {
    fbp: params.fbp?.trim() || undefined,
    fbc: params.fbc?.trim() || undefined,
    ip: params.ip?.split(',')[0]?.trim() || undefined,
    ua: params.ua?.trim() || undefined,
    sourceUrl: params.sourceUrl?.trim() || undefined,
  };
}

export function metaContextFromNextRequest(req: NextRequest, fallbackPath: string): MetaCapiUserContext {
  return metaContextFromCookiesAndHeaders({
    fbp: req.cookies.get('_fbp')?.value,
    fbc: req.cookies.get('_fbc')?.value,
    ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
    ua: req.headers.get('user-agent'),
    sourceUrl: req.headers.get('referer') || `${CANONICAL_APP_URL}${fallbackPath}`,
  });
}

export async function metaContextFromNextHeaders(fallbackPath: string): Promise<MetaCapiUserContext> {
  try {
    const h = await headers();
    const c = await cookies();
    return metaContextFromCookiesAndHeaders({
      fbp: c.get('_fbp')?.value,
      fbc: c.get('_fbc')?.value,
      ip: h.get('x-forwarded-for') || h.get('x-real-ip'),
      ua: h.get('user-agent'),
      sourceUrl: h.get('referer') || `${CANONICAL_APP_URL}${fallbackPath}`,
    });
  } catch {
    return { sourceUrl: `${CANONICAL_APP_URL}${fallbackPath}` };
  }
}

export async function sendMetaCapiEvent(params: {
  eventName: MetaCapiEventName;
  eventId: string;
  email: string;
  contentName: string;
  context?: MetaCapiUserContext;
}): Promise<void> {
  if (!isMetaCapiConfigured()) return;

  const token = capiAccessToken();
  const email = params.email.toLowerCase().trim();
  if (!email) return;

  const userData: Record<string, unknown> = {
    em: [await hashEmail(email)],
  };
  if (params.context?.fbp) userData.fbp = params.context.fbp;
  if (params.context?.fbc) userData.fbc = params.context.fbc;
  if (params.context?.ip) userData.client_ip_address = params.context.ip;
  if (params.context?.ua) userData.client_user_agent = params.context.ua;

  const body: Record<string, unknown> = {
    data: [
      {
        event_name: params.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: params.eventId,
        action_source: 'website',
        event_source_url: params.context?.sourceUrl || CANONICAL_APP_URL,
        user_data: userData,
        custom_data: { content_name: params.contentName },
      },
    ],
  };

  const testCode = process.env.META_CAPI_TEST_EVENT_CODE?.trim();
  if (testCode) body.test_event_code = testCode;

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${META_PIXEL_ID}/events?access_token=${encodeURIComponent(token)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.error('[meta-capi]', res.status, errBody.slice(0, 400));
    }
  } catch (err) {
    console.error('[meta-capi]', err);
  }
}
