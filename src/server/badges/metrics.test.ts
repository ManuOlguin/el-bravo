import { describe, it, expect } from "vitest";
import { computeMetric, type MetricActivity } from "./metrics";
import { zonedToUtc, addDays } from "@/src/lib/time";

const TZ = "America/Argentina/Buenos_Aires";
let seq = 0;

function act(
  localDate: string,
  localTime = "18:00",
  over: Partial<Omit<MetricActivity, "startedAt">> = {}
): MetricActivity {
  return {
    id: `a${++seq}`,
    startedAt: zonedToUtc(localDate, localTime, TZ),
    durationMinutes: 45,
    categorySlug: "strength",
    sets: [],
    ...over,
  };
}

const ctx = (activities: MetricActivity[], weeklyGoal = 3) => ({
  activities,
  timezone: TZ,
  weeklyGoal,
  now: new Date("2026-12-31T12:00:00Z"),
});

describe("computeMetric", () => {
  it("total_workouts cuenta todas las actividades", () => {
    expect(computeMetric("total_workouts", {}, ctx([]))).toBe(0);
    expect(computeMetric("total_workouts", {}, ctx([act("2026-10-01"), act("2026-10-02")]))).toBe(2);
  });

  it("category_workouts cuenta solo las categorías pedidas", () => {
    const acts = [
      act("2026-10-01", "18:00", { categorySlug: "running" }),
      act("2026-10-02", "18:00", { categorySlug: "trail_running" }),
      act("2026-10-03", "18:00", { categorySlug: "strength" }),
    ];
    expect(computeMetric("category_workouts", { categories: ["running", "trail_running"] }, ctx(acts))).toBe(2);
    expect(computeMetric("category_workouts", {}, ctx(acts))).toBe(0);
  });

  describe("best_goal_streak", () => {
    // Semanas que arrancan el lunes 2026-09-07
    const weeks = (counts: number[]) => {
      const out: MetricActivity[] = [];
      counts.forEach((n, w) => {
        for (let i = 0; i < n; i++) out.push(act(addDays("2026-09-07", w * 7 + i)));
      });
      return out;
    };

    it("devuelve la MEJOR racha histórica, no la actual", () => {
      expect(computeMetric("best_goal_streak", {}, ctx(weeks([2, 2, 0, 2, 2, 2]), 2))).toBe(3);
    });

    it("una semana bajo el objetivo corta la racha", () => {
      expect(computeMetric("best_goal_streak", {}, ctx(weeks([2, 2, 1, 2]), 2))).toBe(2);
    });

    it("sin actividades es 0", () => {
      expect(computeMetric("best_goal_streak", {}, ctx([], 2))).toBe(0);
    });

    it("el domingo 23:30 en Argentina cuenta para esa semana, no la siguiente", () => {
      // lunes 2026-09-07 + domingo 2026-09-13 23:30 (= lunes 02:30 UTC) → 2 en la misma semana
      const acts = [act("2026-09-07", "10:00"), act("2026-09-13", "23:30")];
      expect(computeMetric("best_goal_streak", {}, ctx(acts, 2))).toBe(1);
    });
  });

  describe("muscle_sets", () => {
    const set = (completed: boolean, groups: { groupKey: string; percentage: number }[]) => ({
      completed,
      muscleGroups: groups,
    });

    it("cuenta series completas de ejercicios con ≥ 30 % del grupo", () => {
      const legs60 = [{ groupKey: "legs", percentage: 60 }, { groupKey: "core", percentage: 40 }];
      const a = act("2026-10-01", "18:00", {
        sets: [set(true, legs60), set(true, legs60), set(true, legs60), set(false, legs60)],
      });
      expect(computeMetric("muscle_sets", { groupKey: "legs", minPercentage: 30 }, ctx([a]))).toBe(3);
    });

    it("un ejercicio con 20 % del grupo no suma", () => {
      const a = act("2026-10-01", "18:00", { sets: [set(true, [{ groupKey: "legs", percentage: 20 }])] });
      expect(computeMetric("muscle_sets", { groupKey: "legs", minPercentage: 30 }, ctx([a]))).toBe(0);
    });

    it("usa 30 % por defecto y suma músculos del mismo grupo", () => {
      const a = act("2026-10-01", "18:00", {
        sets: [set(true, [{ groupKey: "legs", percentage: 20 }, { groupKey: "legs", percentage: 15 }])],
      });
      expect(computeMetric("muscle_sets", { groupKey: "legs" }, ctx([a]))).toBe(1);
    });

    it("sin groupKey es 0", () => {
      const a = act("2026-10-01", "18:00", { sets: [set(true, [{ groupKey: "legs", percentage: 100 }])] });
      expect(computeMetric("muscle_sets", {}, ctx([a]))).toBe(0);
    });
  });

  it("distinct_categories cuenta categorías distintas", () => {
    const acts = [
      act("2026-10-01", "18:00", { categorySlug: "running" }),
      act("2026-10-02", "18:00", { categorySlug: "running" }),
      act("2026-10-03", "18:00", { categorySlug: "yoga_pilates" }),
    ];
    expect(computeMetric("distinct_categories", {}, ctx(acts))).toBe(2);
  });

  it("total_minutes suma la duración", () => {
    const acts = [act("2026-10-01", "18:00", { durationMinutes: 30 }), act("2026-10-02", "18:00", { durationMinutes: 75 })];
    expect(computeMetric("total_minutes", {}, ctx(acts))).toBe(105);
  });

  it("early_workouts: 07:59 local cuenta y 08:00 no", () => {
    const acts = [act("2026-10-01", "07:59"), act("2026-10-02", "08:00"), act("2026-10-03", "05:00")];
    expect(computeMetric("early_workouts", { beforeHour: 8 }, ctx(acts))).toBe(2);
    expect(computeMetric("early_workouts", {}, ctx(acts))).toBe(2);
    expect(computeMetric("early_workouts", { beforeHour: 6 }, ctx(acts))).toBe(1);
  });
});
