import 'server-only';

import sharp from 'sharp';
import { supabaseAdmin } from '@/lib/supabaseClient';
import {
  LANDING_CAPA_BUCKET,
  LANDING_CAPA_MAX_DIMENSION,
  LANDING_CAPA_STORED_MIME,
  LANDING_CAPA_WEBP_QUALITY,
  buildLandingCapaPath,
  getLandingCapaPublicUrl,
  landingCapaPathFromPublicUrl,
} from '@/lib/salonLandingCapa';

export async function compressLandingCapaForStorage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate()
    .resize(LANDING_CAPA_MAX_DIMENSION, LANDING_CAPA_MAX_DIMENSION, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: LANDING_CAPA_WEBP_QUALITY })
    .toBuffer();
}

export async function uploadLandingCapa(
  ownerEmail: string,
  buffer: Buffer,
): Promise<{ publicUrl: string; storagePath: string }> {
  const storagePath = buildLandingCapaPath(ownerEmail);
  const { error } = await supabaseAdmin.storage
    .from(LANDING_CAPA_BUCKET)
    .upload(storagePath, buffer, {
      contentType: LANDING_CAPA_STORED_MIME,
      upsert: false,
    });
  if (error) throw new Error(error.message || 'Erro ao enviar capa');
  return { storagePath, publicUrl: getLandingCapaPublicUrl(storagePath) };
}

export async function removeLandingCapaFromStorage(publicUrl: string): Promise<void> {
  const path = landingCapaPathFromPublicUrl(publicUrl);
  if (!path) return;
  await supabaseAdmin.storage.from(LANDING_CAPA_BUCKET).remove([path]);
}
