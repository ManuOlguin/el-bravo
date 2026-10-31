/**
 * Estadísticas personales (W2-4). Funciones puras: sin I/O y sin depender de la zona del proceso.
 * Todo cálculo de semanas y días pasa por `src/lib/time` con la zona del usuario.
 *
 * "Semana cumplida" = semana (lunes a domingo, zona del usuario) con ≥ `weeklyGoal` entrenamientos,
 * igual que la insignia "Imparable" (`src/server/badges/metrics.ts`), así ambos números coinciden.
 */
import { addDays, addWeeks, localDateOf, weekKeyOf, weekKeyOfLocalDate, type LocalDate, type WeekKey } from "@/src/lib/time";

export type StatsActivity = {
  id: string;
  startedAt: Date;
  durationMinutes: number;
  categoryId: string;
  categoryName: string;
  volumeKg: number;
  sets: number;
};

/** Rango del selector de /stats. Afecta `weekly` y `byCategory`. */
export type StatsRange = "4w" | "12w" | "all";
export const STATS_RANGES: readonly StatsRange[] = ["4w", "12w", "all"];
export function isStatsRange(v: unknown): v is StatsRange {
  return typeof v === "string" && (STATS_RANGES as readonly string[]).includes(v);
}

export type PersonalRecord = {
  exerciseId: string;
  exerciseName: string;
  bestWeightKg: number | null;
  bestReps: number | null;
  date: LocalDate;
};

export type UserStats = {
  thisWeek: { weekKey: WeekKey; workouts: number; goal: number; days: { date: LocalDate; count: number }[] };
  /** Semanas consecutivas cumpliendo el objetivo, terminando en la actual (si ya cumple) o en la anterior. */
  currentStreakWeeks: number;
  /** Semanas consecutivas con ≥ 1 entrenamiento (las "semanas activas" de la home de v1). */
  activeWeeksStreak: number;
  bestStreakWeeks: number;
  /** Total de semanas con el objetivo cumplido. */
  perfectWeeks: number;
  totals: { workouts: number; minutes: number; volumeKg: number; sets: number };
  /** Últimas 12 semanas (sin contar las anteriores al primer entrenamiento). */
  averages: { workoutsPerWeek: number; minutesPerWorkout: number };
  longestWorkoutMinutes: number;
  /** Del rango elegido (12 semanas por defecto), de la más vieja a la actual, con ceros. */
  weekly: { weekKey: WeekKey; workouts: number; minutes: number }[];
  /** Del rango elegido, por minutos desc. */
  byCategory: { categoryId: string; name: string; workouts: number; minutes: number }[];
  /** Entrenamientos de por vida por día de la semana: lunes..domingo. */
  byWeekday: number[];
  byMuscleGroup: { groupKey: string; sets: number }[];
  /** Top 10 por peso. */
  personalRecords: PersonalRecord[];
};

export type StatsContext = { tz: string; weeklyGoal: number; now: Date; range?: StatsRange };

const AVERAGE_WEEKS = 12;
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Racha de semanas consecutivas que cumplen `min`, terminando en la actual. La semana en curso no la corta. */
function streakEndingAt(perWeek: Map<WeekKey, number>, current: WeekKey, min: number): number {
  let streak = (perWeek.get(current) ?? 0) >= min ? 1 : 0;
  for (let w = addWeeks(current, -1); (perWeek.get(w) ?? 0) >= min; w = addWeeks(w, -1)) streak++;
  return streak;
}

function bestStreak(perWeek: Map<WeekKey, number>, min: number): number {
  const met = [...perWeek.entries()].filter(([, n]) => n >= min).map(([w]) => w).sort();
  let best = 0;
  let run = 0;
  let prev: WeekKey | null = null;
  for (const w of met) {
    run = prev !== null && addWeeks(prev, 1) === w ? run + 1 : 1;
    best = Math.max(best, run);
    prev = w;
  }
  return best;
}

