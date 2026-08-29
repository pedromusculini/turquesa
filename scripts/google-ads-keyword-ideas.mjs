/**
 * Keyword ideas via Google Ads API oficial (KeywordPlanIdeaService).
 *
 * Uso:
 *   npm run ads:keywords
 *   npm run ads:keywords -- "agenda salão" "sistema agenda barbearia"
 *   npm run ads:accounts
 *
 * Requer vars no .env.local — ver docs/GOOGLE_ADS_API.md
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const API_VERSION = 'v22';
const GEO_BRAZIL = 'geoTargetConstants/2076';
const LANG_PT = 'languageConstants/1014';

const DEFAULT_SEEDS = [
  'agenda salão',
  'sistema agenda salão',
  'agendamento online salão',
  'agenda barbearia',
  'software salão de beleza',
  'sistema para salão',
];

function loadEnvLocal() {
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
    /* ignore */
  }
}

function requireEnv(name) {
  const v = process.env[name]?.trim();
  if (!v) {
    throw new Error(`Falta ${name} no .env.local — ver docs/GOOGLE_ADS_API.md`);
  }
  return v;
}

function digitsOnly(id) {
  return String(id).replace(/\D/g, '');
}

function clientId() {
  return (
    process.env.GOOGLE_ADS_CLIENT_ID?.trim() ||
    process.env.GOOGLE_CLIENT_ID?.trim() ||
    ''
  );
}

function clientSecret() {
  return (
    process.env.GOOGLE_ADS_CLIENT_SECRET?.trim() ||
    process.env.GOOGLE_CLIENT_SECRET?.trim() ||
    ''
  );
}

async function getAccessToken() {
  const id = clientId();
  const secret = clientSecret();
  if (!id || !secret) {
    throw new Error(
      'Falta GOOGLE_ADS_CLIENT_ID/SECRET (ou GOOGLE_CLIENT_*) no .env.local',
    );
  }
  const refreshToken = requireEnv('GOOGLE_ADS_REFRESH_TOKEN');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: id,
      client_secret: secret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`OAuth token: ${JSON.stringify(json)}`);
  }
  return json.access_token;
}

function adsHeaders(accessToken) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'developer-token': requireEnv('GOOGLE_ADS_DEVELOPER_TOKEN'),
    'Content-Type': 'application/json',
  };
  const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.trim();
  if (loginCustomerId) {
    headers['login-customer-id'] = digitsOnly(loginCustomerId);
  }
  return headers;
}

async function listAccessibleCustomers(accessToken) {
  const res = await fetch(
    `https://googleads.googleapis.com/${API_VERSION}/customers:listAccessibleCustomers`,
    { headers: adsHeaders(accessToken) },
  );
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`listAccessibleCustomers: ${JSON.stringify(json)}`);
  }
  return json.resourceNames || [];
}

async function generateKeywordIdeas(accessToken, customerId, seeds) {
  const cid = digitsOnly(customerId);
  const res = await fetch(
    `https://googleads.googleapis.com/${API_VERSION}/customers/${cid}:generateKeywordIdeas`,
    {
      method: 'POST',
      headers: adsHeaders(accessToken),
      body: JSON.stringify({
        language: LANG_PT,
        geoTargetConstants: [GEO_BRAZIL],
        keywordPlanNetwork: 'GOOGLE_SEARCH',
        includeAdultKeywords: false,
        keywordSeed: { keywords: seeds },
      }),
    },
  );
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`generateKeywordIdeas: ${JSON.stringify(json, null, 2)}`);
  }
  return json.results || [];
}

function microsToBrl(micros) {
  if (micros == null || micros === '') return null;
  return Number(micros) / 1_000_000;
}

