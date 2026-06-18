/**
 * Aponta www e apex para o deployment Production Ready mais recente.
 *
 * Uso:
 *   npm run deploy:promote
 *   npm run deploy:promote -- --wait
 *
 * --wait  Poll a Vercel até o deploy Production mais recente ficar Ready.
 */
import { execSync } from 'child_process';

const VERCEL_PROJECT = 'turquesa';

const DOMAINS = [
  'www.turquesaagenda.com.br',
  'turquesaagenda.com.br',
];

const PRODUCTION_LINE_RE =
  /https:\/\/(turquesa[a-z0-9-]*-pedro-henrique-musculini-s-projects\.vercel\.app)\s+●\s+(Ready|Queued|Building|Error|Canceled)\s+Production/;

const wait =
  process.argv.includes('--wait') || process.env.DEPLOY_PROMOTE_WAIT === '1';

function run(cmd, inherit = true) {
  return execSync(cmd, {
    encoding: 'utf8',
    stdio: inherit ? ['pipe', 'pipe', 'inherit'] : ['pipe', 'pipe', 'pipe'],
  }).trim();
}

function listDeployments() {
  return run(`npx vercel ls ${VERCEL_PROJECT} 2>&1`);
}

/** Primeira linha Production na lista (deploy mais recente). */
function parseLatestProduction(list) {
  for (const line of list.split('\n')) {
    const match = line.match(PRODUCTION_LINE_RE);
    if (match) {
      return { url: `https://${match[1]}`, status: match[2] };
    }
  }
  return null;
}

function findLatestReadyUrl() {
  const latest = parseLatestProduction(listDeployments());
  if (!latest || latest.status !== 'Ready') return null;
  return latest.url;
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForReady() {
  const maxAttempts = 40;
  for (let i = 1; i <= maxAttempts; i++) {
    const latest = parseLatestProduction(listDeployments());
    if (latest?.status === 'Ready') {
      if (i > 1) console.log(`\n✅ Build Ready (${i}ª verificação).`);
      return latest.url;
    }
    if (latest && (latest.status === 'Error' || latest.status === 'Canceled')) {
      throw new Error(
        `Deploy mais recente falhou (${latest.status}): ${latest.url}`,
      );
    }
    const statusLabel = latest?.status ?? 'desconhecido';
    console.log(
      `⏳ Aguardando deploy Production Ready… (${i}/${maxAttempts}, ~15s) — atual: ${statusLabel}`,
    );
    await sleep(15000);
  }
  return null;
}

async function main() {
  let latest = parseLatestProduction(listDeployments());
  let deploymentUrl = latest?.status === 'Ready' ? latest.url : null;

  if (!deploymentUrl && wait) {
    console.log('Deploy mais recente ainda não está Ready — aguardando build da Vercel…\n');
    deploymentUrl = await waitForReady();
  }

  if (!deploymentUrl) {
    latest = parseLatestProduction(listDeployments());
    if (latest && latest.status !== 'Ready') {
      console.error(
        `❌ Deploy mais recente ainda está ${latest.status} (${latest.url}).`,
      );
      console.error('   Use --wait após o push ou aguarde o build terminar.');
    } else {
      console.error(
        `❌ Nenhum deployment Production Ready. Rode \`npx vercel ls ${VERCEL_PROJECT}\` ou use --wait após o push.`,
      );
    }
    process.exit(1);
  }

  console.log(`📦 Deploy mais recente: ${deploymentUrl}`);

  for (const domain of DOMAINS) {
    run(`npx vercel alias set ${deploymentUrl} ${domain}`);
    console.log(`✅ ${domain}`);
  }

  console.log('\nPronto. Teste em aba anônima: https://www.turquesaagenda.com.br');
}

main().catch((err) => {
  console.error('❌ Erro:', err.message || err);
  process.exit(1);
});
