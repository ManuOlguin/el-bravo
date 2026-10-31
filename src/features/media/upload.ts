"use client";
import { confirmUploadAction, createUploadAction } from "@/src/server/actions/media";
import type { ActionResult } from "@/src/server/http/result";
import type { UploadTarget } from "@/src/server/media/keys";
import { compressImage } from "./compress";
import { mapWithConcurrency } from "./pool";

export type UploadedMedia = { id?: string; url: string };

const NETWORK_ERROR = "No pudimos subir la foto. Revisá tu conexión y probá de nuevo.";

async function put(url: string, blob: Blob, contentType: string) {
  const res = await fetch(url, { method: "PUT", body: blob, headers: { "content-type": contentType } });
  if (!res.ok) throw new Error(`PUT ${res.status}`);
}

/** Comprime → pide URLs prefirmadas → `PUT` directo al bucket → confirma. Nunca lanza. */
export async function uploadFile(target: UploadTarget, file: Blob): Promise<ActionResult<UploadedMedia>> {
  let compressed: Awaited<ReturnType<typeof compressImage>>;
  try {
    compressed = await compressImage(file);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No pudimos leer la imagen." };
  }
  const { main, thumb } = compressed;
  try {
    const ticket = await createUploadAction(target, { contentType: main.contentType, size: main.blob.size, thumbSize: thumb.blob.size });
    if (!ticket.ok) return ticket;
    const [mainPut] = await Promise.allSettled([
      put(ticket.data.uploadUrl, main.blob, main.contentType),
      // La miniatura es opcional: si falla, la confirmación guarda thumbUrl = null y la UI usa la original.
      put(ticket.data.thumbUploadUrl, thumb.blob, thumb.contentType),
    ]);
    if (mainPut.status === "rejected") return { ok: false, error: NETWORK_ERROR };
    return await confirmUploadAction(target, ticket.data.key, { width: main.width, height: main.height });
  } catch {
    return { ok: false, error: NETWORK_ERROR };
  }
}

/**
 * Sube las fotos elegidas en el formulario una vez creada la actividad (de a 2 en paralelo).
 * Nunca lanza: el entrenamiento ya está guardado y la UI ofrece "Reintentar fotos" con `failed`.
 */
export async function uploadPendingPhotos(
  activityId: string,
  files: File[]
): Promise<{ uploaded: UploadedMedia[]; failed: File[] }> {
  const target: UploadTarget = { kind: "activity", activityId };
  const results = await mapWithConcurrency(files, 2, (f) => uploadFile(target, f));
  const uploaded: UploadedMedia[] = [];
  const failed: File[] = [];
  results.forEach((r, i) => (r.ok ? uploaded.push(r.data) : failed.push(files[i])));
  return { uploaded, failed };
}
