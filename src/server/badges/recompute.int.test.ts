import { describe, it, expect, beforeEach } from "vitest";
import { resetDb, prisma } from "@/tests/setup/db";
import { seedBadges } from "@/prisma/seed/badges";
import { zonedToUtc, addDays } from "@/src/lib/time";
import { recomputeUserBadges, getUserBadges } from "./index";

const TZ = "America/Argentina/Buenos_Aires";

async function fixtures() {
  await seedBadges(prisma);
  const user = await prisma.user.create({ data: { email: "a@a.com", passwordHash: "x", name: "A" } });
  const strength = await prisma.activityCategory.create({ data: { slug: "strength", name: "Fuerza", usesExercises: true } });
  const running = await prisma.activityCategory.create({ data: { slug: "running", name: "Running" } });
  return { user, strength, running };
}

let day = 0;
async function workout(userId: string, categoryId: string, durationMinutes = 45) {
  return prisma.activity.create({
    data: {
      userId,
      activityCategoryId: categoryId,
      startedAt: zonedToUtc(addDays("2026-09-01", day++), "18:00", TZ),
      durationMinutes,
    },
  });
}

describe("recomputeUserBadges", () => {
  beforeEach(async () => {
    await resetDb();
    day = 0;
  });

  it("con un entrenamiento de fuerza solo informa las insignias afectadas", async () => {
    const { user, strength } = await fixtures();
    await workout(user.id, strength.id, 45);
    const changes = await recomputeUserBadges(user.id);
    const byCode = Object.fromEntries(changes.map((c) => [c.code, c]));
    expect(Object.keys(byCode).sort()).toEqual(["EL_PERSISTENTE", "GYM_RAT", "MARATONISTA", "TODOTERRENO"]);
    expect(byCode.EL_PERSISTENTE).toMatchObject({ progressBefore: 0, progressAfter: 1, levelBefore: 0, levelAfter: 0, nextThreshold: 10 });
    expect(byCode.GYM_RAT).toMatchObject({ progressBefore: 0, progressAfter: 1 });
    expect(byCode.TODOTERRENO).toMatchObject({ progressBefore: 0, progressAfter: 1 });
    expect(byCode.MARATONISTA).toMatchObject({ progressBefore: 0, progressAfter: 45, nextThreshold: 600 });
    expect(byCode.CORRE_FORREST).toBeUndefined();
  });

  it("al décimo entrenamiento sube El Persistente a nivel 1 y setea achievedAt", async () => {
    const { user, strength } = await fixtures();
    for (let i = 0; i < 9; i++) await workout(user.id, strength.id);
    await recomputeUserBadges(user.id);
    await workout(user.id, strength.id);
    const changes = await recomputeUserBadges(user.id);
    expect(changes.find((c) => c.code === "EL_PERSISTENTE")).toMatchObject({
      levelBefore: 0, levelAfter: 1, progressBefore: 9, progressAfter: 10, nextThreshold: 50,
    });
    const ub = await prisma.userBadge.findFirstOrThrow({ where: { userId: user.id, badge: { code: "EL_PERSISTENTE" } } });
    expect(ub.level).toBe(1);
    expect(ub.achievedAt).toBeInstanceOf(Date);
  });

  it("al borrar una actividad el nivel baja y achievedAt queda en null", async () => {
    const { user, strength } = await fixtures();
    const acts = [];
    for (let i = 0; i < 10; i++) acts.push(await workout(user.id, strength.id));
    await recomputeUserBadges(user.id);
    await prisma.activity.delete({ where: { id: acts[0].id } });
    const changes = await recomputeUserBadges(user.id);
    expect(changes.find((c) => c.code === "EL_PERSISTENTE")).toMatchObject({
      levelBefore: 1, levelAfter: 0, progressBefore: 10, progressAfter: 9, nextThreshold: 10,
    });
    const ub = await prisma.userBadge.findFirstOrThrow({ where: { userId: user.id, badge: { code: "EL_PERSISTENTE" } } });
    expect(ub.level).toBe(0);
    expect(ub.achievedAt).toBeNull();
  });

  it("dos recálculos seguidos: el segundo devuelve []", async () => {
    const { user, strength, running } = await fixtures();
    await workout(user.id, strength.id);
    await workout(user.id, running.id);
    expect((await recomputeUserBadges(user.id)).length).toBeGreaterThan(0);
    expect(await recomputeUserBadges(user.id)).toEqual([]);
  });

  it("cuenta series de core completas, incluidas las de tiempo (plancha)", async () => {
    const { user, strength } = await fixtures();
    const abs = await prisma.muscle.create({ data: { name: "Abdominales", slug: "abdominales", groupKey: "core" } });
    const plank = await prisma.exercise.create({
      data: { slug: "plancha", name: "Plancha", muscles: { create: [{ muscleId: abs.id, percentage: 100 }] } },
    });
    const a = await workout(user.id, strength.id);
    await prisma.activityExercise.create({
      data: {
        activityId: a.id,
        exerciseId: plank.id,
        position: 0,
        sets: {
          create: [
            { position: 0, durationSeconds: 60, completed: true },
            { position: 1, durationSeconds: 60, completed: true },
            { position: 2, durationSeconds: 60, completed: false },
          ],
        },
      },
    });
    const changes = await recomputeUserBadges(user.id);
    expect(changes.find((c) => c.code === "SIX_PACK")).toMatchObject({ progressAfter: 2 });
    expect(changes.find((c) => c.code === "EL_PIERNAS")).toBeUndefined();
  });

  it("usuario inexistente → []", async () => {
    await seedBadges(prisma);
    expect(await recomputeUserBadges("no-existe")).toEqual([]);
  });
});

describe("getUserBadges", () => {
  beforeEach(async () => {
    await resetDb();
    day = 0;
  });

  it("devuelve las 9 insignias (incluso nivel 0) por sortOrder y con maxLevel", async () => {
    const { user, strength } = await fixtures();
    for (let i = 0; i < 10; i++) await workout(user.id, strength.id);
    await recomputeUserBadges(user.id);
    const badges = await getUserBadges(user.id);
    expect(badges.map((b) => b.code)).toEqual([
      "EL_PERSISTENTE", "GYM_RAT", "CORRE_FORREST", "IMPARABLE", "EL_PIERNAS", "SIX_PACK", "TODOTERRENO", "MARATONISTA", "MADRUGADOR",
    ]);
    expect(badges[0]).toMatchObject({ name: "El Persistente", level: 1, maxLevel: 4, progress: 10, nextThreshold: 50, iconKey: "flame" });
    expect(badges[0].achievedAt).toBeInstanceOf(Date);
    expect(badges[2]).toMatchObject({ code: "CORRE_FORREST", level: 0, maxLevel: 3, progress: 0, nextThreshold: 5, achievedAt: null });
  });

  it("sin recálculo previo devuelve todo en 0", async () => {
    const { user } = await fixtures();
    const badges = await getUserBadges(user.id);
    expect(badges).toHaveLength(9);
    expect(badges.every((b) => b.level === 0 && b.progress === 0)).toBe(true);
  });
});
