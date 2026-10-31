import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_TZ, addDays, zonedToUtc, type LocalDate } from "@/src/lib/time";
import { computeMuscleMinutes, computePersonalRecords, computeUserStats, type MuscleRef, type StatsActivity, type StatsSet } from "./compute";

const AR = DEFAULT_TZ;
// Miércoles 4/11/2026 12:00 AR → semana actual = lunes 2026-11-02.
const NOW = zonedToUtc("2026-11-04", "12:00", AR);
const W0 = "2026-11-02"; // semana actual
const week = (n: number): LocalDate => addDays(W0, -7 * n); // lunes de hace n semanas

let seq = 0;
function act(date: LocalDate, opts: Partial<Omit<StatsActivity, "id" | "startedAt">> & { time?: string; tz?: string } = {}): StatsActivity {
  const { time = "18:00", tz = AR, ...rest } = opts;
  return {
    id: `a${++seq}`,
    startedAt: zonedToUtc(date, time, tz),
    durationMinutes: 45,
    categoryId: "gym",
    categoryName: "Gimnasio",
    volumeKg: 0,
    sets: 0,
    ...rest,
  };
}
/** `n` actividades en días distintos de la semana `w` (lunes, martes…). */
const inWeek = (w: LocalDate, n: number, opts?: Parameters<typeof act>[1]) => Array.from({ length: n }, (_, i) => act(addDays(w, i), opts));

const ctx = (weeklyGoal = 3) => ({ tz: AR, weeklyGoal, now: NOW });

describe("activeWeeksStreak (semanas activas, bug N−1 de v1)", () => {
  it("4 semanas consecutivas con actividad, incluida la actual → 4", () => {
    const s = computeUserStats([...inWeek(week(3), 1), ...inWeek(week(2), 1), ...inWeek(week(1), 1), ...inWeek(W0, 1)], ctx());
    expect(s.activeWeeksStreak).toBe(4);
  });

  it("un hueco de una semana corta la racha: [x, x, -, x, x(actual)] → 2", () => {
    const s = computeUserStats([...inWeek(week(4), 1), ...inWeek(week(3), 1), ...inWeek(week(1), 1), ...inWeek(W0, 1)], ctx());
    expect(s.activeWeeksStreak).toBe(2);
  });

  it("la semana actual sin actividad todavía no corta la racha: [x, x, x, -(actual)] → 3", () => {
    const s = computeUserStats([...inWeek(week(3), 2), ...inWeek(week(2), 1), ...inWeek(week(1), 1)], ctx());
    expect(s.activeWeeksStreak).toBe(3);
  });

  it("si la semana pasada también está vacía, la racha es 0", () => {
    const s = computeUserStats([...inWeek(week(3), 1), ...inWeek(week(2), 1)], ctx());
    expect(s.activeWeeksStreak).toBe(0);
  });
});

describe("zona horaria del usuario, no la del proceso", () => {
  const original = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = "Europe/Madrid";
  });
  afterAll(() => {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  });

  it("domingo 23:30 AR cuenta para su semana aunque el proceso corra en Europe/Madrid", () => {
    // Domingo 1/11 23:30 AR = lunes 2/11 03:30 en Madrid: v1 la contaba en la semana actual.
    const sunday = act(addDays(W0, -1), { time: "23:30" });
    const s = computeUserStats([...inWeek(week(2), 1), sunday], ctx());
    expect(s.thisWeek.workouts).toBe(0);
    expect(s.activeWeeksStreak).toBe(2);
    expect(s.byWeekday).toEqual([1, 0, 0, 0, 0, 0, 1]);
    expect(s.weekly.at(-2)).toEqual({ weekKey: week(1), workouts: 1, minutes: 45 });
  });

  it("los días de la semana actual son fechas locales del usuario", () => {
    const s = computeUserStats([act(W0, { time: "23:30" }), act(addDays(W0, 2), { time: "00:15" })], ctx());
    expect(s.thisWeek.days).toEqual([
      { date: "2026-11-02", count: 1 },
      { date: "2026-11-03", count: 0 },
      { date: "2026-11-04", count: 1 },
      { date: "2026-11-05", count: 0 },
      { date: "2026-11-06", count: 0 },
      { date: "2026-11-07", count: 0 },
      { date: "2026-11-08", count: 0 },
    ]);
  });
});

