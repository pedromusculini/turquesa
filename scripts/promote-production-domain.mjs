/**
 * Aponta www e apex para o deployment Production Ready mais recente.
 *
 * Uso:
 *   npm run deploy:promote
 *   npm run deploy:promote -- --wait
 *
 * --wait  Poll a Vercel até aparecer Production Ready (após git push).
 */
import { execSync } from 'child_process';

const VERCEL_PROJECT = 'turquesa';

const DOMAINS = [
  'www.turquesaagenda.com.br',
  'turquesaagenda.com.br',
];

const READY_RE =
  /https:\/\/(turquesa[a-z0-9-]*-pedro-henrique-musculini-s-projects\.vercel\.app)\s+●\s+Ready\s+Production/;

const wait =
  process.argv.includes('--wait') || process.env.DEPLOY_PROMOTE_WAIT === '1';

function run(cmd, inherit = true) {
  return execSync(cmd, {
    encoding: 'utf8',
    stdio: inherit ? ['pipe', 'pipe', 'inherit'] : ['pipe', 'pipe', 'pipe'],
  }).trim();
}

function findLatestReadyUrl() {
  const list = run(`npx vercel ls ${VERCEL_PROJECT} 2>&1`);
  const match = list.match(READY_RE);
  return match ? `https://${match[1]}` : null;
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForReady() {
  const maxAttempts = 40;
  for (let i = 1; i <= maxAttempts; i++) {
    const url = findLatestReadyUrl();
    if (url) {
      if (i > 1) console.log(`\n✅ Build Ready (${i}ª verificação).`);
      return url;
    }
    console.log(
      `⏳ Aguardando deploy Production Ready… (${i}/${maxAttempts}, ~15s)`,
    );
    await sleep(15000);
  }
  return null;
}

async function main() {
  let deploymentUrl = findLatestReadyUrl();

  if (!deploymentUrl && wait) {
    console.log('Nenhum Ready imediato — aguardando build da Vercel…\n');
    deploymentUrl = await waitForReady();
  }

  if (!deploymentUrl) {
    console.error(
      `❌ Nenhum deployment Production Ready. Rode \`npx vercel ls ${VERCEL_PROJECT}\` ou use --wait após o push.`,
    );
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
