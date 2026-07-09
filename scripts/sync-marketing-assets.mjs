/**
 * Copia assets gráficos do app para marketing/ (pasta local, .gitignore).
 * Uso: npm run marketing:sync
 */
import { cpSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';

const root = process.cwd();
const out = join(root, 'marketing');

function ensureDir(rel) {
  const p = join(out, rel);
  mkdirSync(p, { recursive: true });
  return p;
}

function copyFile(from, toRel) {
  const src = join(root, from);
  if (!existsSync(src)) {
    console.warn(`  [skip] ${from}`);
    return;
  }
  const dest = join(out, toRel);
  mkdirSync(join(dest, '..'), { recursive: true });
  cpSync(src, dest);
  console.log(`  ${toRel}`);
}

function copyDir(from, toRel) {
  const src = join(root, from);
  if (!existsSync(src)) {
    console.warn(`  [skip dir] ${from}`);
    return;
  }
  const dest = ensureDir(toRel);
  for (const name of readdirSync(src)) {
    cpSync(join(src, name), join(dest, name));
    console.log(`  ${toRel}/${name}`);
  }
}

console.log('Sincronizando marketing/ …\n');

console.log('marca/');
copyFile('docs/PALETA_CORES.md', 'marca/PALETA_CORES.md');
copyFile('docs/paleta-cores.html', 'marca/paleta-cores.html');
copyFile('public/manifest.webmanifest', 'marca/manifest.webmanifest');

console.log('\nlogos/');
copyDir('public/portfolio-logos', 'logos');

console.log('\npwa/');
copyFile('public/icon-192.png', 'pwa/icon-192.png');
copyFile('public/icon-512.png', 'pwa/icon-512.png');
copyFile('public/apple-icon.png', 'pwa/apple-icon.png');
copyFile('public/favicon.png', 'pwa/favicon.png');

console.log('\napp/');
copyFile('app/icon.png', 'app/icon.png');
copyFile('app/icon.svg', 'app/icon.svg');
copyFile('app/apple-icon.png', 'app/apple-icon.png');

console.log('\nlanding/ (logo hero da página inicial)');
copyFile(
  'public/portfolio-logos/logo-hero-turquesa-agenda-pro.svg',
  'landing/logo-hero-turquesa-agenda-pro.svg',
);
copyFile(
  'public/portfolio-logos/logo-hero-turquesa-agenda-pro-transparent.png',
  'landing/logo-hero-turquesa-agenda-pro-transparent.png',
);
copyFile(
  'scripts/marketing-templates/landing-hero-com-animacao.html',
  'landing/hero-com-animacao.html',
);
copyFile(
  'scripts/marketing-templates/landing-hero-sem-animacao.html',
  'landing/hero-sem-animacao.html',
);
copyFile(
  'scripts/marketing-templates/landing-hero-sem-animacao-transparente.html',
  'landing/hero-sem-animacao-fundo-transparente.html',
);

console.log('\nPronto. Pasta marketing/ atualizada (local, não versionada).');
