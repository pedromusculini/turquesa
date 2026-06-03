/**
 * Cria o bucket público catalogo-fotos no Supabase Storage (upload do catálogo).
 * Uso: node scripts/create-catalogo-fotos-bucket.mjs
 *      npm run storage:catalogo-fotos
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const BUCKET = 'catalogo-fotos';
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

function loadEnvLocal() {
  try {
    const raw = readFileSync(join(root, '.env.local'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    /* ignore */
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('❌ Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local');
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  console.log('🔗 Supabase:', url.replace(/https:\/\/([^.]+).*/, 'https://$1.***'));

  const { data: existing, error: getError } = await supabase.storage.getBucket(BUCKET);
  if (existing && !getError) {
    console.log(`✅ Bucket "${BUCKET}" já existe (public: ${existing.public ?? '?'})`);
    return;
  }

  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    allowedMimeTypes: ALLOWED_MIME,
  });

  if (error) {
    const msg = error.message || String(error);
    if (/already exists|duplicate/i.test(msg)) {
      console.log(`✅ Bucket "${BUCKET}" já existe.`);
      return;
    }
    console.error('❌ Falha ao criar bucket:', msg);
    process.exit(1);
  }

  console.log(`✅ Bucket "${BUCKET}" criado (público, MIME: ${ALLOWED_MIME.join(', ')})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
