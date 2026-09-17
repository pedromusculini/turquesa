// Fase 1: Supabase Storage (bucket público catalogo-fotos).
// TODO fase 2: Google Drive — upload na pasta do owner (OAuth), URL pública para vitrine /c/[token].
// Ver docs/CATALOGO_FOTOS_ARMAZENAMENTO.md (opções A–D, migração Supabase→Drive, acesso anônimo).
//
// Compressão WebP no upload: ver lib/catalogoFotosStorage.ts (sharp; só servidor).

export const CATALOGO_FOTO_MAX_COUNT = 2;
/** Original da câmera (celular); o cliente comprime antes do POST. */
export const CATALOGO_FOTO_MAX_ORIGINAL_BYTES = 20 * 1024 * 1024;
/** Limite do arquivo que chega na API (já otimizado ou fallback). */
export const CATALOGO_FOTO_MAX_BYTES = 8 * 1024 * 1024;
export const CATALOGO_FOTO_BUCKET = 'catalogo-fotos';
export const CATALOGO_FOTO_MAX_DIMENSION = 1200;
export const CATALOGO_FOTO_WEBP_QUALITY = 82;
export const CATALOGO_FOTO_STORED_MIME = 'image/webp' as const;

export const CATALOGO_FOTO_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;

export type CatalogoFotoMime = (typeof CATALOGO_FOTO_MIME_TYPES)[number];

export function isAllowedCatalogoFotoType(mime: string, fileName = ''): boolean {
  const type = mime.toLowerCase().trim();
  const name = fileName.toLowerCase();
  if (type === 'image/jpg' || type === 'image/pjpeg') return true;
  if ((CATALOGO_FOTO_MIME_TYPES as readonly string[]).includes(type)) return true;
  return /\.(jpe?g|png|webp|heic|heif)$/.test(name);
}

export function looksLikeCatalogoImage(buffer: Buffer): boolean {
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

export function validateCatalogoFotoClient(file: File): string | null {
  if (!isAllowedCatalogoFotoType(file.type, file.name)) {
    return 'Use JPEG, PNG, WebP ou HEIC.';
  }
  if (file.size > CATALOGO_FOTO_MAX_ORIGINAL_BYTES) {
    return 'Essa foto está grande demais. Tente outra do álbum (até 20 MB).';
  }
  return null;
}

export function validateCatalogoFotoBuffer(
  buffer: Buffer,
  mime: string,
  fileName = '',
): string | null {
  const type = mime.toLowerCase().trim();
  const ok =
    isAllowedCatalogoFotoType(type, fileName) ||
    type === '' ||
    type === 'application/octet-stream';
  if (!ok) return 'Formato de imagem não permitido.';
  if (buffer.length > CATALOGO_FOTO_MAX_BYTES) {
    return 'Não foi possível receber esta foto. Tente novamente pelo celular (o app otimiza na hora).';
  }
  if (!looksLikeCatalogoImage(buffer)) return 'Arquivo de imagem inválido.';
  return null;
}

function ownerStoragePrefix(ownerEmail: string): string {
  return encodeURIComponent(ownerEmail.toLowerCase().trim());
}

export function buildCatalogoFotoPath(
  ownerEmail: string,
  servicoId: string,
): string {
  const uid = crypto.randomUUID();
  return `${ownerStoragePrefix(ownerEmail)}/${servicoId}/${uid}.webp`;
}

export function getCatalogoFotoPublicUrl(storagePath: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, '');
  return `${base}/storage/v1/object/public/${CATALOGO_FOTO_BUCKET}/${storagePath}`;
}

export function storagePathFromPublicUrl(publicUrl: string): string | null {
  const marker = `/object/public/${CATALOGO_FOTO_BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(publicUrl.slice(idx + marker.length));
}

export function normalizeFotoUrls(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
    .slice(0, CATALOGO_FOTO_MAX_COUNT);
}
