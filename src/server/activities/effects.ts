import "server-only";
import { recomputeSeasonsForChange, type ScoringEffect } from "@/src/server/scoring";
import { recomputeUserBadges, type BadgeChange } from "@/src/server/badges";
import { emitActivityNotifications } from "@/src/server/notifications";

export type ActivitySnapshot = {
  id: string;
  userId: string;
  activityCategoryId: string;
  startedAt: Date;
  durationMinutes: number;
};
export type ActivityChange = { userId: string; before: ActivitySnapshot | null; after: ActivitySnapshot | null };
export type ActivityEffects = { scoring: ScoringEffect[]; badges: BadgeChange[] };

/**
 * Se llama DESPUÉS del commit de cada cambio de actividad (crear, editar, borrar).
 * Orden fijo: puntos (W1-1) → insignias (W1-2) → notificaciones (W2-3).
 */
export async function runActivityEffects(change: ActivityChange): Promise<ActivityEffects> {
  const scoring = await recomputeSeasonsForChange(change);
  const badges = await recomputeUserBadges(change.userId);
  const effects = { scoring, badges };
  try {
    await emitActivityNotifications(change, effects);
  } catch (e) {
    console.error("[notifications]", e); // las notificaciones nunca rompen el guardado
  }
  return effects;
}
