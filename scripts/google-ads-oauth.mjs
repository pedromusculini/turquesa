/**
 * OAuth local — gera GOOGLE_ADS_REFRESH_TOKEN para a Google Ads API.
 *
 * Uso:
 *   1) Configure OAuth Desktop no Cloud Console (ver docs/GOOGLE_ADS_API.md)
 *   2) Coloque GOOGLE_ADS_CLIENT_ID e GOOGLE_ADS_CLIENT_SECRET no .env.local
 *   3) npm run ads:oauth
 *   4) Autorize no browser; o refresh_token é impresso no terminal
 */
import { createServer } from 'http';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 53682;
const REDIRECT_URI = `http://127.0.0.1:${PORT}/oauth2callback`;
const SCOPE = 'https://www.googleapis.com/auth/adwords';

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
    /* .env.local opcional se vars já estiverem no ambiente */
  }
}

function openBrowser(url) {
  const cmd =
    process.platform === 'win32'
      ? `start "" "${url}"`
      : process.platform === 'darwin'
        ? `open "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd);
}

async function main() {
  loadEnvLocal();
  const clientId = (
    process.env.GOOGLE_ADS_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || ''
  ).trim();
  const clientSecret = (
    process.env.GOOGLE_ADS_CLIENT_SECRET ||
    process.env.GOOGLE_CLIENT_SECRET ||
    ''
  ).trim();

  if (!clientId || !clientSecret) {
    console.error(
      'Faltam GOOGLE_ADS_CLIENT_ID / GOOGLE_ADS_CLIENT_SECRET (ou GOOGLE_CLIENT_*) no .env.local\nVer docs/GOOGLE_ADS_API.md',
    );
    process.exit(1);
  }
  console.log(
    'Usando client:',
    process.env.GOOGLE_ADS_CLIENT_ID ? 'GOOGLE_ADS_CLIENT_ID' : 'GOOGLE_CLIENT_ID',
  );

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPE);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');

  console.log('\n1) No Cloud Console, o redirect URI do cliente OAuth deve ser:');
  console.log(`   ${REDIRECT_URI}`);
  console.log('\n2) Abrindo o browser para autorizar Google Ads…\n');

  const code = await new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      try {
        const u = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
        if (u.pathname !== '/oauth2callback') {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        const err = u.searchParams.get('error');
        if (err) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`<p>Erro OAuth: ${err}</p>`);
          reject(new Error(err));
          server.close();
          return;
        }
        const authCode = u.searchParams.get('code');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(
          '<p><b>OK.</b> Pode fechar esta aba e voltar ao terminal.</p>',
        );
        server.close();
        resolve(authCode);
      } catch (e) {
        reject(e);
        server.close();
      }
    });
    server.listen(PORT, '127.0.0.1', () => {
      openBrowser(authUrl.toString());
      console.log('Se o browser não abrir, cole esta URL:\n');
      console.log(authUrl.toString());
      console.log('');
    });
  });

  if (!code) {
    console.error('Sem código de autorização.');
    process.exit(1);
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });
  const tokenJson = await tokenRes.json();
  if (!tokenRes.ok) {
    console.error('Falha ao trocar code por token:', tokenJson);
    process.exit(1);
  }

  if (!tokenJson.refresh_token) {
    console.error(
      'Google não devolveu refresh_token. Revogue o acesso do app em https://myaccount.google.com/permissions e rode de novo com prompt=consent.',
    );
    console.log('access_token (curto):', tokenJson.access_token?.slice(0, 16) + '…');
    process.exit(1);
  }

  console.log('\n✅ Cole no .env.local:\n');
  console.log(`GOOGLE_ADS_REFRESH_TOKEN=${tokenJson.refresh_token}`);
  console.log('');
}

main().catch((err) => {
  console.error('❌', err.message || err);
  process.exit(1);
});
