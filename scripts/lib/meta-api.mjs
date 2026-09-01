/**
 * Helpers compartilhados — Meta Graph API (anúncios + Instagram orgânico).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const GRAPH_VERSION = 'v21.0';
const FACEBOOK_GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
const INSTAGRAM_GRAPH_BASE = `https://graph.instagram.com/${GRAPH_VERSION}`;

export const DEFAULT_META_AD_ACCOUNT = 'act_977732793417355';

export function isInstagramLoginToken(token) {
  return typeof token === 'string' && token.startsWith('IGAA');
}

function graphBaseForToken(token) {
  return isInstagramLoginToken(token) ? INSTAGRAM_GRAPH_BASE : FACEBOOK_GRAPH_BASE;
}

export function loadEnvLocal() {
  try {
    const raw = readFileSync(join(root, '.env.local'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq < 1) continue;
      const k = t.slice(0, eq).trim();
      let v = t.slice(eq + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (process.env[k] === undefined) process.env[k] = v;
    }
  } catch {
    /* opcional */
  }
}

export function loadMcpAdsToken() {
  try {
    const mcp = JSON.parse(
      readFileSync(join(process.env.USERPROFILE || '', '.cursor', 'mcp.json'), 'utf8'),
    );
    return mcp?.mcpServers?.['meta-ads']?.env?.META_ACCESS_TOKEN?.trim() || null;
  } catch {
    return null;
  }
}

export function loadIgToken() {
  const fromEnv = process.env.META_IG_ACCESS_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  const general = process.env.META_ACCESS_TOKEN?.trim();
  if (general && isInstagramLoginToken(general)) return general;
  return null;
}

export function loadAdsToken() {
  const fromEnv = process.env.META_ADS_ACCESS_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  const general = process.env.META_ACCESS_TOKEN?.trim();
  if (general && !isInstagramLoginToken(general)) return general;
  return loadMcpAdsToken();
}

export function loadMetaToken() {
  return loadIgToken() || loadAdsToken();
}

export function requireMetaToken() {
  const token = loadMetaToken();
  if (!token) {
    throw new Error(
      'Falta META_IG_ACCESS_TOKEN no .env.local (app Cursor-IG → Adicionar conta).',
    );
  }
  return token;
}

export function requireAdsToken() {
  const token = loadAdsToken();
  if (!token) {
    throw new Error(
      'Falta token de anúncios (META_ADS_ACCESS_TOKEN ou MCP meta-ads).',
    );
  }
  return token;
}

export function requireIgToken() {
  const token = loadIgToken();
  if (!token) {
    throw new Error(
      'Falta META_IG_ACCESS_TOKEN no .env.local (app Cursor-IG → Adicionar conta).',
    );
  }
  return token;
}

export function requireEnv(name) {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Falta ${name} no .env.local`);
  return v;
}

export async function graphGet(path, token, params = {}, graphBase) {
  const base = graphBase || graphBaseForToken(token);
  const url = new URL(`${base}/${path.replace(/^\//, '')}`);
  url.searchParams.set('access_token', token);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(`Graph GET ${path}: ${JSON.stringify(json.error || json)}`);
  }
  return json;
}

export async function graphPost(path, token, body, graphBase) {
  const base = graphBase || graphBaseForToken(token);
  const url = `${base}/${path.replace(/^\//, '')}`;

  if (body instanceof URLSearchParams) {
    body.set('access_token', token);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const json = await res.json();
    if (!res.ok || json.error) {
      throw new Error(`Graph POST ${path}: ${JSON.stringify(json.error || json)}`);
    }
    return json;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, access_token: token }),
  });
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(`Graph POST ${path}: ${JSON.stringify(json.error || json)}`);
  }
  return json;
}

export async function getTokenInfo(token) {
  return graphGet('debug_token', token, {
    input_token: token,
  }, FACEBOOK_GRAPH_BASE);
}

export async function getInstagramAccount(token) {
  return graphGet('me', token, {
    fields: 'id,username,name,user_id,account_type',
  }, INSTAGRAM_GRAPH_BASE);
}

export async function listAdAccounts(token) {
  const data = await graphGet('me/adaccounts', token, {
    fields: 'id,name,account_status,currency',
    limit: 50,
  });
  return data.data || [];
}

export async function listPages(token) {
  const data = await graphGet('me/accounts', token, {
    fields: 'id,name,access_token,instagram_business_account{id,username,name}',
    limit: 50,
  }, FACEBOOK_GRAPH_BASE);
  return data.data || [];
}

export async function getVideoSource(token, videoId, accountId = DEFAULT_META_AD_ACCOUNT) {
  try {
    const direct = await graphGet(videoId, token, {
      fields: 'id,title,description,source,length,created_time',
    }, FACEBOOK_GRAPH_BASE);
    if (direct.source) return direct;
  } catch {
    /* fallback advideos */
  }

  const videos = await listAdVideos(token, accountId);
  const found = videos.find((v) => v.id === videoId);
  if (found?.source) return found;

  throw new Error(
    `Vídeo ${videoId} sem URL acessível. Use um ID de act_.../advideos ou adicione video_url na fila.`,
  );
}

export async function listAdCreatives(token, accountId, limit = 100) {
  const data = await graphGet(`${accountId}/adcreatives`, token, {
    fields:
      'id,name,title,body,video_id,object_story_spec{page_id,instagram_user_id,video_data}',
    limit,
  }, FACEBOOK_GRAPH_BASE);
  return data.data || [];
}

