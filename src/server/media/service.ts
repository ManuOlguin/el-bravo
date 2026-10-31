import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "@/src/lib/db";
import { requireGroupAdmin, requireUser, AuthError, type SessionUser } from "@/src/server/auth/dal";
import { fail, ok, type ActionResult } from "@/src/server/http/result";
import {
  MAX_ACTIVITY_PHOTOS,
  MAX_BYTES,
  extForMime,
  isAllowedMime,
  isOwnKeyFor,
  keyFromPublicUrl,
  mediaKey,
  publicUrlFor,
  thumbKeyFor,
  type AllowedMime,
  type KeyTarget,
  type UploadTarget,
} from "./keys";
import { deleteObject, headObject, isStorageConfigured, presignPut, publicBaseUrl } from "./storage";

/**
 * Lógica de subida/confirmación/borrado de fotos (D8). Las Server Actions de `src/server/actions/media.ts`
 * validan el input y delegan acá. Los permisos se resuelven con el DAL (lanzan `AuthError`).
 */

export const NOT_CONFIGURED = "Las fotos todavía no están configuradas.";
const LIMIT_REACHED = `Ya cargaste ${MAX_ACTIVITY_PHOTOS} fotos en este entrenamiento.`;

export type UploadTicket = {
  uploadUrl: string;
  key: string;
  publicUrl: string;
  thumbUploadUrl: string;
  thumbKey: string;
  thumbPublicUrl: string;
};

async function assertActivityOwner(userId: string, activityId: string) {
  const a = await prisma.activity.findUnique({ where: { id: activityId }, select: { userId: true } });
  if (!a || a.userId !== userId) throw new AuthError("NOT_FOUND");
}

/** Verifica permisos sobre el destino y lo resuelve a la carpeta del bucket. */
async function authorizeTarget(target: UploadTarget): Promise<{ user: SessionUser; keyTarget: KeyTarget }> {
  switch (target.kind) {
    case "activity": {
      const user = await requireUser();
      await assertActivityOwner(user.id, target.activityId);
      return { user, keyTarget: target };
    }
    case "avatar": {
      const user = await requireUser();
      return { user, keyTarget: { kind: "avatar", userId: user.id } };
    }
    case "group": {
      const user = await requireGroupAdmin(target.groupId);
      return { user, keyTarget: target };
    }
  }
}

/** Borra objetos sin propagar errores: un objeto huérfano en el bucket no debe romper la operación. */
async function deleteKeysQuietly(keys: (string | null | undefined)[]) {
  const unique = [...new Set(keys.filter((k): k is string => !!k))];
  const results = await Promise.allSettled(unique.map((k) => deleteObject(k)));
  results.forEach((r, i) => {
    if (r.status === "rejected") console.error("[media] no se pudo borrar", unique[i], r.reason);
  });
}

/** Original + miniatura de una foto guardada (por `storageKey` o derivando la key de la URL pública). */
function objectKeysOf(m: { storageKey: string | null; url: string; thumbUrl: string | null }, base: string) {
  const key = m.storageKey ?? keyFromPublicUrl(m.url, base);
  return [key, key ? thumbKeyFor(key) : null, keyFromPublicUrl(m.thumbUrl, base)];
}

export async function createUpload(
  target: UploadTarget,
  file: { contentType: AllowedMime; size: number }
): Promise<ActionResult<UploadTicket>> {
  if (!isStorageConfigured()) return fail(NOT_CONFIGURED);
  const { keyTarget } = await authorizeTarget(target);
  if (keyTarget.kind === "activity") {
    const count = await prisma.activityMedia.count({ where: { activityId: keyTarget.activityId } });
    if (count >= MAX_ACTIVITY_PHOTOS) return fail(LIMIT_REACHED);
  }
  const key = mediaKey(keyTarget, extForMime(file.contentType), randomBytes(12).toString("base64url"));
  const thumbKey = thumbKeyFor(key);
  // La miniatura se genera en el mismo formato que el original (WebP, o JPEG si el navegador no codifica WebP).
  const [uploadUrl, thumbUploadUrl] = await Promise.all([
    presignPut(key, file.contentType),
    presignPut(thumbKey, file.contentType),
  ]);
  const base = publicBaseUrl();
  return ok({
    uploadUrl,
    key,
    publicUrl: publicUrlFor(key, base),
    thumbUploadUrl,
    thumbKey,
    thumbPublicUrl: publicUrlFor(thumbKey, base),
  });
}

