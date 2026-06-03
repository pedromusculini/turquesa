// Fase 1: Supabase Storage (bucket público catalogo-fotos).
// TODO fase 2: Google Drive — upload na pasta do owner (OAuth), URL pública para vitrine /f/[token].
// Ver docs/CATALOGO_FOTOS_ARMAZENAMENTO.md (opções A–D, migração Supabase→Drive, acesso anônimo).

import { supabaseAdmin } from '@/lib/supabaseClient';

export const CATALOGO_FOTO_MAX_COUNT = 2;
export const CATALOGO_FOTO_MAX_BYTES = 2 * 1024 * 1024;
export const CATALOGO_FOTO_BUCKET = 'catalogo-fotos';

export const CATALOGO_FOTO_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type CatalogoFotoMime = (typeof CATALOGO_FOTO_MIME_TYPES)[number];

const EXT_BY_MIME: Record<CatalogoFotoMime, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export function validateCatalogoFotoClient(
  file: File,
): string | null {
  if (!CATALOGO_FOTO_MIME_TYPES.includes(file.type as CatalogoFotoMime)) {
    return 'Use JPEG, PNG ou WebP.';
  }
  if (file.size > CATALOGO_FOTO_MAX_BYTES) {
    return 'Cada foto pode ter no máximo 2 MB.';
  }
  return null;
}

export function validateCatalogoFotoBuffer(
  buffer: Buffer,
  mime: string,
): string | null {
  if (!CATALOGO_FOTO_MIME_TYPES.includes(mime as CatalogoFotoMime)) {
    return 'Formato de imagem não permitido.';
  }
  if (buffer.length > CATALOGO_FOTO_MAX_BYTES) {
    return 'Cada foto pode ter no máximo 2 MB.';
  }
  return null;
}

function ownerStoragePrefix(ownerEmail: string): string {
  return encodeURIComponent(ownerEmail.toLowerCase().trim());
}

export function buildCatalogoFotoPath(
  ownerEmail: string,
  servicoId: string,
  mime: CatalogoFotoMime,
): string {
  const ext = EXT_BY_MIME[mime];
  const uid = crypto.randomUUID();
  return `${ownerStoragePrefix(ownerEmail)}/${servicoId}/${uid}.${ext}`;
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

export async function uploadCatalogoFoto(
  ownerEmail: string,
  servicoId: string,
  buffer: Buffer,
  mime: CatalogoFotoMime,
): Promise<{ publicUrl: string; storagePath: string }> {
  const storagePath = buildCatalogoFotoPath(ownerEmail, servicoId, mime);
  const { error } = await supabaseAdmin.storage
    .from(CATALOGO_FOTO_BUCKET)
    .upload(storagePath, buffer, {
      contentType: mime,
      upsert: false,
    });

  if (error) {
    throw new Error(error.message || 'Erro ao enviar foto');
  }

  return {
    storagePath,
    publicUrl: getCatalogoFotoPublicUrl(storagePath),
  };
}

export async function removeCatalogoFotoFromStorage(publicUrl: string): Promise<void> {
  const path = storagePathFromPublicUrl(publicUrl);
  if (!path) return;
  await supabaseAdmin.storage.from(CATALOGO_FOTO_BUCKET).remove([path]);
}

export function normalizeFotoUrls(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
    .slice(0, CATALOGO_FOTO_MAX_COUNT);
}
