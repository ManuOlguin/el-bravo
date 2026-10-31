/* eslint-disable @typescript-eslint/no-unused-vars -- stub: los parámetros se usan en la implementación real */
// STUB (W0-C). W2-3 lo reemplaza por las implementaciones reales MANTENIENDO estos exports (§5.10).
import type { NotificationType } from "@prisma/client";
import type { ActivityChange, ActivityEffects } from "@/src/server/activities/effects";

export async function emitActivityNotifications(_change: ActivityChange, _effects: ActivityEffects): Promise<void> {}

export async function notify(_input: {
  recipientIds: string[];
  type: NotificationType;
  actorId?: string;
  groupId?: string;
  seasonId?: string;
  activityId?: string;
  data?: Record<string, unknown>;
  dedupeKey: (recipientId: string) => string;
}): Promise<void> {}