export async function confirmUpload(
  target: UploadTarget,
  key: string,
  meta: { width: number; height: number }
): Promise<ActionResult<{ id?: string; url: string }>> {
  if (!isStorageConfigured()) return fail(NOT_CONFIGURED);
  const { user, keyTarget } = await authorizeTarget(target);
  if (!isOwnKeyFor(keyTarget, key)) return fail("La foto no corresponde a este destino.");

  const thumbKey = thumbKeyFor(key);
  const [obj, thumb] = await Promise.all([headObject(key), headObject(thumbKey)]);
  if (!obj) return fail("No encontramos la foto subida. Probá de nuevo.");
  if (obj.size > MAX_BYTES || obj.size <= 0 || !isAllowedMime(obj.contentType)) {
    await deleteKeysQuietly([key, thumbKey]);
    return fail(obj.size > MAX_BYTES ? "La foto pesa más de 5 MB." : "El archivo subido no es una imagen válida.");
  }
  const thumbOk = !!thumb && thumb.size > 0 && thumb.size <= MAX_BYTES && isAllowedMime(thumb.contentType);
  if (thumb && !thumbOk) await deleteKeysQuietly([thumbKey]);

  const base = publicBaseUrl();
  const url = publicUrlFor(key, base);
  const thumbUrl = thumbOk ? publicUrlFor(thumbKey, base) : null;

  if (keyTarget.kind === "activity") {
    const activityId = keyTarget.activityId;
    const result = await prisma.$transaction(async (tx) => {
      // Serializa confirmaciones concurrentes de la misma actividad (límite y posición).
      await tx.$queryRaw`SELECT id FROM Activity WHERE id = ${activityId} FOR UPDATE`;
      const existing = await tx.activityMedia.findFirst({ where: { activityId, storageKey: key }, select: { id: true } });
      if (existing) return { id: existing.id };
      const count = await tx.activityMedia.count({ where: { activityId } });
      if (count >= MAX_ACTIVITY_PHOTOS) return null;
      const m = await tx.activityMedia.create({
        data: {
          activityId,
          url,
          storageKey: key,
          thumbUrl,
          mimeType: obj.contentType,
          sizeBytes: obj.size,
          width: meta.width,
          height: meta.height,
          position: count,
          status: "ready",
        },
        select: { id: true },
      });
      return { id: m.id };
    });
    if (!result) {
      await deleteKeysQuietly([key, thumbKey]);
      return fail(LIMIT_REACHED);
    }
    return ok({ id: result.id, url }, "Foto guardada");
  }

  const previous =
    keyTarget.kind === "avatar"
      ? (await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { photoUrl: true } })).photoUrl
      : (await prisma.group.findUniqueOrThrow({ where: { id: keyTarget.groupId }, select: { photoUrl: true } })).photoUrl;
  if (keyTarget.kind === "avatar") await prisma.user.update({ where: { id: user.id }, data: { photoUrl: url } });
  else await prisma.group.update({ where: { id: keyTarget.groupId }, data: { photoUrl: url } });

  const oldKey = keyFromPublicUrl(previous, base);
  if (oldKey && oldKey !== key) await deleteKeysQuietly([oldKey, thumbKeyFor(oldKey)]);
  return ok({ url }, "Foto actualizada");
}

export async function deleteActivityMedia(mediaId: string): Promise<ActionResult<void>> {
  const user = await requireUser();
  const media = await prisma.activityMedia.findUnique({
    where: { id: mediaId },
    select: { id: true, activityId: true, storageKey: true, url: true, thumbUrl: true, activity: { select: { userId: true } } },
  });
  if (!media || media.activity.userId !== user.id) throw new AuthError("NOT_FOUND");

  await prisma.$transaction(async (tx) => {
    await tx.activityMedia.delete({ where: { id: media.id } });
    const rest = await tx.activityMedia.findMany({
      where: { activityId: media.activityId },
      orderBy: [{ position: "asc" }, { uploadedAt: "asc" }],
      select: { id: true, position: true },
    });
    for (const [i, m] of rest.entries()) {
      if (m.position !== i) await tx.activityMedia.update({ where: { id: m.id }, data: { position: i } });
    }
  });
  if (isStorageConfigured()) await deleteKeysQuietly(objectKeysOf(media, publicBaseUrl()));
  return ok(undefined, "Foto borrada");
}

export async function reorderActivityMedia(activityId: string, mediaIds: string[]): Promise<ActionResult<void>> {
  const user = await requireUser();
  await assertActivityOwner(user.id, activityId);
  const current = await prisma.activityMedia.findMany({ where: { activityId }, select: { id: true } });
  const ids = new Set(current.map((m) => m.id));
  if (mediaIds.length !== ids.size || !mediaIds.every((id) => ids.has(id))) {
    return fail("El orden no coincide con las fotos del entrenamiento.");
  }
  await prisma.$transaction(
    mediaIds.map((id, position) => prisma.activityMedia.update({ where: { id }, data: { position } }))
  );
  return ok(undefined);
}

/**
 * Borra del bucket todas las fotos de una actividad. Lo llama `deleteActivity` ANTES del `DELETE`
 * (el cascade borra las filas). Nunca lanza: un fallo del bucket no impide borrar la actividad.
 */
export async function deleteActivityObjects(activityId: string): Promise<void> {
  try {
    const media = await prisma.activityMedia.findMany({
      where: { activityId },
      select: { storageKey: true, url: true, thumbUrl: true },
    });
    if (media.length === 0 || !isStorageConfigured()) return;
    const base = publicBaseUrl();
    await deleteKeysQuietly(media.flatMap((m) => objectKeysOf(m, base)));
  } catch (e) {
    console.error("[media] deleteActivityObjects", activityId, e);
  }
}