function formatRow(idea) {
  const m = idea.keywordIdeaMetrics || {};
  return {
    keyword: idea.text,
    avg_monthly_searches: m.avgMonthlySearches ?? null,
    competition: m.competition ?? null,
    competition_index: m.competitionIndex ?? null,
    low_top_of_page_bid_brl: microsToBrl(m.lowTopOfPageBidMicros),
    high_top_of_page_bid_brl: microsToBrl(m.highTopOfPageBidMicros),
  };
}

async function main() {
  loadEnvLocal();
  const mode = process.argv[2] === 'accounts' ? 'accounts' : 'keywords';

  const accessToken = await getAccessToken();

  if (mode === 'accounts') {
    const names = await listAccessibleCustomers(accessToken);
    console.log('\nContas acessíveis:\n');
    for (const name of names) {
      const id = name.replace('customers/', '');
      console.log(`  ${id}`);
    }
    console.log(
      '\nUse um desses IDs em GOOGLE_ADS_CUSTOMER_ID (só dígitos).\nSe for MCC, coloque o ID do gerente em GOOGLE_ADS_LOGIN_CUSTOMER_ID.\n',
    );
    return;
  }

  const seeds =
    process.argv.slice(2).filter((a) => a && a !== 'keywords').length > 0
      ? process.argv.slice(2).filter((a) => a && a !== 'keywords')
      : DEFAULT_SEEDS;

  const customerId =
    (process.env.GOOGLE_ADS_CUSTOMER_ID &&
    process.env.GOOGLE_ADS_CUSTOMER_ID !== '8852818783'
      ? process.env.GOOGLE_ADS_CUSTOMER_ID
      : process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) ||
    requireEnv('GOOGLE_ADS_CUSTOMER_ID');
  console.log(`Seeds (${seeds.length}):`, seeds.join(' | '));
  console.log(`Customer: ${digitsOnly(customerId)} · BR · PT\n`);

  const results = await generateKeywordIdeas(accessToken, customerId, seeds);
  const rows = results.map(formatRow).sort((a, b) => {
    const av = a.avg_monthly_searches ?? -1;
    const bv = b.avg_monthly_searches ?? -1;
    return bv - av;
  });

  console.table(
    rows.slice(0, 40).map((r) => ({
      keyword: r.keyword,
      searches: r.avg_monthly_searches,
      competition: r.competition,
      bid_low: r.low_top_of_page_bid_brl?.toFixed?.(2) ?? r.low_top_of_page_bid_brl,
      bid_high: r.high_top_of_page_bid_brl?.toFixed?.(2) ?? r.high_top_of_page_bid_brl,
    })),
  );

  const outDir = join(root, 'assets', 'ads', 'google');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'keyword-ideas-latest.json');
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        customer_id: digitsOnly(customerId),
        seeds,
        geo: 'BR',
        language: 'pt',
        results: rows,
      },
      null,
      2,
    ),
  );
  console.log(`\nSalvo: ${outPath} (${rows.length} ideias)\n`);

  const withBids = rows.filter((r) => r.low_top_of_page_bid_brl != null);
  if (withBids.length) {
    const avgLow =
      withBids.reduce((s, r) => s + r.low_top_of_page_bid_brl, 0) / withBids.length;
    const avgHigh =
      withBids.reduce((s, r) => s + r.high_top_of_page_bid_brl, 0) /
      withBids.length;
    console.log(
      `CPC topo de página (média das ideias com bid): R$ ${avgLow.toFixed(2)} – R$ ${avgHigh.toFixed(2)}`,
    );
    console.log(
      `Com R$ 15/dia ≈ ${Math.max(1, Math.floor(15 / avgHigh))}–${Math.max(1, Math.floor(15 / avgLow))} cliques/dia (ordem de grandeza).\n`,
    );
  }
}

main().catch((err) => {
  console.error('\n❌', err.message || err);
  console.error('\nDica: developer token “teste” só acessa contas de teste.');
  console.error('Produção precisa de token Basic/Standard — docs/GOOGLE_ADS_API.md\n');
  process.exit(1);
});
