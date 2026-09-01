/**
 * OAuth local — gera META_ACCESS_TOKEN com permissões de anúncios + publicação no Instagram.
 *
 * Uso:
 *   1) Crie app em developers.facebook.com (tipo Business)
 *   2) Adicione Facebook Login + Marketing API + Instagram Graph API
 *   3) Redirect URI: http://127.0.0.1:53683/oauth2callback
 *   4) Coloque META_APP_ID e META_APP_SECRET no .env.local
 *   5) npm run meta:oauth
 */
import { createServer } from 'http';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { loadEnvLocal } from './lib/meta-api.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 53683;
const REDIRECT_URI = `http://127.0.0.1:${PORT}/oauth2callback`;
const SCOPES = [
  'ads_management',
  'ads_read',
  'business_management',
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
  'instagram_basic',
  'instagram_content_publish',
].join(',');

function openBrowser(url) {
  const cmd =
    process.platform === 'win32'
      ? `start "" "${url}"`
      : process.platform === 'darwin'
        ? `open "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd);
}

async function exchangeLongLivedToken(shortToken, appId, appSecret) {
  const url = new URL('https://graph.facebook.com/v21.0/oauth/access_token');
  url.searchParams.set('grant_type', 'fb_exchange_token');
  url.searchParams.set('client_id', appId);
  url.searchParams.set('client_secret', appSecret);
  url.searchParams.set('fb_exchange_token', shortToken);
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(`Long-lived token: ${JSON.stringify(json)}`);
  }
  return json;
}

async function main() {
  loadEnvLocal();
  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();
  if (!appId || !appSecret) {
    console.error(
      'Faltam META_APP_ID e META_APP_SECRET no .env.local\nVer docs/META_INSTAGRAM_PUBLISH.md',
    );
    process.exit(1);
  }

  const authUrl = new URL('https://www.facebook.com/v21.0/dialog/oauth');
  authUrl.searchParams.set('client_id', appId);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPES);

  console.log('\nAbra no navegador e autorize com a conta que administra Turquesa:\n');
  console.log(authUrl.toString());
  console.log('\nAguardando callback em', REDIRECT_URI, '...\n');
  openBrowser(authUrl.toString());

  const code = await new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      try {
        const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
        if (url.pathname !== '/oauth2callback') {
          res.writeHead(404);
          res.end('not found');
          return;
        }
        const err = url.searchParams.get('error');
        if (err) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`<h1>Erro OAuth</h1><pre>${err}</pre>`);
          reject(new Error(err));
          server.close();
          return;
        }
        const authCode = url.searchParams.get('code');
        if (!authCode) {
          res.writeHead(400);
          res.end('missing code');
          reject(new Error('missing code'));
          server.close();
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>OK</h1><p>Pode fechar esta aba e voltar ao terminal.</p>');
        resolve(authCode);
        server.close();
      } catch (e) {
        reject(e);
        server.close();
      }
    });
    server.listen(PORT, '127.0.0.1');
  });

  const tokenRes = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?` +
      new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        redirect_uri: REDIRECT_URI,
        code,
      }),
  );
  const shortJson = await tokenRes.json();
  if (!tokenRes.ok || shortJson.error) {
    console.error('Erro trocando code:', shortJson);
    process.exit(1);
  }

  const longJson = await exchangeLongLivedToken(
    shortJson.access_token,
    appId,
    appSecret,
  );

  console.log('\n✅ Token de longa duração obtido.\n');
  console.log('Cole no .env.local:\n');
  console.log(`META_ACCESS_TOKEN=${longJson.access_token}`);
  if (longJson.expires_in) {
    const days = Math.round(longJson.expires_in / 86400);
    console.log(`\n# Expira em ~${days} dias — renove com npm run meta:oauth`);
  }
  console.log('\nDepois rode: npm run meta:ig:accounts');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
