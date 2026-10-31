/**
 * Métricas de por vida para insignias (roadmap D2). Funciones puras: no hay I/O.
 * El valor de cada métrica se compara contra los umbrales de `BadgeLevel` en `evaluate.ts`.
 */
import { addWeeks, localTimeOf, weekKeyOf, type WeekKey } from "@/src/lib/time";

export type MetricActivity = {
  id: string;
  startedAt: Date;
  durationMinutes: number;
  categorySlug: string;
  sets: { completed: boolean; muscleGroups: { groupKey: string; percentage: number }[] }[];
};

export type MetricKey =
  | "total_workouts"
  | "category_workouts"
  | "best_goal_streak"
  | "muscle_sets"
  | "distinct_categories"
  | "total_minutes"
  | "early_workouts";

export const METRIC_KEYS: readonly MetricKey[] = [
  "total_workouts",
  "category_workouts",
  "best_goal_streak",
  "muscle_sets",
  "distinct_categories",
  "total_minutes",
  "early_workouts",
];

export type MetricParams = { categories?: string[]; groupKey?: string; minPercentage?: number; beforeHour?: number };

export type MetricContext = { activities: MetricActivity[]; timezone: string; weeklyGoal: number; now: Date };

export function isMetricKey(value: string): value is MetricKey {
  return (METRIC_KEYS as readonly string[]).includes(value);
}

/** Mejor racha histórica de semanas consecutivas (lunes a domingo, zona del usuario) con ≥ `weeklyGoal` actividades. */
function bestGoalStreak(activities: MetricActivity[], tz: string, weeklyGoal: number): number {
  const goal = Math.max(1, weeklyGoal);
  const perWeek = new Map<WeekKey, number>();
  for (const a of activities) {
    const w = weekKeyOf(a.startedAt, tz);
    perWeek.set(w, (perWeek.get(w) ?? 0) + 1);
  }
  const metWeeks = [...perWeek.entries()].filter(([, n]) => n >= goal).map(([w]) => w).sort();
  let best = 0;
  let run = 0;
  let prev: WeekKey | null = null;
  for (const w of metWeeks) {
    run = prev !== null && addWeeks(prev, 1) === w ? run + 1 : 1;
    best = Math.max(best, run);
    prev = w;
  }
  return best;
}

/** Series completas cuyo ejercicio trabaja `groupKey` con ≥ `minPercentage` % (sumando los músculos del grupo). */
function muscleSets(activities: MetricActivity[], groupKey: string | undefined, minPercentage: number): number {
  if (!groupKey) return 0;
  let n = 0;
  for (const a of activities) {
    for (const s of a.sets) {
      if (!s.completed) continue;
      const pct = s.muscleGroups.reduce((acc, m) => (m.groupKey === groupKey ? acc + m.percentage : acc), 0);
      if (pct > 0 && pct >= minPercentage) n++;
    }
  }
  return n;
}

export function computeMetric(key: MetricKey, params: MetricParams, ctx: MetricContext): number {
  const { activities, timezone } = ctx;
  switch (key) {
    case "total_workouts":
      return activities.length;
    case "category_workouts": {
      const cats = new Set(params.categories ?? []);
      return activities.filter((a) => cats.has(a.categorySlug)).length;
    }
    case "best_goal_streak":
      return bestGoalStreak(activities, timezone, ctx.weeklyGoal);
    case "muscle_sets":
      return muscleSets(activities, params.groupKey, params.minPercentage ?? 30);
    case "distinct_categories":
      return new Set(activities.map((a) => a.categorySlug)).size;
    case "total_minutes":
      return activities.reduce((acc, a) => acc + a.durationMinutes, 0);
    case "early_workouts": {
      const beforeHour = params.beforeHour ?? 8;
      return activities.filter((a) => Number(localTimeOf(a.startedAt, timezone).slice(0, 2)) < beforeHour).length;
    }
    default: {
      const never: never = key;
      throw new Error(`Métrica desconocida: ${String(never)}`);
    }
  }
}