describe("rachas de objetivo semanal", () => {
  it("objetivo 3 con semanas [3, 3, 2 (actual, en curso)] → currentStreakWeeks 2", () => {
    const s = computeUserStats([...inWeek(week(2), 3), ...inWeek(week(1), 3), ...inWeek(W0, 2)], ctx(3));
    expect(s.currentStreakWeeks).toBe(2);
    expect(s.thisWeek).toMatchObject({ weekKey: W0, workouts: 2, goal: 3 });
  });

  it("si la actual ya cumple, suma a la racha", () => {
    const s = computeUserStats([...inWeek(week(1), 3), ...inWeek(W0, 3)], ctx(3));
    expect(s.currentStreakWeeks).toBe(2);
  });

  it("mejor racha histórica y total de semanas cumplidas", () => {
    const acts = [
      ...inWeek(week(8), 2), ...inWeek(week(7), 2), ...inWeek(week(6), 2), // racha de 3
      ...inWeek(week(5), 1),
      ...inWeek(week(2), 2), ...inWeek(week(1), 2), // racha actual de 2
    ];
    const s = computeUserStats(acts, ctx(2));
    expect(s.bestStreakWeeks).toBe(3);
    expect(s.perfectWeeks).toBe(5);
    expect(s.currentStreakWeeks).toBe(2);
  });
});

describe("totales, promedios y series", () => {
  it("weekly devuelve 12 entradas (de la más vieja a la actual) aunque haya semanas vacías", () => {
    const s = computeUserStats([act(addDays(week(5), 2), { durationMinutes: 30 })], ctx());
    expect(s.weekly).toHaveLength(12);
    expect(s.weekly[0].weekKey).toBe(week(11));
    expect(s.weekly[11].weekKey).toBe(W0);
    expect(s.weekly.filter((w) => w.workouts > 0)).toEqual([{ weekKey: week(5), workouts: 1, minutes: 30 }]);
  });

  it("sin actividades: todo en cero", () => {
    const s = computeUserStats([], ctx());
    expect(s.totals).toEqual({ workouts: 0, minutes: 0, volumeKg: 0, sets: 0 });
    expect(s.averages).toEqual({ workoutsPerWeek: 0, minutesPerWorkout: 0 });
    expect(s.weekly).toHaveLength(12);
    expect(s.byCategory).toEqual([]);
    expect(s.byWeekday).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect([s.currentStreakWeeks, s.activeWeeksStreak, s.bestStreakWeeks, s.perfectWeeks, s.longestWorkoutMinutes]).toEqual([0, 0, 0, 0, 0]);
  });

  it("totales de por vida, sesión más larga y categorías ordenadas por minutos", () => {
    const acts = [
      act(addDays(week(20), 1), { durationMinutes: 120, categoryId: "run", categoryName: "Running" }),
      act(addDays(week(1), 0), { durationMinutes: 60, volumeKg: 1000.5, sets: 10 }),
      act(addDays(week(1), 2), { durationMinutes: 30, volumeKg: 500, sets: 5 }),
    ];
    const s = computeUserStats(acts, ctx());
    expect(s.totals).toEqual({ workouts: 3, minutes: 210, volumeKg: 1500.5, sets: 15 });
    expect(s.longestWorkoutMinutes).toBe(120);
    // Rango por defecto: 12 semanas → la de running (hace 20 semanas) no entra en byCategory.
    expect(s.byCategory).toEqual([{ categoryId: "gym", name: "Gimnasio", workouts: 2, minutes: 90 }]);
    expect(computeUserStats(acts, { ...ctx(), range: "all" }).byCategory).toEqual([
      { categoryId: "run", name: "Running", workouts: 1, minutes: 120 },
      { categoryId: "gym", name: "Gimnasio", workouts: 2, minutes: 90 },
    ]);
  });

  it("promedios de las últimas 12 semanas, sin contar semanas anteriores al primer entrenamiento", () => {
    // Primer entrenamiento hace 3 semanas → ventana de 4 semanas (incluida la actual).
    const acts = [...inWeek(week(3), 2, { durationMinutes: 60 }), ...inWeek(week(1), 2, { durationMinutes: 30 })];
    const s = computeUserStats(acts, ctx());
    expect(s.averages).toEqual({ workoutsPerWeek: 1, minutesPerWorkout: 45 });
  });

  it("rango de 4 semanas y 'todo'", () => {
    const acts = [act(addDays(week(30), 0)), act(addDays(week(2), 0))];
    expect(computeUserStats(acts, { ...ctx(), range: "4w" }).weekly.map((w) => w.weekKey)).toEqual([week(3), week(2), week(1), W0]);
    const all = computeUserStats(acts, { ...ctx(), range: "all" }).weekly;
    expect(all).toHaveLength(31);
    expect(all[0]).toEqual({ weekKey: week(30), workouts: 1, minutes: 45 });
  });
});