/** Cantidad de semanas (incluida la actual) que muestra cada rango. */
function rangeWeeks(range: StatsRange, current: WeekKey, firstWeek: WeekKey | null): number {
  if (range === "4w") return 4;
  if (range === "12w" || !firstWeek) return 12;
  let n = 1;
  for (let w = firstWeek; w < current; w = addWeeks(w, 1)) n++;
  return Math.max(12, n);
}

export function computeUserStats(activities: StatsActivity[], ctx: StatsContext): Omit<UserStats, "byMuscleGroup" | "personalRecords"> {
  const { tz, now } = ctx;
  const goal = Math.max(1, ctx.weeklyGoal);
  const range = ctx.range ?? "12w";
  const current = weekKeyOf(now, tz);

  const perWeek = new Map<WeekKey, { workouts: number; minutes: number }>();
  const perDay = new Map<LocalDate, number>();
  const byWeekday = [0, 0, 0, 0, 0, 0, 0];
  const totals = { workouts: 0, minutes: 0, volumeKg: 0, sets: 0 };
  let longest = 0;
  let firstWeek: WeekKey | null = null;
  const enriched: { week: WeekKey; a: StatsActivity }[] = [];

  for (const a of activities) {
    const date = localDateOf(a.startedAt, tz);
    const week = weekKeyOfLocalDate(date);
    enriched.push({ week, a });
    const w = perWeek.get(week) ?? { workouts: 0, minutes: 0 };
    w.workouts++;
    w.minutes += a.durationMinutes;
    perWeek.set(week, w);
    perDay.set(date, (perDay.get(date) ?? 0) + 1);
    byWeekday[Math.round((Date.parse(date) - Date.parse(week)) / 86_400_000)]++;
    totals.workouts++;
    totals.minutes += a.durationMinutes;
    totals.volumeKg += a.volumeKg;
    totals.sets += a.sets;
    longest = Math.max(longest, a.durationMinutes);
    if (firstWeek === null || week < firstWeek) firstWeek = week;
  }
  totals.volumeKg = round1(totals.volumeKg);

  const counts = new Map([...perWeek].map(([k, v]) => [k, v.workouts]));

  // Serie semanal del rango elegido.
  const nWeeks = rangeWeeks(range, current, firstWeek);
  const rangeStart = addWeeks(current, -(nWeeks - 1));
  const weekly = Array.from({ length: nWeeks }, (_, i) => {
    const weekKey = addWeeks(rangeStart, i);
    const w = perWeek.get(weekKey);
    return { weekKey, workouts: w?.workouts ?? 0, minutes: w?.minutes ?? 0 };
  });

  const cats = new Map<string, { categoryId: string; name: string; workouts: number; minutes: number }>();
  for (const { week, a } of enriched) {
    if (week < rangeStart || week > current) continue;
    const c = cats.get(a.categoryId) ?? { categoryId: a.categoryId, name: a.categoryName, workouts: 0, minutes: 0 };
    c.workouts++;
    c.minutes += a.durationMinutes;
    cats.set(a.categoryId, c);
  }
  const byCategory = [...cats.values()].sort((x, y) => y.minutes - x.minutes || y.workouts - x.workouts || x.name.localeCompare(y.name));

  // Promedios: últimas 12 semanas, sin penalizar a quien empezó hace menos.
  let avgStart = addWeeks(current, -(AVERAGE_WEEKS - 1));
  if (firstWeek && firstWeek > avgStart) avgStart = firstWeek;
  let avgWeeks = 0;
  let avgWorkouts = 0;
  let avgMinutes = 0;
  for (let w = avgStart; w <= current; w = addWeeks(w, 1)) {
    avgWeeks++;
    avgWorkouts += perWeek.get(w)?.workouts ?? 0;
    avgMinutes += perWeek.get(w)?.minutes ?? 0;
  }

  return {
    thisWeek: {
      weekKey: current,
      workouts: counts.get(current) ?? 0,
      goal,
      days: Array.from({ length: 7 }, (_, i) => {
        const date = addDays(current, i);
        return { date, count: perDay.get(date) ?? 0 };
      }),
    },
    currentStreakWeeks: streakEndingAt(counts, current, goal),
    activeWeeksStreak: streakEndingAt(counts, current, 1),
    bestStreakWeeks: bestStreak(counts, goal),
    perfectWeeks: [...counts.values()].filter((n) => n >= goal).length,
    totals,
    averages: {
      workoutsPerWeek: avgWorkouts === 0 ? 0 : round1(avgWorkouts / avgWeeks),
      minutesPerWorkout: avgWorkouts === 0 ? 0 : Math.round(avgMinutes / avgWorkouts),
    },
    longestWorkoutMinutes: longest,
    weekly,
    byCategory,
    byWeekday,
  };
}

