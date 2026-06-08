/**
 * Gera favicon / apple-icon PNG a partir do monograma LOGO-E (logo-e-monograma-ta.svg).
 * Uso: node scripts/generate-favicon-from-monogram.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const sourceSvg = path.join(
  root,
  'public/portfolio-logos/logo-e-monograma-ta.svg',
);

const outputs = [
  { file: 'public/favicon.png', size: 32 },
  { file: 'public/apple-icon.png', size: 180 },
  { file: 'app/icon.png', size: 32 },
  { file: 'app/apple-icon.png', size: 180 },
];

/** app/favicon.ico legado (MedSup) sobrescreve o monograma — não usar */
const legacyIco = path.join(root, 'app/favicon.ico');
try {
  await fs.unlink(legacyIco);
  console.log('removed app/favicon.ico (legacy override)');
} catch (err) {
  if (err?.code !== 'ENOENT') throw err;
}

const svg = await fs.readFile(sourceSvg);

for (const { file, size } of outputs) {
  const outPath = path.join(root, file);
  await sharp(svg).resize(size, size).png().toFile(outPath);
  console.log(`wrote ${file} (${size}×${size})`);
}

const appIconSvg = path.join(root, 'app/icon.svg');
await fs.copyFile(sourceSvg, appIconSvg);
console.log('wrote app/icon.svg (copy of monogram)');
