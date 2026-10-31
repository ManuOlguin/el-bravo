/**
 * Preferencias de notificación por tipo y canal. Las filas de `NotificationPreference` existen solo
 * si el usuario cambió algo: lo que falta toma los defaults de acá (D9).
 */
import type { NotificationType } from "@prisma/client";
import { prisma } from "@/src/lib/db";

export type Channel = "inApp" | "email" | "push";
export type ChannelPrefs = Record<Channel, boolean>;

/** Tipos que el usuario puede configurar, en el orden de la pantalla de ajustes. */
export const CONFIGURABLE_TYPES = [
  "first_workout_of_week",
  "weekly_goal_met",
  "streak_milestone",
  "rank_overtaken",
  "badge_level_up",
  "season_started",
  "season_results_published",
  "new_follower",
  "member_joined",
  "friend_workout",
  "reaction_received",
] as const satisfies readonly NotificationType[];
export type ConfigurableType = (typeof CONFIGURABLE_TYPES)[number];

export const TYPE_LABELS: Record<ConfigurableType, { label: string; description: string }> = {
  first_workout_of_week: { label: "Arranque de semana", description: "Alguien de tu grupo fue el primero en entrenar" },
  weekly_goal_met: { label: "Objetivo semanal", description: "Alguien de tu grupo cumplió su semana" },
  streak_milestone: { label: "Rachas", description: "Alguien llegó a 3, 5 o 10 semanas seguidas" },
  rank_overtaken: { label: "Te pasaron en el ranking", description: "Alguien te superó en una temporada" },
  badge_level_up: { label: "Insignias", description: "Vos o alguien que seguís subió de nivel" },
  season_started: { label: "Temporada nueva", description: "Arrancó una temporada en tu grupo" },
  season_results_published: { label: "Resultados", description: "Se publicaron los resultados de una temporada" },
  new_follower: { label: "Seguidores", description: "Alguien empezó a seguirte" },
  member_joined: { label: "Grupos", description: "Alguien se unió a tu grupo o te invitó a uno" },
  friend_workout: { label: "Amigos que entrenan", description: "Un amigo fuera de tus grupos registró un entrenamiento" },
  reaction_received: { label: "Reacciones", description: "Alguien reaccionó a tu entrenamiento" },
};

/** Email instantáneo activado por defecto solo para estos tipos (D9, ajustable). */
const EMAIL_ON_BY_DEFAULT = new Set<NotificationType>(["season_results_published", "new_follower"]);

export function defaultPrefs(type: NotificationType): ChannelPrefs {
  // weekly_digest: el canal "email" es el interruptor del resumen semanal (activo por defecto).
  if (type === "weekly_digest") return { inApp: false, email: true, push: false };
  return { inApp: true, email: EMAIL_ON_BY_DEFAULT.has(type), push: true };
}

/** Preferencias efectivas de varios usuarios para varios tipos (una query). */
export async function loadPrefs(
  userIds: string[],
  types: NotificationType[]
): Promise<(userId: string, type: NotificationType) => ChannelPrefs> {
  const rows =
    userIds.length && types.length
      ? await prisma.notificationPreference.findMany({ where: { userId: { in: userIds }, type: { in: types } } })
      : [];
  const map = new Map(rows.map((r) => [`${r.userId}:${r.type}`, { inApp: r.inApp, email: r.email, push: r.push }]));
  return (userId, type) => map.get(`${userId}:${type}`) ?? defaultPrefs(type);
}
