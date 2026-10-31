import type { PrismaClient } from "@prisma/client";
import type { MetricKey, MetricParams } from "../../src/server/badges/metrics";

type SeedBadge = {
  code: string;
  name: string;
  description: string;
  metric: MetricKey;
  params: MetricParams;
  iconKey: string;
  /** Umbrales de cada nivel (nivel = índice + 1). */
  levels: number[];
};

/** Familias de insignias (roadmap D2). El orden del array define `sortOrder`. */
export const BADGES: readonly SeedBadge[] = [
  { code: "EL_PERSISTENTE", name: "El Persistente", description: "Entrenamientos registrados en total.", metric: "total_workouts", params: {}, iconKey: "flame", levels: [10, 50, 150, 300] },
  { code: "GYM_RAT", name: "Gym Rat", description: "Entrenamientos de fuerza, calistenia, crossfit o funcional.", metric: "category_workouts", params: { categories: ["strength", "calisthenics", "crossfit", "hiit_functional"] }, iconKey: "dumbbell", levels: [10, 50, 150] },
  { code: "CORRE_FORREST", name: "Corre Forrest", description: "Salidas a correr (running o trail).", metric: "category_workouts", params: { categories: ["running", "trail_running"] }, iconKey: "run", levels: [5, 25, 75] },
  { code: "IMPARABLE", name: "Imparable", description: "Tu mejor racha de semanas cumpliendo tu objetivo.", metric: "best_goal_streak", params: {}, iconKey: "bolt", levels: [4, 8, 16] },
  { code: "EL_PIERNAS", name: "El Piernas", description: "Series de ejercicios de piernas.", metric: "muscle_sets", params: { groupKey: "legs", minPercentage: 30 }, iconKey: "leg", levels: [50, 250, 1000] },
  { code: "SIX_PACK", name: "Six Pack", description: "Series de ejercicios de core.", metric: "muscle_sets", params: { groupKey: "core", minPercentage: 30 }, iconKey: "abs", levels: [50, 250, 1000] },
  { code: "TODOTERRENO", name: "Todoterreno", description: "Tipos de actividad distintos que probaste.", metric: "distinct_categories", params: {}, iconKey: "compass", levels: [3, 5, 8] },
  { code: "MARATONISTA", name: "Maratonista", description: "Minutos totales entrenados.", metric: "total_minutes", params: {}, iconKey: "clock", levels: [600, 3000, 10000] },
  { code: "MADRUGADOR", name: "Madrugador", description: "Entrenamientos antes de las 8 de la mañana.", metric: "early_workouts", params: { beforeHour: 8 }, iconKey: "sunrise", levels: [5, 25, 75] },
];

/**
 * Upsert idempotente por `code`. Los niveles se reemplazan en cada corrida (se borran los que sobran)
 * y las insignias que ya no están en `BADGES` quedan inactivas (no se borran: tienen `UserBadge`).
 * `db` es opcional para poder sembrar desde los tests de integración con el cliente de la app.
 */
export async function seedBadges(db?: PrismaClient): Promise<number> {
  const client = db ?? (await import("./db")).prisma;
  for (const [i, b] of BADGES.entries()) {
    const data = {
      name: b.name,
      description: b.description,
      metric: b.metric,
      params: b.params,
      iconKey: b.iconKey,
      sortOrder: i + 1,
      isActive: true,
    };
    const badge = await client.badge.upsert({ where: { code: b.code }, update: data, create: { code: b.code, ...data } });
    for (const [j, threshold] of b.levels.entries()) {
      const level = j + 1;
      await client.badgeLevel.upsert({
        where: { badgeId_level: { badgeId: badge.id, level } },
        update: { threshold },
        create: { badgeId: badge.id, level, threshold },
      });
    }
    await client.badgeLevel.deleteMany({ where: { badgeId: badge.id, level: { gt: b.levels.length } } });
  }
  await client.badge.updateMany({ where: { code: { notIn: BADGES.map((b) => b.code) } }, data: { isActive: false } });
  return BADGES.length;
}
