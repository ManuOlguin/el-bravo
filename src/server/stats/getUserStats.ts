import "server-only";
import { prisma } from "@/src/lib/db";
import {
  computeMuscleBalance,
  computePersonalRecords,
  computeUserStats,
  type StatsActivity,
  type StatsRange,
  type StatsSet,
  type UserStats,
} from "./compute";

/**
 * Estadísticas personales de `userId` en SU zona horaria. Lee TODAS sus actividades (sin `take`):
 * 3 queries con `select` mínimo (actividades, series completadas, ejercicios con músculos).
 */
export async function getUserStats(userId: string, opts: { range?: StatsRange; now?: Date } = {}): Promise<UserStats> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true, weeklyGoal: true } });
  if (!user) throw new Error("Usuario inexistente");

  const [activities, sets] = await Promise.all([
    prisma.activity.findMany({
      where: { userId },
      select: { id: true, startedAt: true, durationMinutes: true, activityCategoryId: true, activityCategory: { select: { name: true } } },
    }),
    prisma.activitySet.findMany({
      where: { completed: true, activityExercise: { activity: { userId } } },
      select: { weightKg: true, reps: true, activityExercise: { select: { activityId: true, exerciseId: true } } },
    }),
  ]);

  const exerciseIds = [...new Set(sets.map((s) => s.activityExercise.exerciseId))];
  const exercises = exerciseIds.length
    ? await prisma.exercise.findMany({
        where: { id: { in: exerciseIds } },
        select: { id: true, name: true, muscles: { select: { percentage: true, muscle: { select: { groupKey: true } } } } },
      })
    : [];

  const perActivity = new Map<string, { volumeKg: number; sets: number }>();
  const perExercise = new Map<string, number>();
  for (const s of sets) {
    const { activityId, exerciseId } = s.activityExercise;
    const agg = perActivity.get(activityId) ?? { volumeKg: 0, sets: 0 };
    agg.sets++;
    if (s.weightKg && s.reps) agg.volumeKg += s.weightKg * s.reps;
    perActivity.set(activityId, agg);
    perExercise.set(exerciseId, (perExercise.get(exerciseId) ?? 0) + 1);
  }

  const statsActivities: StatsActivity[] = activities.map((a) => ({
    id: a.id,
    startedAt: a.startedAt,
    durationMinutes: a.durationMinutes,
    categoryId: a.activityCategoryId,
    categoryName: a.activityCategory.name,
    volumeKg: perActivity.get(a.id)?.volumeKg ?? 0,
    sets: perActivity.get(a.id)?.sets ?? 0,
  }));

  const startedAtById = new Map(activities.map((a) => [a.id, a.startedAt]));
  const exerciseById = new Map(exercises.map((e) => [e.id, e]));
  const statsSets: StatsSet[] = sets.map((s) => ({
    activityId: s.activityExercise.activityId,
    exerciseId: s.activityExercise.exerciseId,
    exerciseName: exerciseById.get(s.activityExercise.exerciseId)?.name ?? "Ejercicio",
    startedAt: startedAtById.get(s.activityExercise.activityId)!,
    weightKg: s.weightKg,
    reps: s.reps,
  }));

  const base = computeUserStats(statsActivities, {
    tz: user.timezone,
    weeklyGoal: user.weeklyGoal,
    now: opts.now ?? new Date(),
    range: opts.range,
  });

  return {
    ...base,
    byMuscleGroup: computeMuscleBalance(
      [...perExercise].map(([exerciseId, n]) => ({ exerciseId, sets: n })),
      new Map(exercises.map((e) => [e.id, e.muscles.map((m) => ({ groupKey: m.muscle.groupKey, percentage: m.percentage }))]))
    ),
    personalRecords: computePersonalRecords(statsSets, user.timezone),
  };
}