describe("récords personales y balance muscular", () => {
  const set = (p: Partial<StatsSet>): StatsSet => ({
    activityId: "a1", exerciseId: "bench", exerciseName: "Press de banca", startedAt: zonedToUtc("2026-10-20", "18:00", AR),
    weightKg: null, reps: null, ...p,
  });

  it("mejor peso por ejercicio (y las reps de esa serie), ordenado por peso, top 10", () => {
    const prs = computePersonalRecords(
      [
        set({ weightKg: 80, reps: 8 }),
        set({ weightKg: 90, reps: 3, startedAt: zonedToUtc("2026-10-27", "23:30", AR) }),
        set({ weightKg: 90, reps: 5, startedAt: zonedToUtc("2026-10-28", "18:00", AR) }),
        set({ exerciseId: "squat", exerciseName: "Sentadilla", weightKg: 120, reps: 5 }),
        set({ exerciseId: "pullup", exerciseName: "Dominadas", reps: 12 }),
        set({ exerciseId: "plank", exerciseName: "Plancha" }),
      ],
      AR
    );
    expect(prs).toEqual([
      { exerciseId: "squat", exerciseName: "Sentadilla", bestWeightKg: 120, bestReps: 5, date: "2026-10-20" },
      { exerciseId: "bench", exerciseName: "Press de banca", bestWeightKg: 90, bestReps: 5, date: "2026-10-28" },
      { exerciseId: "pullup", exerciseName: "Dominadas", bestWeightKg: null, bestReps: 12, date: "2026-10-20" },
    ]);
  });

  it("como mucho 10 récords", () => {
    const sets = Array.from({ length: 15 }, (_, i) => set({ exerciseId: `e${i}`, exerciseName: `E${i}`, weightKg: i + 1, reps: 1 }));
    const prs = computePersonalRecords(sets, AR);
    expect(prs).toHaveLength(10);
    expect(prs[0].bestWeightKg).toBe(15);
  });
});

describe("semanas activas y perfectas: actual, mejor y total", () => {
  it("activas cuenta semanas con ≥ 1; perfectas, con el objetivo; cada una con su mejor racha", () => {
    // Hace 6..4: activas y perfectas · hace 3: vacía · hace 2..0: activas, solo hace 1 perfecta.
    const s = computeUserStats(
      [
        ...inWeek(week(6), 3),
        ...inWeek(week(5), 3),
        ...inWeek(week(4), 3),
        ...inWeek(week(2), 1),
        ...inWeek(week(1), 3),
        ...inWeek(W0, 1),
      ],
      ctx(3)
    );
    expect([s.activeWeeksStreak, s.bestActiveStreakWeeks, s.activeWeeks]).toEqual([3, 3, 6]);
    expect([s.currentStreakWeeks, s.bestStreakWeeks, s.perfectWeeks]).toEqual([1, 3, 4]);
  });
});

describe("goalProgress (puntos del objetivo)", () => {
  it("tope en el objetivo por semana, lo que sobra va a extra y la actual queda marcada", () => {
    const s = computeUserStats([...inWeek(week(2), 5), ...inWeek(week(1), 1), ...inWeek(W0, 2)], { ...ctx(3), range: "4w" });
    expect(s.goalProgress).toEqual([
      { weekKey: week(2), goal: 3, done: 3, extra: 2, current: false },
      { weekKey: week(1), goal: 3, done: 1, extra: 0, current: false },
      { weekKey: W0, goal: 3, done: 2, extra: 0, current: true },
    ]);
  });

  it("no cuenta semanas anteriores al primer entrenamiento, ni fuera del rango", () => {
    const s = computeUserStats([...inWeek(week(20), 1), ...inWeek(week(1), 2)], { ...ctx(2), range: "4w" });
    expect(s.goalProgress.map((w) => w.weekKey)).toEqual([week(3), week(2), week(1), W0]);
    const all = computeUserStats([...inWeek(week(20), 1), ...inWeek(week(1), 2)], { ...ctx(2), range: "all" });
    expect(all.goalProgress).toHaveLength(21);
    expect(all.goalProgress[0]).toMatchObject({ weekKey: week(20), done: 1 });
  });

  it("sin entrenamientos no hay puntos", () => {
    expect(computeUserStats([], ctx()).goalProgress).toEqual([]);
  });
});

