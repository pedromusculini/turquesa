import {
  CATALOGO_FOTO_BUCKET,
  CATALOGO_FOTO_STORED_MIME,
} from '@/lib/catalogoFotos';

export const LANDING_CAPA_BUCKET = CATALOGO_FOTO_BUCKET;
export const LANDING_CAPA_MAX_BYTES = 8 * 1024 * 1024;
export const LANDING_CAPA_MAX_DIMENSION = 1600;
export const LANDING_CAPA_WEBP_QUALITY = 76;
export const LANDING_CAPA_STORED_MIME = CATALOGO_FOTO_STORED_MIME;

export const LANDING_CAPA_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;

export type LandingCapaMime = (typeof LANDING_CAPA_MIME_TYPES)[number];

export function validateLandingCapaClient(file: File): string | null {
  const mime = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  const known =
    (LANDING_CAPA_MIME_TYPES as readonly string[]).includes(mime) ||
    /\.(jpe?g|png|webp|heic|heif)$/.test(name);
  if (!known) return 'Use JPEG, PNG, WebP ou HEIC.';
  if (file.size > LANDING_CAPA_MAX_BYTES) return 'A capa pode ter no máximo 8 MB.';
  return null;
}

export function looksLikeLandingImage(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  const head = buffer.subarray(0, 16);
  const ascii = head.toString('latin1');
  if (/^\s*<(!doctype|html|svg|xml|\?xml)/i.test(ascii)) return false;
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return true;
  if (head[0] === 0x89 && ascii.startsWith('\x89PNG\r\n\x1a\n')) return true;
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') return true;
  const box = buffer.subarray(4, 12).toString('latin1');
  if (box.startsWith('ftyp')) return true;
  return false;
}

export function validateLandingCapaBuffer(buffer: Buffer, mime: string): string | null {
  const type = mime.toLowerCase();
  const ok =
    (LANDING_CAPA_MIME_TYPES as readonly string[]).includes(type) || type === '' || type === 'application/octet-stream';
  if (!ok) return 'Formato de imagem não permitido.';
  if (buffer.length > LANDING_CAPA_MAX_BYTES) return 'A capa pode ter no máximo 8 MB.';
  if (!looksLikeLandingImage(buffer)) return 'Arquivo de imagem inválido.';
  return null;
}

function ownerStoragePrefix(ownerEmail: string): string {
  return encodeURIComponent(ownerEmail.toLowerCase().trim());
}

export function buildLandingCapaPath(ownerEmail: string): string {
  return `${ownerStoragePrefix(ownerEmail)}/landing/capa-${crypto.randomUUID()}.webp`;
}

export function getLandingCapaPublicUrl(storagePath: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, '');
  return `${base}/storage/v1/object/public/${LANDING_CAPA_BUCKET}/${storagePath}`;
}

export function landingCapaPathFromPublicUrl(publicUrl: string): string | null {
  const marker = `/object/public/${LANDING_CAPA_BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  const path = decodeURIComponent(publicUrl.slice(idx + marker.length));
  if (!path.includes('/landing/')) return null;
  return path;
}
