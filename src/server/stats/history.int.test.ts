import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetDb, prisma } from "@/tests/setup/db";

vi.mock("server-only", () => ({}));

import { getWorkoutHistory } from "./history";

describe("getWorkoutHistory", () => {
  beforeEach(resetDb);

  it("pagina con cursor y trae series, volumen, foto y puntos por temporada", async () => {
    const u = await prisma.user.create({ data: { email: "u@u.com", passwordHash: "x" } });
    const other = await prisma.user.create({ data: { email: "o@o.com", passwordHash: "x" } });
    const cat = await prisma.activityCategory.create({ data: { slug: "strength", name: "Fuerza" } });
    const ex = await prisma.exercise.create({ data: { slug: "bench", name: "Banca" } });
    const group = await prisma.group.create({ data: { name: "G" } });
    const season = await prisma.season.create({
      data: { groupId: group.id, name: "Temporada Verano", startDate: new Date("2026-10-01"), endDate: new Date("2026-12-31") },
    });

    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const a = await prisma.activity.create({
        data: { userId: u.id, activityCategoryId: cat.id, startedAt: new Date(Date.UTC(2026, 9, 10 + i, 21)), durationMinutes: 30 + i },
      });
      ids.push(a.id);
    }
    await prisma.activity.create({ data: { userId: other.id, activityCategoryId: cat.id, startedAt: new Date(), durationMinutes: 10 } });
    const newest = ids[4];
    await prisma.activityExercise.create({
      data: {
        activityId: newest,
        exerciseId: ex.id,
        position: 0,
        sets: { create: [{ position: 0, reps: 10, weightKg: 50 }, { position: 1, reps: 8, weightKg: 60 }, { position: 2, reps: 8, weightKg: 60, completed: false }] },
      },
    });
    await prisma.activityMedia.create({ data: { activityId: newest, url: "https://img/full.webp", thumbUrl: "https://img/t.webp" } });
    await prisma.scoreEntry.create({ data: { seasonId: season.id, userId: u.id, activityId: newest, kind: "workout", points: 26 } });

    const p1 = await getWorkoutHistory(u.id, { limit: 2 });
    expect(p1.items.map((i) => i.id)).toEqual([ids[4], ids[3]]);
    expect(p1.items[0]).toMatchObject({
      categoryName: "Fuerza",
      durationMinutes: 34,
      sets: 2,
      volumeKg: 980,
      thumbUrl: "https://img/t.webp",
      points: [{ seasonId: season.id, seasonName: "Temporada Verano", points: 26 }],
    });
    expect(p1.items[1].points).toEqual([]);

    const p2 = await getWorkoutHistory(u.id, { limit: 2, cursor: p1.nextCursor });
    const p3 = await getWorkoutHistory(u.id, { limit: 2, cursor: p2.nextCursor });
    expect([...p2.items, ...p3.items].map((i) => i.id)).toEqual([ids[2], ids[1], ids[0]]);
    expect(p3.nextCursor).toBeNull();
  });
});