describe("minutos por día de la semana y por horario (del rango, zona del usuario)", () => {
  it("suma minutos por día del rango e ignora lo anterior", () => {
    const s = computeUserStats(
      [
        act(W0, { durationMinutes: 30 }), // lunes
        act(addDays(W0, 1), { durationMinutes: 60 }), // martes
        act(week(1), { durationMinutes: 45 }), // lunes anterior
        act(week(10), { durationMinutes: 90 }), // fuera de 4 semanas
      ],
      { ...ctx(), range: "4w" }
    );
    expect(s.byWeekdayInRange[0]).toEqual({ workouts: 2, minutes: 75 });
    expect(s.byWeekdayInRange[1]).toEqual({ workouts: 1, minutes: 60 });
    expect(s.byWeekdayInRange.slice(2).every((d) => d.workouts === 0)).toBe(true);
  });

  it("franjas por hora local de inicio: 05:59 madrugada, 06:00 mañana, 12:00 tarde, 18:00 y 23:59 noche", () => {
    const s = computeUserStats(
      [
        act(W0, { time: "05:59", durationMinutes: 10 }),
        act(W0, { time: "06:00", durationMinutes: 20 }),
        act(W0, { time: "12:00", durationMinutes: 30 }),
        act(W0, { time: "18:00", durationMinutes: 40 }),
        act(W0, { time: "23:59", durationMinutes: 50 }),
      ],
      ctx()
    );
    expect(s.byDaypart).toEqual([
      { key: "morning", workouts: 1, minutes: 20 },
      { key: "afternoon", workouts: 1, minutes: 30 },
      { key: "night", workouts: 2, minutes: 90 },
      { key: "late", workouts: 1, minutes: 10 },
    ]);
  });

  it("la franja usa la zona del usuario, no UTC", () => {
    // 07:00 en Buenos Aires = 10:00 UTC: tiene que ser "mañana" igual.
    const s = computeUserStats([act(W0, { time: "07:00" })], ctx());
    expect(s.byDaypart.find((d) => d.key === "morning")?.workouts).toBe(1);
  });
});

describe("computeMuscleMinutes", () => {
  const muscles = new Map<string, MuscleRef[]>([
    [
      "bench",
      [
        { muscleId: "pec", name: "Pectoral", groupKey: "chest", percentage: 70 },
        { muscleId: "tri", name: "Tríceps", groupKey: "arms", percentage: 30 },
      ],
    ],
    ["squat", [{ muscleId: "quad", name: "Cuádriceps", groupKey: "legs", percentage: 100 }]],
  ]);

  it("reparte la duración entre ejercicios por series y entre músculos por porcentaje", () => {
    // 60 min: banca 4 series (40 min → 28 pecho, 12 tríceps), sentadilla 2 series (20 min).
    const r = computeMuscleMinutes(
      [{ activityId: "a", durationMinutes: 60, exercises: [{ exerciseId: "bench", sets: 4 }, { exerciseId: "squat", sets: 2 }] }],
      muscles
    );
    expect(r.groups).toEqual([
      { groupKey: "chest", minutes: 28 },
      { groupKey: "legs", minutes: 20 },
      { groupKey: "arms", minutes: 12 },
    ]);
    expect(r.muscles.map((m) => [m.name, m.minutes, m.workouts])).toEqual([
      ["Pectoral", 28, 1],
      ["Cuádriceps", 20, 1],
      ["Tríceps", 12, 1],
    ]);
  });

  it("cuenta en cuántos entrenamientos aparece cada músculo (una vez por entrenamiento)", () => {
    const r = computeMuscleMinutes(
      [
        { activityId: "a", durationMinutes: 30, exercises: [{ exerciseId: "bench", sets: 3 }] },
        { activityId: "b", durationMinutes: 30, exercises: [{ exerciseId: "bench", sets: 3 }, { exerciseId: "squat", sets: 3 }] },
      ],
      muscles
    );
    expect(r.muscles.find((m) => m.muscleId === "pec")).toMatchObject({ minutes: 32, workouts: 2 });
    expect(r.muscles.find((m) => m.muscleId === "quad")).toMatchObject({ minutes: 15, workouts: 1 });
  });

  it("sin series con músculos (correr) no suma; ejercicios sin músculos no se llevan tiempo", () => {
    const r = computeMuscleMinutes(
      [
        { activityId: "run", durationMinutes: 45, exercises: [] },
        { activityId: "a", durationMinutes: 40, exercises: [{ exerciseId: "squat", sets: 2 }, { exerciseId: "mystery", sets: 2 }] },
      ],
      muscles
    );
    expect(r.groups).toEqual([{ groupKey: "legs", minutes: 40 }]);
  });
});
