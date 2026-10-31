"use server";
import { parseInput, runAction, type ActionResult } from "@/src/server/http/result";
import type { UploadTarget } from "@/src/server/media/keys";
import {
  confirmUpload,
  createUpload,
  deleteActivityMedia,
  reorderActivityMedia,
  type UploadTicket,
} from "@/src/server/media/service";
import { confirmUploadSchema, createUploadSchema, reorderSchema } from "@/src/server/media/validation";
import { z } from "zod";

/**
 * Fotos (D8): el cliente pide URLs prefirmadas, sube directo al bucket y confirma.
 * Solo la confirmación escribe en la DB.
 */

export async function createUploadAction(
  target: UploadTarget,
  file: { contentType: string; size: number }
): Promise<ActionResult<UploadTicket>> {
  return runAction(async () => {
    const p = parseInput(createUploadSchema, { target, file });
    if (!p.ok) return p.result;
    return createUpload(p.data.target, p.data.file);
  });
}

export async function confirmUploadAction(
  target: UploadTarget,
  key: string,
  meta: { width: number; height: number }
): Promise<ActionResult<{ id?: string; url: string }>> {
  return runAction(async () => {
    const p = parseInput(confirmUploadSchema, { target, key, meta });
    if (!p.ok) return p.result;
    return confirmUpload(p.data.target, p.data.key, p.data.meta);
  });
}

export async function deleteActivityMediaAction(mediaId: string): Promise<ActionResult<void>> {
  return runAction(async () => {
    const p = parseInput(z.string().min(1).max(64), mediaId);
    if (!p.ok) return p.result;
    return deleteActivityMedia(p.data);
  });
}

export async function reorderActivityMediaAction(activityId: string, mediaIds: string[]): Promise<ActionResult<void>> {
  return runAction(async () => {
    const p = parseInput(reorderSchema, { activityId, mediaIds });
    if (!p.ok) return p.result;
    return reorderActivityMedia(p.data.activityId, p.data.mediaIds);
  });
}
