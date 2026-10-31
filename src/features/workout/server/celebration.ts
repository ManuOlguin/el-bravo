import "server-only";
import { prisma } from "@/src/lib/db";
import { weekKeyOf } from "@/src/lib/time";
import type { ScoringEffect } from "@/src/server/scoring";
import { getSeasonStandings } from "@/src/server/scoring/queries";
import { getUserStats } from "@/src/server/stats";
import { climbed, findNewRecords, passedUsers, standingsWindow } from "../celebration";
import type { Celebration } from "../types";

/**
 * Datos de la secuencia de festejo de un entrenamiento recién creado: número de entrenamiento,
 * la semana (si es la actual), récords de peso y, por temporada, su lugar en el ranking con sus vecinos
 * y a quiénes pasó.
 * Se llama después de guardar; si algo falla, el que llama sigue sin festejo (no rompe el guardado).
 */
export async function getWorkoutCelebration(userId: string, activityId: string, scoring: ScoringEffect[]): Promise<Celebration> {
  const activity = await prisma.activity.findUniqueOrThrow({
    where: { id: activityId },
    select: {
      startedAt: true,
      user: { select: { timezone: true } },
      exercises: {
        select: {
          exerciseId: true,
          exercise: { select: { name: true } },
          sets: { where: { completed: true, weightKg: { gt: 0 } }, select: { weightKg: true, reps: true } },
        },
      },
    },
  });

  const exerciseIds = [...new Set(activity.exercises.map((e) => e.exerciseId))];
  const [workoutNumber, stats, previous, standings] = await Promise.all([
    prisma.activity.count({ where: { userId } }),
    getUserStats(userId),
    exerciseIds.length
      ? prisma.activitySet.findMany({
          where: {
            completed: true,
            weightKg: { gt: 0 },
            activityExercise: { exerciseId: { in: exerciseIds }, activityId: { not: activityId }, activity: { userId } },
          },
          select: { weightKg: true, activityExercise: { select: { exerciseId: true } } },
        })
      : [],
    Promise.all(
      scoring
        .filter((e) => e.rankAfter > 0)
        .map(async (e) => {
          const rows = await getSeasonStandings(e.seasonId);
          return {
            seasonId: e.seasonId,
            meId: userId,
            rows: standingsWindow(rows, userId).map(({ userId, name, photoUrl, rank, points }) => ({ userId, name, photoUrl, rank, points })),
            passed: climbed(e) ? passedUsers(rows, userId, e.rankBefore!, e.rankAfter) : [],
          };
        })
    ),
  ]);

  const previousBest = new Map<string, number>();
  for (const s of previous) {
    const id = s.activityExercise.exerciseId;
    previousBest.set(id, Math.max(previousBest.get(id) ?? 0, s.weightKg ?? 0));
  }
  const records = findNewRecords(
    activity.exercises.flatMap((e) =>
      e.sets.map((s) => ({ exerciseId: e.exerciseId, exerciseName: e.exercise.name, weightKg: s.weightKg ?? 0, reps: s.reps }))
    ),
    previousBest
  );

  const inCurrentWeek = weekKeyOf(activity.startedAt, activity.user.timezone) === stats.thisWeek.weekKey;
  const { workouts, goal } = stats.thisWeek;
  return {
    workoutNumber,
    week: inCurrentWeek ? { workouts, goal, justMet: workouts === goal, perfectStreak: stats.currentStreakWeeks } : null,
    records,
    standings,
  };
}
