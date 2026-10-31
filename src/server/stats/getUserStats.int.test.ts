import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetDb, prisma } from "@/tests/setup/db";
import { DEFAULT_TZ, addDays, zonedToUtc } from "@/src/lib/time";

vi.mock("server-only", () => ({}));

import { getUserStats } from "./getUserStats";

const NOW = zonedToUtc("2026-11-04", "12:00", DEFAULT_TZ);

async function setup() {
  const user = await prisma.user.create({ data: { email: "u@u.com", passwordHash: "x", name: "U", weeklyGoal: 2 } });
  const gym = await prisma.activityCategory.create({ data: { slug: "strength", name: "Fuerza" } });
  const run = await prisma.activityCategory.create({ data: { slug: "running", name: "Running" } });
  const chest = await prisma.muscle.create({ data: { name: "Pecho", slug: "pecho", groupKey: "chest" } });
  const triceps = await prisma.muscle.create({ data: { name: "Tríceps", slug: "triceps", groupKey: "arms" } });
  const bench = await prisma.exercise.create({
    data: {
      slug: "bench",
      name: "Press de banca",
      muscles: { create: [{ muscleId: chest.id, percentage: 70 }, { muscleId: triceps.id, percentage: 30 }] },
    },
  });
  return { user, gym, run, bench };
}

describe("getUserStats", () => {
  beforeEach(resetDb);

  it("agrega volumen, series, récords y músculos desde la DB, en la zona del usuario", async () => {
    const { user, gym, run, bench } = await setup();
    const a1 = await prisma.activity.create({
      data: { userId: user.id, activityCategoryId: gym.id, startedAt: zonedToUtc("2026-11-02", "18:00", DEFAULT_TZ), durationMinutes: 60 },
    });
    await prisma.activityExercise.create({
      data: {
        activityId: a1.id,
        exerciseId: bench.id,
        position: 0,
        sets: {
          create: [
            { position: 0, reps: 10, weightKg: 60 },
            { position: 1, reps: 5, weightKg: 80 },
            { position: 2, reps: 20, weightKg: 100, completed: false }, // no cuenta
          ],
        },
      },
    });
    // Domingo 23:30 AR: semana anterior.
    await prisma.activity.create({
      data: { userId: user.id, activityCategoryId: run.id, startedAt: zonedToUtc("2026-11-01", "23:30", DEFAULT_TZ), durationMinutes: 30 },
    });

    const s = await getUserStats(user.id, { now: NOW });
    expect(s.totals).toEqual({ workouts: 2, minutes: 90, volumeKg: 1000, sets: 2 });
    expect(s.thisWeek).toMatchObject({ weekKey: "2026-11-02", workouts: 1, goal: 2 });
    expect(s.activeWeeksStreak).toBe(2);
    expect(s.personalRecords).toEqual([
      { exerciseId: bench.id, exerciseName: "Press de banca", bestWeightKg: 80, bestReps: 5, date: "2026-11-02" },
    ]);
    expect(s.byMuscleGroup).toEqual([
      { groupKey: "chest", sets: 1.4 },
      { groupKey: "arms", sets: 0.6 },
    ]);
    expect(s.byCategory.map((c) => c.name)).toEqual(["Fuerza", "Running"]);
  });

  it("no trunca: 200 actividades con series, en menos de 500 ms", async () => {
    const { user, gym, bench } = await setup();
    const start = "2026-11-04";
    await prisma.activity.createMany({
      data: Array.from({ length: 200 }, (_, i) => ({
        id: `act${String(i).padStart(4, "0")}`,
        userId: user.id,
        activityCategoryId: gym.id,
        startedAt: zonedToUtc(addDays(start, -i), "18:00", DEFAULT_TZ),
        durationMinutes: 45,
      })),
    });
    await prisma.activityExercise.createMany({
      data: Array.from({ length: 200 }, (_, i) => ({ id: `ae${i}`, activityId: `act${String(i).padStart(4, "0")}`, exerciseId: bench.id, position: 0 })),
    });
    await prisma.activitySet.createMany({
      data: Array.from({ length: 200 }, (_, i) => [0, 1, 2, 3, 4].map((p) => ({ activityExerciseId: `ae${i}`, position: p, reps: 10, weightKg: 50 }))).flat(),
    });

    const t0 = performance.now();
    const s = await getUserStats(user.id, { now: NOW });
    const elapsed = performance.now() - t0;

    expect(s.totals.workouts).toBe(200);
    expect(s.totals.sets).toBe(1000);
    expect(s.activeWeeksStreak).toBe(30); // 200 días seguidos hasta el miércoles: 3 + 28×7 + 1 → 30 semanas
    expect(elapsed).toBeLessThan(500);
  });

  it("usuario sin actividades", async () => {
    const { user } = await setup();
    const s = await getUserStats(user.id, { now: NOW });
    expect(s.totals.workouts).toBe(0);
    expect(s.personalRecords).toEqual([]);
    expect(s.byMuscleGroup).toEqual([]);
    expect(s.weekly).toHaveLength(12);
  });
});
