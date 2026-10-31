// Compresión en el navegador (D8): WebP de hasta 1600 px + miniatura de 400 px (D12: feeds, widget, push).
import { MAX_BYTES } from "@/src/server/media/keys";

export const MAIN_MAX_SIDE = 1600;
export const MAIN_QUALITY = 0.82;
export const THUMB_MAX_SIDE = 400;
export const THUMB_QUALITY = 0.7;

export type CompressedImage = {
  blob: Blob;
  width: number;
  height: number;
  contentType: "image/webp" | "image/jpeg";
};

/** Tamaño que entra en un cuadrado de `max` px sin deformar ni agrandar. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

type Source = { image: CanvasImageSource; width: number; height: number; close(): void };

async function decode(file: Blob): Promise<Source> {
  if (typeof createImageBitmap === "function") {
    try {
      // `from-image` respeta la orientación EXIF (fotos verticales del celular).
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { image: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      // Algunos formatos (p. ej. HEIC en Safari) solo los decodifica <img>.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { image: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new Error("No pudimos leer la imagen. Probá con una foto JPG o PNG.");
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function render(
  src: Source,
  maxSide: number,
  quality: number,
  prefer: CompressedImage["contentType"]
): Promise<CompressedImage> {
  const { width, height } = fitWithin(src.width, src.height, maxSide);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Tu navegador no permite procesar imágenes.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src.image, 0, 0, width, height);
  let blob = await toBlob(canvas, prefer, quality);
  // Safari no codifica WebP: devuelve PNG. En ese caso usamos JPEG.
  if (!blob || blob.type !== prefer) {
    blob = await toBlob(canvas, "image/jpeg", quality);
    if (!blob) throw new Error("No pudimos comprimir la imagen.");
    return { blob, width, height, contentType: "image/jpeg" };
  }
  return { blob, width, height, contentType: prefer };
}

/** Original (1600 px, q 0,82) y miniatura (400 px, q 0,7), ambas en el mismo formato. */
export async function compressImage(file: Blob): Promise<{ main: CompressedImage; thumb: CompressedImage }> {
  const src = await decode(file);
  try {
    let main = await render(src, MAIN_MAX_SIDE, MAIN_QUALITY, "image/webp");
    if (main.blob.size > MAX_BYTES) main = await render(src, MAIN_MAX_SIDE, 0.6, main.contentType);
    if (main.blob.size > MAX_BYTES) throw new Error("La foto es demasiado pesada, incluso comprimida.");
    const thumb = await render(src, THUMB_MAX_SIDE, THUMB_QUALITY, main.contentType);
    return { main, thumb };
  } finally {
    src.close();
  }
}