export async function getAdInsights(token, objectId, since, until) {
  const fields = [
    'spend',
    'impressions',
    'reach',
    'clicks',
    'ctr',
    'cpc',
    'cpm',
    'actions',
  ].join(',');
  const data = await graphGet(`${objectId}/insights`, token, {
    fields,
    time_range: JSON.stringify({ since, until }),
  }, FACEBOOK_GRAPH_BASE);
  return data.data?.[0] || null;
}

export function normalizeCreativeName(name = '') {
  return name
    .replace(/\s+\d{4}-\d{2}-\d{2}-[a-f0-9]+$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isTurquesaCreative(c) {
  const name = (c.name || '').toLowerCase();
  const body = (c.body || '').toLowerCase();
  const link =
    c.object_story_spec?.link_data?.link ||
    c.object_story_spec?.video_data?.call_to_action?.value?.link ||
    '';
  return (
    name.includes('turquesa') ||
    body.includes('turquesa') ||
    body.includes('salão') ||
    body.includes('salao') ||
    body.includes('agenda') ||
    String(link).includes('turquesaagenda')
  );
}

export function extractVideoId(c) {
  return c.object_story_spec?.video_data?.video_id || c.video_id || null;
}

let adVideosCache = null;

export async function listAdVideos(token, accountId = DEFAULT_META_AD_ACCOUNT) {
  if (adVideosCache) return adVideosCache;
  const items = [];
  let path = `${accountId}/advideos`;
  let params = { fields: 'id,title,description,source,length,created_time', limit: 100 };
  while (path) {
    const data = await graphGet(path, token, params, FACEBOOK_GRAPH_BASE);
    items.push(...(data.data || []));
    const next = data.paging?.next;
    if (!next) break;
    const nextUrl = new URL(next);
    path = nextUrl.pathname.replace(/^\/v\d+\.\d\//, '');
    params = Object.fromEntries(nextUrl.searchParams);
    delete params.access_token;
  }
  adVideosCache = items;
  return items;
}

export async function waitForMediaContainer(token, containerId, maxAttempts = 40) {
  const base = graphBaseForToken(token);
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const status = await graphGet(containerId, token, {
        fields: 'status_code,status',
      }, base);
      if (status.status_code === 'FINISHED') return status;
      if (status.status_code === 'ERROR') {
        throw new Error(`Container ${containerId} erro: ${status.status || 'unknown'}`);
      }
    } catch (err) {
      if (i === maxAttempts - 1) throw err;
    }
    await sleep(3000);
  }
  throw new Error(`Timeout aguardando processamento do vídeo (${containerId})`);
}

export async function scheduleInstagramReel({
  token,
  igUserId,
  videoUrl,
  caption,
  scheduledUnix,
}) {
  const params = new URLSearchParams();
  params.set('media_type', 'REELS');
  params.set('video_url', videoUrl);
  params.set('caption', caption);
  params.set('share_to_feed', 'true');

  // Instagram Login (IGAA…) não suporta scheduled_publish_time de forma confiável.
  if (scheduledUnix && !isInstagramLoginToken(token)) {
    params.set('published', 'false');
    params.set('scheduled_publish_time', String(scheduledUnix));
  }

  const container = await graphPost(`${igUserId}/media`, token, params);
  await waitForMediaContainer(token, container.id);
  const published = await graphPost(`${igUserId}/media_publish`, token, new URLSearchParams({
    creation_id: container.id,
  }));

  return { containerId: container.id, published };
}

export function brDateTimeToUnix(isoLocal) {
  // ISO com offset, ex: 2026-09-02T18:00:00-03:00
  return Math.floor(new Date(isoLocal).getTime() / 1000);
}

export function addDaysAtHour(baseDate, days, hour = 18, minute = 0) {
  const d = new Date(baseDate);
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  const pad = (n) => String(n).padStart(2, '0');
  const offsetMin = -d.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  const off = `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(hour)}:${pad(minute)}:00${off}`;
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function ensurePublicReelUrl(adsToken, videoId, accountId = DEFAULT_META_AD_ACCOUNT) {
  const video = await getVideoSource(adsToken, videoId, accountId);
  if (!video.source) throw new Error(`Vídeo ${videoId} sem source`);

  const res = await fetch(video.source);
  if (!res.ok) throw new Error(`Download do vídeo ${videoId} falhou (${res.status})`);
  const buffer = Buffer.from(await res.arrayBuffer());

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (supabaseUrl && serviceKey) {
    const supabase = createClient(supabaseUrl, serviceKey);
    const bucket = 'meta-reels';
    await supabase.storage.createBucket(bucket, { public: true }).catch(() => {});

    const path = `${videoId}.mp4`;
    const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
      contentType: 'video/mp4',
      upsert: true,
    });
    if (error) throw new Error(`Upload Supabase ${videoId}: ${error.message}`);

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  const localDir = join(root, 'public', 'meta-reels');
  mkdirSync(localDir, { recursive: true });
  const filePath = join(localDir, `${videoId}.mp4`);
  writeFileSync(filePath, buffer);
  return `https://www.turquesaagenda.com.br/meta-reels/${videoId}.mp4`;
}

export const DEFAULT_REEL_CAPTION = `Organize seu salão com agenda, clientes e financeiro em um só lugar.

✅ Google Calendar + WhatsApp
✅ 30 dias grátis — sem cartão

👉 turquesaagenda.com.br`;
