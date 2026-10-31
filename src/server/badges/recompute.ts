// Sin "server-only": scripts/migrate-v2-data.ts lo importa desde tsx (fuera de Next).
import { prisma } from "@/src/lib/db";
import { computeMetric, isMetricKey, type MetricActivity, type MetricParams } from "./metrics";
import { evaluateBadge, type BadgeDef } from "./evaluate";
import type { BadgeChange } from "./types";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** Agrupa los músculos de un ejercicio por `groupKey`, sumando porcentajes (p. ej. cuádriceps + glúteos → legs). */
function muscleGroupsOf(muscles: { percentage: number; muscle: { groupKey: string } }[]) {
  const byGroup = new Map<string, number>();
  for (const m of muscles) byGroup.set(m.muscle.groupKey, (byGroup.get(m.muscle.groupKey) ?? 0) + m.percentage);
  return [...byGroup.entries()].map(([groupKey, percentage]) => ({ groupKey, percentage }));
}

async function loadMetricActivities(tx: Tx, userId: string): Promise<MetricActivity[]> {
  const rows = await tx.activity.findMany({
    where: { userId },
    select: {
      id: true,
      startedAt: true,
      durationMinutes: true,
      activityCategory: { select: { slug: true } },
      exercises: {
        select: {
          sets: { select: { completed: true } },
          exercise: { select: { muscles: { select: { percentage: true, muscle: { select: { groupKey: true } } } } } },
        },
      },
    },
  });
  return rows.map((a) => ({
    id: a.id,
    startedAt: a.startedAt,
    durationMinutes: a.durationMinutes,
    categorySlug: a.activityCategory.slug,
    sets: a.exercises.flatMap((ae) => {
      const muscleGroups = muscleGroupsOf(ae.exercise.muscles);
      return ae.sets.map((s) => ({ completed: s.completed, muscleGroups }));
    }),
  }));
}

async function loadBadgeDefs(tx: Tx) {
  const badges = await tx.badge.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: { levels: { select: { level: true, threshold: true } } },
  });
  const defs: (BadgeDef & { iconKey: string | null })[] = [];
  for (const b of badges) {
    if (!isMetricKey(b.metric)) {
      console.warn(`[badges] métrica desconocida "${b.metric}" en ${b.code}; se ignora`);
      continue;
    }
    defs.push({
      id: b.id,
      code: b.code,
      name: b.name,
      iconKey: b.iconKey,
      metric: b.metric,
      params: (b.params ?? {}) as MetricParams,
      levels: b.levels,
    });
  }
  return defs;
}

/**
 * Recalcula todas las insignias del usuario desde sus actividades (de por vida), las guarda en `UserBadge`
 * y devuelve solo las que cambiaron de nivel o de progreso. Determinista e idempotente.
 */
export async function recomputeUserBadges(userId: string): Promise<BadgeChange[]> {
  return prisma.$transaction(
    async (tx) => {
      // Lock por usuario: dos recálculos concurrentes se serializan y el diff queda consistente.
      const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM User WHERE id = ${userId} FOR UPDATE`;
      if (locked.length === 0) return [];
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { timezone: true, weeklyGoal: true } });

      const [activities, defs, existing] = await Promise.all([
        loadMetricActivities(tx, userId),
        loadBadgeDefs(tx),
        tx.userBadge.findMany({ where: { userId } }),
      ]);
      const prev = new Map(existing.map((ub) => [ub.badgeId, ub]));
      const now = new Date();
      const ctx = { activities, timezone: user.timezone, weeklyGoal: user.weeklyGoal, now };

      const changes: BadgeChange[] = [];
      for (const def of defs) {
        const state = evaluateBadge(def, computeMetric(def.metric, def.params, ctx));
        const before = prev.get(def.id);
        const levelBefore = before?.level ?? 0;
        const progressBefore = before?.progress ?? 0;
        const levelChanged = state.level !== levelBefore;
        const achievedAt = levelChanged ? (state.level > 0 ? now : null) : (before?.achievedAt ?? null);

        if (!before || levelChanged || state.progress !== progressBefore) {
          await tx.userBadge.upsert({
            where: { userId_badgeId: { userId, badgeId: def.id } },
            update: { level: state.level, progress: state.progress, achievedAt },
            create: { userId, badgeId: def.id, level: state.level, progress: state.progress, achievedAt },
          });
        }
        if (levelChanged || state.progress !== progressBefore) {
          changes.push({
            code: def.code,
            name: def.name,
            iconKey: def.iconKey,
            levelBefore,
            levelAfter: state.level,
            progressBefore,
            progressAfter: state.progress,
            nextThreshold: state.nextThreshold,
          });
        }
      }
      return changes;
    },
    { timeout: 15000 }
  );
}
