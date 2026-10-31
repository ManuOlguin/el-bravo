import "server-only";
import { prisma } from "@/src/lib/db";
import type { ScoringEffect } from "@/src/server/scoring";
import { exerciseSummarySelect, toExerciseSummary } from "@/src/server/routines/service";
import type { ExerciseSummary } from "@/src/features/exercises/types";
import type { CategoryOption, PreviousSet } from "../types";

export type { CategoryOption, PreviousSet };

/** Lecturas de entrenamientos (W2-1). Las escrituras pasan siempre por `src/server/activities/service.ts`. */

/** Categorías activas; las que más usó el usuario primero, después el orden del catálogo. */
export async function listActivityCategoriesForUser(userId: string): Promise<CategoryOption[]> {
  const [cats, usage] = await Promise.all([
    prisma.activityCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, slug: true, name: true, usesExercises: true },
    }),
    prisma.activity.groupBy({ by: ["activityCategoryId"], where: { userId }, _count: { _all: true } }),
  ]);
  const uses = new Map(usage.map((u) => [u.activityCategoryId, u._count._all]));
  return cats
    .map((c, i) => ({ c, i, n: uses.get(c.id) ?? 0 }))
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .map(({ c }) => c);
}

/** Series de la última vez que el usuario hizo cada ejercicio (columna "Anterior"). */
export async function getLastPerformance(
  userId: string,
  exerciseIds: string[],
  excludeActivityId?: string | null
): Promise<Record<string, PreviousSet[]>> {
  const ids = [...new Set(exerciseIds)].slice(0, 40);
  const rows = await Promise.all(
    ids.map((exerciseId) =>
      prisma.activityExercise.findFirst({
        where: { exerciseId, activity: { userId, ...(excludeActivityId ? { id: { not: excludeActivityId } } : {}) } },
        orderBy: [{ activity: { startedAt: "desc" } }, { position: "asc" }],
        select: {
          exerciseId: true,
          sets: { orderBy: { position: "asc" }, select: { kind: true, reps: true, durationSeconds: true, weightKg: true } },
        },
      })
    )
  );
  const out: Record<string, PreviousSet[]> = {};
  for (const r of rows) if (r) out[r.exerciseId] = r.sets;
  return out;
}

/** Resúmenes de ejercicios por id (para rehidratar un entrenamiento a editar). */
export async function getExerciseSummaries(ids: string[]): Promise<Map<string, ExerciseSummary>> {
  const rows = await prisma.exercise.findMany({ where: { id: { in: [...new Set(ids)] } }, select: exerciseSummarySelect });
  return new Map(rows.map((r) => [r.id, toExerciseSummary(r)]));
}

/**
 * Efectos de puntaje "actuales" de una actividad ya guardada. Se usa cuando un reintento con el mismo
 * `clientRequestId` encuentra la actividad creada (la respuesta original se perdió): el servicio no
 * devuelve efectos en ese caso, así que se reconstruyen desde `ScoreEntry` + `SeasonStanding`.
 * `totalBefore` es aproximado (total actual − puntos de la actividad) y `rankBefore` queda en null.
 */
export async function currentScoringEffects(userId: string, activityId: string): Promise<ScoringEffect[]> {
  const entries = await prisma.scoreEntry.findMany({
    where: { activityId, kind: "workout" },
    select: { seasonId: true, points: true, reason: true, season: { select: { name: true, groupId: true, group: { select: { name: true } } } } },
  });
  if (entries.length === 0) return [];
  const standings = await prisma.seasonStanding.findMany({
    where: { userId, seasonId: { in: entries.map((e) => e.seasonId) } },
    select: { seasonId: true, points: true, rank: true },
  });
  const bySeason = new Map(standings.map((s) => [s.seasonId, s]));
  return entries.map((e) => {
    const st = bySeason.get(e.seasonId);
    const totalAfter = st?.points ?? e.points;
    return {
      seasonId: e.seasonId,
      seasonName: e.season.name,
      groupId: e.season.groupId,
      groupName: e.season.group.name,
      activityPoints: e.points,
      activityReason: e.reason,
      totalBefore: totalAfter - e.points,
      totalAfter,
      rankBefore: null,
      rankAfter: st?.rank ?? 0,
    };
  });
}

/** Todo lo que muestra `/workout/[id]` (sin permisos: los chequea la página). */
export async function getWorkoutDetail(activityId: string) {
  const a = await prisma.activity.findUnique({
    where: { id: activityId },
    select: {
      id: true,
      userId: true,
      routineId: true,
      startedAt: true,
      durationMinutes: true,
      notes: true,
      user: { select: { id: true, name: true, photoUrl: true, timezone: true } },
      activityCategory: { select: { id: true, slug: true, name: true } },
      routine: { select: { id: true, name: true } },
      media: { where: { status: "ready" }, orderBy: { position: "asc" }, select: { id: true, url: true, thumbUrl: true } },
      exercises: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          notes: true,
          exercise: { select: exerciseSummarySelect },
          sets: {
            orderBy: { position: "asc" },
            select: { id: true, kind: true, reps: true, durationSeconds: true, weightKg: true, restSeconds: true },
          },
        },
      },
      scoreEntries: {
        where: { kind: "workout" },
        select: { seasonId: true, points: true, reason: true, detail: true, season: { select: { name: true, groupId: true, group: { select: { name: true } } } } },
      },
    },
  });
  if (!a) return null;
  return {
    ...a,
    exercises: a.exercises.map((e) => ({ ...e, exercise: toExerciseSummary(e.exercise) })),
    points: a.scoreEntries.map((s) => ({
      seasonId: s.seasonId,
      seasonName: s.season.name,
      groupId: s.season.groupId,
      groupName: s.season.group.name,
      points: s.points,
      reason: s.reason,
      sharedDay: isSharedDay(s.detail),
    })),
  };
}

export type WorkoutDetail = NonNullable<Awaited<ReturnType<typeof getWorkoutDetail>>>;

/**
 * Temporadas en las que la actividad compartió el día con otras (el motor guarda en `ScoreEntry.detail`
 * los minutos efectivos de la actividad y del día). La UI muestra "Se sumó al tiempo de tu día" aunque
 * el marginal sea > 0 (el motor solo pone `reason` cuando el marginal es 0).
 */
export async function sharedDaySeasonIds(activityId: string): Promise<string[]> {
  const rows = await prisma.scoreEntry.findMany({ where: { activityId, kind: "workout" }, select: { seasonId: true, detail: true } });
  return rows.filter((r) => isSharedDay(r.detail)).map((r) => r.seasonId);
}

export function isSharedDay(detail: unknown): boolean {
  const d = detail as { effectiveMinutes?: unknown; dayMinutes?: unknown } | null;
  return typeof d?.effectiveMinutes === "number" && typeof d?.dayMinutes === "number" && d.dayMinutes > d.effectiveMinutes;
}
