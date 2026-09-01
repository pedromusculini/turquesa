/**
 * Instagram orgânico — listar vídeos de anúncios, planejar fila e agendar Reels.
 *
 * Comandos:
 *   npm run meta:ig:accounts
 *   npm run meta:ig:videos
 *   npm run meta:ig:plan
 *   npm run meta:ig:schedule -- --queue assets/meta/instagram-queue.json
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import {
  DEFAULT_META_AD_ACCOUNT,
  DEFAULT_REEL_CAPTION,
  addDaysAtHour,
  brDateTimeToUnix,
  extractVideoId,
  ensurePublicReelUrl,
  getAdInsights,
  getInstagramAccount,
  getVideoSource,
  isTurquesaCreative,
  listAdCreatives,
  listPages,
  loadAdsToken,
  loadEnvLocal,
  normalizeCreativeName,
  requireAdsToken,
  requireIgToken,
  scheduleInstagramReel,
} from './lib/meta-api.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--account' && argv[i + 1]) args.account = argv[++i];
    else if (a === '--ig' && argv[i + 1]) args.ig = argv[++i];
    else if (a === '--queue' && argv[i + 1]) args.queue = argv[++i];
    else if (a === '--video' && argv[i + 1]) args.video = argv[++i];
    else if (a === '--caption' && argv[i + 1]) args.caption = argv[++i];
    else if (a === '--at' && argv[i + 1]) args.at = argv[++i];
    else if (a === '--days' && argv[i + 1]) args.days = Number(argv[++i]);
    else if (a === '--hour' && argv[i + 1]) args.hour = Number(argv[++i]);
    else if (a === '--since' && argv[i + 1]) args.since = argv[++i];
    else if (a === '--until' && argv[i + 1]) args.until = argv[++i];
    else if (!a.startsWith('-')) args._.push(a);
  }
  return args;
}

async function cmdAccounts() {
  const igToken = requireIgToken();
  const ig = await getInstagramAccount(igToken);
  console.log('\nInstagram conectado (app Cursor-IG):\n');
  console.log(`• @${ig.username || '?'} (${ig.name || ''})`);
  console.log(`  META_INSTAGRAM_USER_ID=${ig.id}`);
  if (ig.user_id) console.log(`  user_id (legado): ${ig.user_id}`);
  console.log(`  tipo: ${ig.account_type || '?'}`);

  const adsToken = loadAdsToken();
  if (!adsToken) {
    console.log('\nToken de anúncios: não configurado (vídeos da biblioteca usam MCP meta-ads).');
    return;
  }

  try {
    const pages = await listPages(adsToken);
    if (pages.length > 0) {
      console.log('\nPáginas Facebook (token de anúncios):\n');
      for (const p of pages) {
        const linked = p.instagram_business_account;
        console.log(`• Página: ${p.name} (${p.id})`);
        if (linked) {
          console.log(`  Instagram vinculado: @${linked.username || '?'} (${linked.id})`);
        }
      }
    }
  } catch {
    console.log('\nPáginas Facebook: token de anúncios sem pages_show_list (ok para listar criativos).');
  }
}

async function collectTurquesaVideos(token, accountId, since, until) {
  const creatives = await listAdCreatives(token, accountId, 100);
  const byKey = new Map();
  const byVideoId = new Map();

  for (const c of creatives) {
    if (!isTurquesaCreative(c)) continue;
    const videoId = extractVideoId(c);
    if (!videoId) continue;
    if (byVideoId.has(videoId)) continue;
    const key = normalizeCreativeName(c.name || c.title || videoId);
    if (!byKey.has(key)) {
      const item = {
        key,
        video_id: videoId,
        creative_id: c.id,
        name: c.name || c.title || key,
        instagram_user_id: c.object_story_spec?.instagram_user_id || null,
        insights: null,
      };
      byKey.set(key, item);
      byVideoId.set(videoId, item);
    }
  }

  const items = [...byKey.values()];
  if (since && until) {
    for (const item of items) {
      try {
        item.insights = await getAdInsights(token, item.creative_id, since, until);
      } catch {
        item.insights = null;
      }
    }
    items.sort((a, b) => Number(b.insights?.spend || 0) - Number(a.insights?.spend || 0));
  }

  return items;
}

async function cmdVideos(token, args) {
  const accountId = args.account || process.env.META_AD_ACCOUNT_ID || DEFAULT_META_AD_ACCOUNT;
  const since = args.since || '2026-07-01';
  const until = args.until || new Date().toISOString().slice(0, 10);
  const items = await collectTurquesaVideos(token, accountId, since, until);

  console.log(`\nVídeos Turquesa únicos: ${items.length} (conta ${accountId})\n`);
  for (const v of items) {
    const spend = v.insights ? `R$ ${Number(v.insights.spend || 0).toFixed(2)}` : '—';
    const ctr = v.insights?.ctr ? `${Number(v.insights.ctr).toFixed(2)}%` : '—';
    console.log(`• ${v.key}`);
    console.log(`  video_id: ${v.video_id} | spend: ${spend} | ctr: ${ctr}`);
  }
}

async function cmdPlan(token, args) {
  const accountId = args.account || process.env.META_AD_ACCOUNT_ID || DEFAULT_META_AD_ACCOUNT;
  const igUserId = args.ig || process.env.META_INSTAGRAM_USER_ID;
  if (!igUserId) {
    throw new Error('Informe --ig ou META_INSTAGRAM_USER_ID no .env.local (rode meta:ig:accounts).');
  }

  const items = await collectTurquesaVideos(
    token,
    accountId,
    args.since || '2026-07-01',
    args.until || new Date().toISOString().slice(0, 10),
  );

  const days = args.days ?? 1;
  const hour = args.hour ?? 18;
  const start = new Date();
  start.setDate(start.getDate() + 1);

  const queue = {
    instagram_user_id: igUserId,
    default_caption: DEFAULT_REEL_CAPTION,
    posts: items.map((v, idx) => ({
      video_id: v.video_id,
      name: v.key,
      caption: DEFAULT_REEL_CAPTION,
      scheduled_at: addDaysAtHour(start, idx * days, hour, 0),
    })),
  };

  const outDir = join(root, 'assets', 'meta');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'instagram-queue.json');
  writeFileSync(outPath, JSON.stringify(queue, null, 2), 'utf8');

  console.log(`\n✅ Fila gerada: ${outPath}`);
  console.log(`   ${queue.posts.length} Reels — 1 a cada ${days} dia(s) às ${hour}h`);
  console.log('\nRevise legendas/nomes e rode:');
  console.log('   npm run meta:ig:schedule -- --queue assets/meta/instagram-queue.json');
}

async function cmdScheduleOne(args) {
  const igToken = requireIgToken();
  const adsToken = requireAdsToken();
  const igUserId = args.ig || process.env.META_INSTAGRAM_USER_ID;
  const videoId = args.video;
  if (!igUserId) throw new Error('Falta --ig ou META_INSTAGRAM_USER_ID');
  if (!videoId) throw new Error('Falta --video <video_id>');
  if (!args.at) throw new Error('Falta --at (ex: 2026-09-02T18:00:00-03:00)');

  const videoUrl = args.video_url
    || (await getVideoSource(adsToken, videoId)).source;
  if (!videoUrl) throw new Error(`Vídeo ${videoId} sem URL de download`);

  const caption = args.caption || DEFAULT_REEL_CAPTION;
  const scheduledUnix = brDateTimeToUnix(args.at);

  console.log(`\nAgendando Reels para ${args.at}…`);
  const result = await scheduleInstagramReel({
    token: igToken,
    igUserId,
    videoUrl,
    caption,
    scheduledUnix,
  });

  console.log('✅ Agendado:', JSON.stringify(result, null, 2));
}

async function resolvePostVideoUrl(adsToken, post) {
  if (post.video_url) return post.video_url;
  console.log(`  ↳ Hospedando ${post.video_id} no Supabase…`);
  return ensurePublicReelUrl(adsToken, post.video_id);
}

function isDue(scheduledAt) {
  return brDateTimeToUnix(scheduledAt) <= Math.floor(Date.now() / 1000) + 60;
}

async function publishQueuePosts({ igToken, adsToken, queue, queuePath, onlyDue = false }) {
  const igUserId = queue.instagram_user_id || process.env.META_INSTAGRAM_USER_ID;
  if (!igUserId) throw new Error('Falta instagram_user_id na fila ou META_INSTAGRAM_USER_ID');

  let changed = false;
  for (const post of queue.posts || []) {
    if (post.published_at) continue;
    if (onlyDue && !isDue(post.scheduled_at)) {
      console.log(`⏳ ${post.name} — agendado para ${post.scheduled_at}`);
      continue;
    }

    console.log(`→ ${post.name || post.video_id} @ ${post.scheduled_at}`);
    try {
      const videoUrl = await resolvePostVideoUrl(adsToken, post);
      post.video_url = videoUrl;
      const caption = post.caption || queue.default_caption || DEFAULT_REEL_CAPTION;
      const result = await scheduleInstagramReel({
        token: igToken,
        igUserId,
        videoUrl,
        caption,
        scheduledUnix: null,
      });
      post.published_at = new Date().toISOString();
      post.container_id = result.containerId;
      changed = true;
      console.log(`  ✅ ${result.containerId}`);
    } catch (err) {
      console.error(`  ❌ ${err.message}`);
    }
  }

  if (changed && queuePath) {
    writeFileSync(queuePath, JSON.stringify(queue, null, 2), 'utf8');
  }
}

async function cmdPrepareQueue(args) {
  const adsToken = requireAdsToken();
  const queuePath = args.queue || join(root, 'assets', 'meta', 'instagram-queue.json');
  const queue = JSON.parse(readFileSync(queuePath, 'utf8'));

  console.log('\nPreparando vídeos da fila (upload Supabase)…\n');
  for (const post of queue.posts || []) {
    if (post.video_url) {
      console.log(`✓ ${post.name} — já tem URL`);
      continue;
    }
    console.log(`→ ${post.name}`);
    post.video_url = await ensurePublicReelUrl(adsToken, post.video_id);
    console.log(`  ${post.video_url}`);
  }
  writeFileSync(queuePath, JSON.stringify(queue, null, 2), 'utf8');
  console.log('\n✅ Fila atualizada com URLs públicas.');
}

async function cmdScheduleQueue(args) {
  const igToken = requireIgToken();
  const adsToken = requireAdsToken();
  const queuePath = args.queue || join(root, 'assets', 'meta', 'instagram-queue.json');
  const raw = readFileSync(queuePath, 'utf8');
  const queue = JSON.parse(raw);

  console.log(`\nPublicando itens vencidos (${queue.posts?.length || 0} na fila)…\n`);
  await publishQueuePosts({ igToken, adsToken, queue, queuePath, onlyDue: true });
}

async function cmdPublishDue(args) {
  const igToken = requireIgToken();
  const adsToken = requireAdsToken();
  const queuePath = args.queue || join(root, 'assets', 'meta', 'instagram-queue.json');
  const raw = readFileSync(queuePath, 'utf8');
  const queue = JSON.parse(raw);

  console.log(`\nPublicando itens vencidos da fila…\n`);
  await publishQueuePosts({ igToken, adsToken, queue, queuePath, onlyDue: true });
}

async function main() {
  loadEnvLocal();
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0] || 'accounts';

  switch (cmd) {
    case 'accounts':
      await cmdAccounts();
      break;
    case 'videos':
      await cmdVideos(requireAdsToken(), args);
      break;
    case 'plan':
      await cmdPlan(requireAdsToken(), args);
      break;
    case 'prepare':
      await cmdPrepareQueue(args);
      break;
    case 'schedule':
      if (args.video) await cmdScheduleOne(args);
      else await cmdScheduleQueue(args);
      break;
    case 'publish-due':
      await cmdPublishDue(args);
      break;
  }
}

main().catch((err) => {
  console.error('\n❌', err.message);
  process.exit(1);
});
