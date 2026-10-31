/**
 * Escritura de notificaciones (contrato §5.10). Idempotente por `dedupeKey` (unique):
 * reintentos, doble click o reglas que se disparan dos veces no duplican.
 */
import { createHash } from "node:crypto";
import { Prisma, type NotificationType } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { loadPrefs } from "./preferences";

export type NotifyInput = {
  recipientIds: string[];
  type: NotificationType;
  actorId?: string;
  groupId?: string;
  seasonId?: string;
  activityId?: string;
  data?: Record<string, unknown>;
  dedupeKey: (recipientId: string) => string;
};

const MAX_KEY = 191; // VARCHAR(191) de Notification.dedupeKey

/** Las claves largas se acortan con un hash estable (mismo input → misma clave). */
export function normalizeDedupeKey(key: string): string {
  return key.length <= MAX_KEY ? key : `h:${createHash("sha256").update(key).digest("hex")}`;
}

/**
 * Crea una notificación por destinatario respetando `NotificationPreference.inApp`
 * (si está apagado, no se crea). Devuelve las claves que se intentaron escribir.
 */
export async function notify(input: NotifyInput): Promise<string[]> {
  const recipients = [...new Set(input.recipientIds)].filter(Boolean);
  if (!recipients.length) return [];
  const prefs = await loadPrefs(recipients, [input.type]);
  const allowed = recipients.filter((r) => prefs(r, input.type).inApp);
  if (!allowed.length) return [];

  const rows = allowed.map((recipientId) => ({
    recipientId,
    type: input.type,
    actorId: input.actorId ?? null,
    groupId: input.groupId ?? null,
    seasonId: input.seasonId ?? null,
    activityId: input.activityId ?? null,
    data: input.data ? (input.data as Prisma.InputJsonValue) : Prisma.DbNull,
    dedupeKey: normalizeDedupeKey(input.dedupeKey(recipientId)),
  }));
  await prisma.notification.createMany({ data: rows, skipDuplicates: true });
  return rows.map((r) => r.dedupeKey);
}
