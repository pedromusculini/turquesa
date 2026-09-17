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

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('decode'));
    img.src = src;
  });
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('read'));
    reader.readAsDataURL(file);
  });
}

async function decodeViaImageElement(file: File): Promise<{ img: HTMLImageElement; revoke: () => void }> {
  const objectUrl = URL.createObjectURL(file);
  const revoke = () => URL.revokeObjectURL(objectUrl);
  try {
    const img = await loadHtmlImage(objectUrl);
    if ('decode' in img) {
      try {
        await img.decode();
      } catch {
        /* onload já basta */
      }
    }
    if (!img.naturalWidth) throw new Error('decode');
    return { img, revoke };
  } catch {
    revoke();
    const dataUrl = await fileToDataUrl(file);
    const img = await loadHtmlImage(dataUrl);
    if (!img.naturalWidth) throw new Error('decode');
    return { img, revoke: () => undefined };
  }
}

async function drawFileToCanvas(file: File): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');

  try {
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      bitmap = await createImageBitmap(file);
    }
    const size = fitInside(bitmap.width, bitmap.height, CATALOGO_FOTO_MAX_DIMENSION);
    canvas.width = size.width;
    canvas.height = size.height;
    ctx.drawImage(bitmap, 0, 0, size.width, size.height);
    bitmap.close();
    return canvas;
  } catch {
    const { img, revoke } = await decodeViaImageElement(file);
    try {
      const size = fitInside(img.naturalWidth, img.naturalHeight, CATALOGO_FOTO_MAX_DIMENSION);
      canvas.width = size.width;
      canvas.height = size.height;
      ctx.drawImage(img, 0, 0, size.width, size.height);
      return canvas;
    } finally {
      revoke();
    }
  }
}

/**
 * Reduz foto de celular e converte HEIC da galeria iPhone para JPEG/WebP
 * antes do POST (sharp no servidor não decodifica HEIC).
 */
export async function compressCatalogoFotoClient(file: File): Promise<File> {
  const canvas = await drawFileToCanvas(file);

  const qualities = [CATALOGO_FOTO_WEBP_QUALITY / 100, 0.72, 0.6, 0.48];
  // JPEG primeiro: galeria iPhone manda HEIC; JPEG o servidor sempre abre.
  const types = ['image/jpeg', 'image/webp'] as const;

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
    return new File([best], `catalogo.${ext}`, {
      type: best.type || 'image/jpeg',
      lastModified: Date.now(),
    });
  }
  throw new Error('compress');
}
