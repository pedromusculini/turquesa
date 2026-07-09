/**
 * Aplica um arquivo SQL em sql/ via Supabase Management API.
 * Uso: node scripts/apply-sql-file.mjs consultas_whatsapp_schema.sql
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

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

const file = process.argv[2];
if (!file) {
  console.error('Uso: node scripts/apply-sql-file.mjs <arquivo.sql>');
  process.exit(1);
}

const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

if (!accessToken || !supabaseUrl) {
  console.error('❌ Defina SUPABASE_ACCESS_TOKEN e NEXT_PUBLIC_SUPABASE_URL em .env.local');
  process.exit(1);
}

const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
const sqlPath = join(root, 'sql', file);
const sql = readFileSync(sqlPath, 'utf8');

const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
});

const body = await res.json().catch(() => ({}));

if (!res.ok) {
  console.error(`❌ Erro ao aplicar ${file}:`, res.status, body);
  process.exit(1);
}

console.log(`✅ ${file} aplicado no projeto ${projectRef}`);