/** Una serie completada con su contexto (para récords). */
export type StatsSet = {
  activityId: string;
  exerciseId: string;
  exerciseName: string;
  startedAt: Date;
  weightKg: number | null;
  reps: number | null;
};

/**
 * Mejor marca por ejercicio: el mayor peso (y las reps de esa serie); sin peso, las mayores reps.
 * A igual marca gana la primera vez que se logró. Top 10: primero los de peso (desc), después reps.
 */
export function computePersonalRecords(sets: StatsSet[], tz: string, limit = 10): PersonalRecord[] {
  const best = new Map<string, StatsSet>();
  const better = (s: StatsSet, b: StatsSet) => {
    const sw = s.weightKg ?? 0;
    const bw = b.weightKg ?? 0;
    if (sw !== bw) return sw > bw;
    const sr = s.reps ?? 0;
    const br = b.reps ?? 0;
    if (sr !== br) return sr > br;
    return s.startedAt < b.startedAt;
  };
  for (const s of sets) {
    const hasWeight = s.weightKg !== null && s.weightKg > 0;
    const hasReps = s.reps !== null && s.reps > 0;
    if (!hasWeight && !hasReps) continue;
    const b = best.get(s.exerciseId);
    if (!b || better(s, b)) best.set(s.exerciseId, s);
  }
  return [...best.values()]
    .map((s) => ({
      exerciseId: s.exerciseId,
      exerciseName: s.exerciseName,
      bestWeightKg: s.weightKg !== null && s.weightKg > 0 ? s.weightKg : null,
      bestReps: s.reps !== null && s.reps > 0 ? s.reps : null,
      date: localDateOf(s.startedAt, tz),
    }))
    .sort(
      (x, y) =>
        (y.bestWeightKg ?? -1) - (x.bestWeightKg ?? -1) || (y.bestReps ?? 0) - (x.bestReps ?? 0) || x.exerciseName.localeCompare(y.exerciseName)
    )
    .slice(0, limit);
}

/**
 * Series por grupo muscular. Cada serie se reparte entre los grupos del ejercicio según sus porcentajes
 * (normalizados), así la suma de los grupos es la cantidad de series con músculos cargados.
 */
export function computeMuscleBalance(
  setsPerExercise: { exerciseId: string; sets: number }[],
  musclesByExercise: Map<string, { groupKey: string; percentage: number }[]>
): { groupKey: string; sets: number }[] {
  const out = new Map<string, number>();
  for (const { exerciseId, sets } of setsPerExercise) {
    const muscles = (musclesByExercise.get(exerciseId) ?? []).filter((m) => m.percentage > 0);
    const total = muscles.reduce((acc, m) => acc + m.percentage, 0);
    if (total <= 0 || sets <= 0) continue;
    for (const m of muscles) out.set(m.groupKey, (out.get(m.groupKey) ?? 0) + (sets * m.percentage) / total);
  }
  return [...out.entries()]
    .map(([groupKey, sets]) => ({ groupKey, sets: round1(sets) }))
    .filter((g) => g.sets > 0)
    .sort((x, y) => y.sets - x.sets || x.groupKey.localeCompare(y.groupKey));
}
