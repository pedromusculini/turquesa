// Servidor: compressão WebP (sharp) + upload Supabase.
// Entrada típica ~600–1800 KB (JPEG/PNG até 2 MB); saída ~150–400 KB (média ~220–280 KB).

import 'server-only';

import sharp from 'sharp';
import { supabaseAdmin } from '@/lib/supabaseClient';
import {
  CATALOGO_FOTO_BUCKET,
  CATALOGO_FOTO_MAX_DIMENSION,
  CATALOGO_FOTO_STORED_MIME,
  CATALOGO_FOTO_WEBP_QUALITY,
  buildCatalogoFotoPath,
  getCatalogoFotoPublicUrl,
  storagePathFromPublicUrl,
} from '@/lib/catalogoFotos';

export async function compressCatalogoFotoForStorage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate()
    .resize(CATALOGO_FOTO_MAX_DIMENSION, CATALOGO_FOTO_MAX_DIMENSION, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: CATALOGO_FOTO_WEBP_QUALITY })
    .toBuffer();
}

export async function uploadCatalogoFoto(
  ownerEmail: string,
  servicoId: string,
  buffer: Buffer,
): Promise<{ publicUrl: string; storagePath: string }> {
  const storagePath = buildCatalogoFotoPath(ownerEmail, servicoId);
  const { error } = await supabaseAdmin.storage
    .from(CATALOGO_FOTO_BUCKET)
    .upload(storagePath, buffer, {
      contentType: CATALOGO_FOTO_STORED_MIME,
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
