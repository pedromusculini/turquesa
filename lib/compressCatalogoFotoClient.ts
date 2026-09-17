import {
  CATALOGO_FOTO_MAX_DIMENSION,
  CATALOGO_FOTO_WEBP_QUALITY,
} from '@/lib/catalogoFotos';

const TARGET_BYTES = Math.round(1.4 * 1024 * 1024);

function fitInside(width: number, height: number, max: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const scale = max / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function decodeBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return await createImageBitmap(file);
  }
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

/**
 * Reduz foto de celular (3–12 MB) para WebP/JPEG leve antes do POST.
 * Sem isso o aviso de 2 MB aparece no aparelho e a compressão do servidor nunca roda.
 */
export async function compressCatalogoFotoClient(file: File): Promise<File> {
  const bitmap = await decodeBitmap(file);
  try {
    const size = fitInside(bitmap.width, bitmap.height, CATALOGO_FOTO_MAX_DIMENSION);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas');
    ctx.drawImage(bitmap, 0, 0, size.width, size.height);

    const qualities = [CATALOGO_FOTO_WEBP_QUALITY / 100, 0.72, 0.6, 0.48];
    const types = ['image/webp', 'image/jpeg'] as const;

    let best: Blob | null = null;
    for (const type of types) {
      for (const quality of qualities) {
        const blob = await canvasToBlob(canvas, type, quality);
        if (!blob || blob.size === 0) continue;
        if (!best || blob.size < best.size) best = blob;
        if (blob.size <= TARGET_BYTES) {
          const ext = type === 'image/webp' ? 'webp' : 'jpg';
          return new File([blob], `catalogo.${ext}`, { type, lastModified: Date.now() });
        }
      }
    }

    if (best) {
      const ext = best.type === 'image/webp' ? 'webp' : 'jpg';
      return new File([best], `catalogo.${ext}`, { type: best.type, lastModified: Date.now() });
    }
    throw new Error('compress');
  } finally {
    bitmap.close();
  }
}
