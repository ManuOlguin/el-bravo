import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { resetDb, prisma } from "@/tests/setup/db";
import { localDateToDbDate } from "@/src/lib/time";

vi.mock("server-only", () => ({}));

import { createActivity, updateActivity } from "@/src/server/activities/service";
import { notify } from "./notify";
import { emitDueSeasonStarts, emitRecentlyPublishedSeasons, emitSeasonPublished } from "./emit";

const TZ = "America/Argentina/Buenos_Aires";
// Miércoles 4/11/2026 15:00 en Buenos Aires. La semana arranca el lunes 2/11.
const NOW = new Date("2026-11-04T18:00:00Z");

let catId: string;
async function user(name: string) {
  return prisma.user.create({ data: { email: `${name.toLowerCase()}@t.com`, passwordHash: "x", name, timezone: TZ } });
}
async function groupWith(name: string, userIds: string[]) {
  return prisma.group.create({
    data: {
      name,
      timezone: TZ,
      members: { create: userIds.map((userId, i) => ({ userId, role: i === 0 ? ("admin" as const) : ("member" as const) })) },
    },
  });
}
function train(userId: string, localDate: string, localTime = "18:00", durationMinutes = 45) {
  return createActivity(userId, { clientRequestId: randomUUID(), activityCategoryId: catId, localDate, localTime, durationMinutes, exercises: [] });
}
const notifs = (where: Record<string, unknown> = {}) =>
  prisma.notification.findMany({ where, orderBy: { createdAt: "asc" }, select: { recipientId: true, type: true, actorId: true, groupId: true, dedupeKey: true } });

describe("emitActivityNotifications (integración)", () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    await resetDb();
    catId = (await prisma.activityCategory.create({ data: { slug: "gym", name: "Gimnasio" } })).id;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("el primero en entrenar el lunes notifica al otro miembro; un segundo entrenamiento no vuelve a notificar", async () => {
    const manu = await user("Manu");
    const lucio = await user("Lucio");
    const g = await groupWith("Los Bravos", [manu.id, lucio.id]);

    await train(manu.id, "2026-11-02");
    let rows = await notifs({ type: "first_workout_of_week" });
    expect(rows).toEqual([
      { recipientId: lucio.id, type: "first_workout_of_week", actorId: manu.id, groupId: g.id, dedupeKey: `first_week:${g.id}:2026-11-02:${lucio.id}` },
    ]);

    await train(manu.id, "2026-11-03"); // segundo día del actor
    await train(lucio.id, "2026-11-03"); // Lucio no es el primero
    rows = await notifs({ type: "first_workout_of_week" });
    expect(rows).toHaveLength(1);
  });

  it("editar una actividad no notifica", async () => {
    const manu = await user("Manu");
    const lucio = await user("Lucio");
    await groupWith("Los Bravos", [manu.id, lucio.id]);
    const { activityId } = await train(manu.id, "2026-11-02");
    await prisma.notification.deleteMany();
    await updateActivity(manu.id, activityId, {
      clientRequestId: randomUUID(),
      activityCategoryId: catId,
      localDate: "2026-11-02",
      localTime: "19:00",
      durationMinutes: 60,
      exercises: [],
    });
    expect(await prisma.notification.count()).toBe(0);
  });

  it("objetivo semanal cumplido (objetivo del usuario sin temporada)", async () => {
    const manu = await prisma.user.create({ data: { email: "m@t.com", passwordHash: "x", name: "Manu", timezone: TZ, weeklyGoal: 2 } });
    const lucio = await user("Lucio");
    const g = await groupWith("Los Bravos", [manu.id, lucio.id]);
    await train(manu.id, "2026-11-02");
    await train(manu.id, "2026-11-03");
    await train(manu.id, "2026-11-04");
    const rows = await notifs({ type: "weekly_goal_met" });
    expect(rows.map((r) => r.dedupeKey)).toEqual([`goal:${g.id}:2026-11-02:${manu.id}:${lucio.id}`]);
  });

  it("te pasaron en el ranking y racha (con temporada)", async () => {
    const manu = await user("Manu");
    const lucio = await user("Lucio");
    const g = await groupWith("Los Bravos", [manu.id, lucio.id]);
    const s = await prisma.season.create({
      data: {
        groupId: g.id,
        name: "Temporada Verano",
        startDate: localDateToDbDate("2026-11-02"),
        endDate: localDateToDbDate("2026-11-29"),
        weeklyGoal: 2,
        members: { create: [{ userId: manu.id }, { userId: lucio.id }] },
        categories: { create: [{ activityCategoryId: catId, weight: 1 }] },
      },
    });
    await train(lucio.id, "2026-11-02");
    await train(manu.id, "2026-11-03", "18:00", 30);
    await train(manu.id, "2026-11-04", "18:00", 30); // Manu: 2 días + objetivo → pasa a Lucio
    const over = await notifs({ type: "rank_overtaken" });
    expect(over).toHaveLength(1);
    expect(over[0]).toMatchObject({ recipientId: lucio.id, actorId: manu.id });
    expect(over[0].dedupeKey).toBe(`overtaken:${s.id}:${manu.id}:${lucio.id}:2026-11-02`);
  });

  it("dedupe: la misma clave no duplica", async () => {
    const manu = await user("Manu");
    const input = { recipientIds: [manu.id], type: "new_follower" as const, actorId: manu.id, dedupeKey: (r: string) => `test:${r}` };
    await notify(input);
    await notify(input);
    expect(await prisma.notification.count()).toBe(1);
  });

  it("claves de más de 191 caracteres se acortan de forma estable", async () => {
    const manu = await user("Manu");
    const long = "x".repeat(300);
    await notify({ recipientIds: [manu.id], type: "new_follower", dedupeKey: () => long });
    await notify({ recipientIds: [manu.id], type: "new_follower", dedupeKey: () => long });
    const rows = await prisma.notification.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].dedupeKey.length).toBeLessThanOrEqual(191);
  });

  it("inApp=false no crea la notificación", async () => {
    const manu = await user("Manu");
    const lucio = await user("Lucio");
    await groupWith("Los Bravos", [manu.id, lucio.id]);
    await prisma.notificationPreference.create({ data: { userId: lucio.id, type: "first_workout_of_week", inApp: false } });
    await train(manu.id, "2026-11-02");
    expect(await prisma.notification.count({ where: { type: "first_workout_of_week" } })).toBe(0);
  });

  it("un miembro que se fue del grupo no recibe", async () => {
    const manu = await user("Manu");
    const lucio = await user("Lucio");
    const g = await groupWith("Los Bravos", [manu.id, lucio.id]);
    await prisma.groupMember.update({ where: { groupId_userId: { groupId: g.id, userId: lucio.id } }, data: { leftAt: new Date() } });
    await train(manu.id, "2026-11-02");
    expect(await prisma.notification.count()).toBe(0);
  });
});

describe("temporadas (integración)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("resultados publicados: notifica al grupo una sola vez; sin publicar no hace nada", async () => {
    const manu = await user("Manu");
    const lucio = await user("Lucio");
    const g = await groupWith("Los Bravos", [manu.id, lucio.id]);
    const s = await prisma.season.create({
      data: { groupId: g.id, name: "Verano", startDate: localDateToDbDate("2026-10-01"), endDate: localDateToDbDate("2026-10-31") },
    });
    await emitSeasonPublished(s.id);
    expect(await prisma.notification.count()).toBe(0);
    await prisma.season.update({ where: { id: s.id }, data: { finalizedAt: NOW, resultsPublishedAt: NOW } });
    await emitRecentlyPublishedSeasons(new Date(NOW.getTime() + 3600_000));
    await emitSeasonPublished(s.id);
    const rows = await notifs({ type: "season_results_published" });
    expect(rows.map((r) => r.recipientId).sort()).toEqual([manu.id, lucio.id].sort());
  });

  it("temporadas que empiezan hoy en la zona del grupo", async () => {
    const manu = await user("Manu");
    const g = await groupWith("Los Bravos", [manu.id]);
    const today = await prisma.season.create({
      data: { groupId: g.id, name: "Hoy", startDate: localDateToDbDate("2026-11-04"), endDate: localDateToDbDate("2026-11-30") },
    });
    await prisma.season.create({
      data: { groupId: g.id, name: "Mañana", startDate: localDateToDbDate("2026-11-05"), endDate: localDateToDbDate("2026-11-30") },
    });
    expect(await emitDueSeasonStarts(NOW)).toEqual([today.id]);
    await emitDueSeasonStarts(NOW);
    expect(await notifs({ type: "season_started" })).toHaveLength(1);
  });
});
