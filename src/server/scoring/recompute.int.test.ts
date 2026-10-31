import { describe, it, expect, beforeEach } from "vitest";
import { resetDb, prisma } from "@/tests/setup/db";
import { localDateToDbDate, zonedToUtc } from "@/src/lib/time";
import { recomputeSeason, recomputeSeasonsForChange, finalizeSeason, publishSeasonResults } from "./recompute";
import { getSeasonStandings, getActivityPoints } from "./queries";

const TZ = "America/Argentina/Buenos_Aires";
// Temporada en el pasado (3 semanas completas): el resultado no depende de la fecha real en la que corre el test.
const W1 = "2026-09-07";
const W2 = "2026-09-14";
const W3 = "2026-09-21";
const END = "2026-09-27";
const plus = (d: string, n: number) => {
  const t = new Date(`${d}T12:00:00Z`);
  return new Date(t.getTime() + n * 86_400_000).toISOString().slice(0, 10);
};

let seq = 0;
async function setup() {
  const u1 = await prisma.user.create({ data: { email: "u1@x.com", passwordHash: "x", name: "Uno" } });
  const u2 = await prisma.user.create({ data: { email: "u2@x.com", passwordHash: "x", name: "Dos" } });
  const gym = await prisma.activityCategory.create({ data: { slug: "gym", name: "Gym" } });
  const run = await prisma.activityCategory.create({ data: { slug: "run", name: "Running" } });
  const group = await prisma.group.create({ data: { name: "G1", timezone: TZ } });
  return { u1, u2, gym, run, group };
}

async function makeSeason(groupId: string, members: string[], cats: { id: string; weight: number }[], o: { start?: string; end?: string; resultsReveal?: "auto" | "manual"; awards?: { awardType: string; bonusPoints: number }[] } = {}) {
  return prisma.season.create({
    data: {
      groupId,
      name: `S${++seq}`,
      startDate: localDateToDbDate(o.start ?? W1),
      endDate: localDateToDbDate(o.end ?? END),
      resultsReveal: o.resultsReveal ?? "auto",
      members: { create: members.map((userId) => ({ userId })) },
      categories: { create: cats.map((c) => ({ activityCategoryId: c.id, weight: c.weight })) },
      awards: { create: o.awards ?? [] },
    },
  });
}

async function act(userId: string, catId: string, date: string, time = "18:00", minutes = 45) {
  return prisma.activity.create({ data: { userId, activityCategoryId: catId, startedAt: zonedToUtc(date, time, TZ), durationMinutes: minutes } });
}
const days = (userId: string, catId: string, monday: string, k = 3) => Promise.all(Array.from({ length: k }, (_, i) => act(userId, catId, plus(monday, i))));
const snap = (a: { id: string; userId: string; activityCategoryId: string; startedAt: Date; durationMinutes: number }) => ({
  id: a.id, userId: a.userId, activityCategoryId: a.activityCategoryId, startedAt: a.startedAt, durationMinutes: a.durationMinutes,
});
const standing = async (seasonId: string, userId: string) => (await getSeasonStandings(seasonId)).find((s) => s.userId === userId);

describe("recomputeSeason", () => {
  beforeEach(resetDb);

  it("escribe ScoreEntry por línea y SeasonStanding con rank", async () => {
    const { u1, u2, gym, group } = await setup();
    const s = await makeSeason(group.id, [u1.id, u2.id], [{ id: gym.id, weight: 1 }]);
    await days(u1.id, gym.id, W1);
    await act(u2.id, gym.id, W1);
    await recomputeSeason(s.id);

    expect(await prisma.scoreEntry.count({ where: { seasonId: s.id } })).toBe(5); // 3 workout + 1 weekly_goal + 1 workout
    const st = await getSeasonStandings(s.id);
    expect(st.map((r) => [r.name, r.rank, r.points, r.daysTrained, r.weeksGoalMet])).toEqual([["Uno", 1, 89, 3, 1], ["Dos", 2, 23, 1, 0]]);
    expect((await prisma.season.findUniqueOrThrow({ where: { id: s.id } })).lastComputedAt).not.toBeNull();
  });

  it("es idempotente: dos veces dejan lo mismo", async () => {
    const { u1, u2, gym, group } = await setup();
    const s = await makeSeason(group.id, [u1.id, u2.id], [{ id: gym.id, weight: 1 }]);
    await days(u1.id, gym.id, W1);
    await recomputeSeason(s.id);
    const first = await getSeasonStandings(s.id);
    await recomputeSeason(s.id);
    expect(await getSeasonStandings(s.id)).toEqual(first);
    expect(await prisma.scoreEntry.count({ where: { seasonId: s.id } })).toBe(4);
    expect(await prisma.seasonStanding.count({ where: { seasonId: s.id } })).toBe(2);
  });

  it("borrar reprocesa todo: baja el total y se corta la racha", async () => {
    const { u1, gym, group } = await setup();
    const s = await makeSeason(group.id, [u1.id], [{ id: gym.id, weight: 1 }]);
    await days(u1.id, gym.id, W1);
    const w2 = await days(u1.id, gym.id, W2);
    await days(u1.id, gym.id, W3);
    await recomputeSeason(s.id);
    // 9 días + 3 semanas cumplidas + racha (+5, +10) + racha activa (+2, +4).
    expect((await standing(s.id, u1.id))!.points).toBe(9 * 23 + 60 + 5 + 10 + 2 + 4);
    expect((await prisma.scoreEntry.findFirst({ where: { seasonId: s.id, kind: "streak", weekKey: W3 } }))!.points).toBe(10);

    await prisma.activity.delete({ where: { id: w2[1].id } });
    await recomputeSeason(s.id);
    // La semana 2 queda con 2 días: corta la racha cumplida pero no la activa (+2, +4 siguen).
    expect((await standing(s.id, u1.id))!).toMatchObject({ points: 8 * 23 + 40 + 2 + 4, weeksGoalMet: 2, bestStreak: 1, currentStreak: 1 });
    expect(await prisma.scoreEntry.count({ where: { seasonId: s.id, kind: "streak" } })).toBe(0);
    expect(await prisma.scoreEntry.count({ where: { seasonId: s.id, kind: "active_streak" } })).toBe(2);
  });

  it("editar la temporada recalcula (objetivo y peso de categoría)", async () => {
    const { u1, gym, run, group } = await setup();
    const s = await makeSeason(group.id, [u1.id], [{ id: gym.id, weight: 1 }, { id: run.id, weight: 1 }]);
    await days(u1.id, gym.id, W1, 2);
    const r = await act(u1.id, run.id, W2);
    await recomputeSeason(s.id);
    // 2 semanas activas seguidas: +2 de racha activa.
    expect((await standing(s.id, u1.id))!.points).toBe(3 * 23 + 2);

    await prisma.season.update({ where: { id: s.id }, data: { weeklyGoal: 2 } });
    await recomputeSeason(s.id);
    expect((await standing(s.id, u1.id))!.points).toBe(3 * 23 + 20 + 2);

    await prisma.seasonCategory.update({ where: { seasonId_activityCategoryId: { seasonId: s.id, activityCategoryId: run.id } }, data: { weight: 0 } });
    await recomputeSeason(s.id);
    // Running deja de contar: la semana 2 queda sin días y se pierde la racha activa.
    expect((await standing(s.id, u1.id))!.points).toBe(2 * 23 + 20);
    expect((await getActivityPoints([r.id])).get(r.id)).toEqual([{ seasonId: s.id, points: 0, reason: "Esta actividad no cuenta en la temporada" }]);
  });

  it("un miembro que sale deja de figurar", async () => {
    const { u1, u2, gym, group } = await setup();
    const s = await makeSeason(group.id, [u1.id, u2.id], [{ id: gym.id, weight: 1 }]);
    await act(u2.id, gym.id, W1);
    await recomputeSeason(s.id);
    await prisma.seasonMember.update({ where: { seasonId_userId: { seasonId: s.id, userId: u2.id } }, data: { leftAt: new Date() } });
    await recomputeSeason(s.id);
    expect((await getSeasonStandings(s.id)).map((r) => r.userId)).toEqual([u1.id]);
    expect(await prisma.scoreEntry.count({ where: { userId: u2.id } })).toBe(0);
  });
});

describe("recomputeSeasonsForChange", () => {
  beforeEach(resetDb);

  it("recalcula las temporadas de todos los grupos que cubren el día y devuelve efectos", async () => {
    const { u1, u2, gym, group } = await setup();
    const g2 = await prisma.group.create({ data: { name: "G2", timezone: TZ } });
    const s1 = await makeSeason(group.id, [u1.id, u2.id], [{ id: gym.id, weight: 1 }]);
    const s2 = await makeSeason(g2.id, [u1.id], [{ id: gym.id, weight: 1 }]);
    await act(u2.id, gym.id, W1, "07:00", 60);
    await recomputeSeason(s1.id);

    const a = await act(u1.id, gym.id, W1);
    const effects = await recomputeSeasonsForChange({ userId: u1.id, before: null, after: snap(a) });
    expect(effects.sort((x, y) => x.groupName.localeCompare(y.groupName))).toEqual([
      { seasonId: s1.id, seasonName: s1.name, groupId: group.id, groupName: "G1", activityPoints: 23, activityReason: null, totalBefore: 0, totalAfter: 23, rankBefore: 2, rankAfter: 2 },
      { seasonId: s2.id, seasonName: s2.name, groupId: g2.id, groupName: "G2", activityPoints: 23, activityReason: null, totalBefore: 0, totalAfter: 23, rankBefore: null, rankAfter: 1 },
    ]);
  });

  it("mover la fecha de una temporada a otra recalcula ambas", async () => {
    const { u1, gym, group } = await setup();
    const t1 = await makeSeason(group.id, [u1.id], [{ id: gym.id, weight: 1 }]);
    const t2 = await makeSeason(group.id, [u1.id], [{ id: gym.id, weight: 1 }], { start: "2026-10-05", end: "2026-10-25" });
    const a = await act(u1.id, gym.id, W1);
    await recomputeSeasonsForChange({ userId: u1.id, before: null, after: snap(a) });
    expect((await standing(t1.id, u1.id))!.points).toBe(23);

    const moved = await prisma.activity.update({ where: { id: a.id }, data: { startedAt: zonedToUtc("2026-10-06", "18:00", TZ) } });
    const effects = await recomputeSeasonsForChange({ userId: u1.id, before: snap(a), after: snap(moved) });
    expect(effects.map((e) => e.seasonId).sort()).toEqual([t1.id, t2.id].sort());
    expect((await standing(t1.id, u1.id))!.points).toBe(0);
    expect((await standing(t2.id, u1.id))!.points).toBe(23);
  });

  it("borrar (after null) recalcula con activityPoints 0", async () => {
    const { u1, gym, group } = await setup();
    const s = await makeSeason(group.id, [u1.id], [{ id: gym.id, weight: 1 }]);
    const a = await act(u1.id, gym.id, W1);
    await recomputeSeason(s.id);
    await prisma.activity.delete({ where: { id: a.id } });
    const [e] = await recomputeSeasonsForChange({ userId: u1.id, before: snap(a), after: null });
    expect(e).toMatchObject({ activityPoints: 0, totalBefore: 23, totalAfter: 0 });
  });

  it("ignora temporadas fuera de rango, finalizadas o de las que salió", async () => {
    const { u1, gym, group } = await setup();
    const g2 = await prisma.group.create({ data: { name: "G2", timezone: TZ } });
    const g3 = await prisma.group.create({ data: { name: "G3", timezone: TZ } });
    await makeSeason(group.id, [u1.id], [{ id: gym.id, weight: 1 }], { start: "2026-10-05", end: "2026-10-25" });
    const fin = await makeSeason(g2.id, [u1.id], [{ id: gym.id, weight: 1 }]);
    await prisma.season.update({ where: { id: fin.id }, data: { finalizedAt: new Date() } });
    const left = await makeSeason(g3.id, [u1.id], [{ id: gym.id, weight: 1 }]);
    await prisma.seasonMember.update({ where: { seasonId_userId: { seasonId: left.id, userId: u1.id } }, data: { leftAt: new Date() } });
    const a = await act(u1.id, gym.id, W1);
    expect(await recomputeSeasonsForChange({ userId: u1.id, before: null, after: snap(a) })).toEqual([]);
  });
});

describe("finalizeSeason / publishSeasonResults", () => {
  beforeEach(resetDb);

  it("finalizar en paralelo crea los ganadores una sola vez; premios con bonus suman", async () => {
    const { u1, u2, gym, group } = await setup();
    const s = await makeSeason(group.id, [u1.id, u2.id], [{ id: gym.id, weight: 1 }], {
      awards: [{ awardType: "most_days", bonusPoints: 10 }, { awardType: "best_streak", bonusPoints: 0 }],
    });
    await days(u1.id, gym.id, W1);
    await act(u2.id, gym.id, W1);
    await Promise.all([finalizeSeason(s.id, { publish: true }), finalizeSeason(s.id, { publish: true })]);

    const season = await prisma.season.findUniqueOrThrow({ where: { id: s.id } });
    expect(season.finalizedAt).not.toBeNull();
    expect(season.resultsPublishedAt).not.toBeNull();
    const winners = await prisma.seasonAwardWinner.findMany({ include: { seasonAward: true } });
    expect(winners.map((w) => [w.seasonAward.awardType, w.userId, w.value]).sort()).toEqual([["best_streak", u1.id, 1], ["most_days", u1.id, 3]].sort());
    const awardEntries = await prisma.scoreEntry.findMany({ where: { seasonId: s.id, kind: "award" } });
    expect(awardEntries.map((e) => [e.userId, e.points])).toEqual([[u1.id, 10]]);
    expect((await standing(s.id, u1.id))!.points).toBe(89 + 10);
  });

  it("premios divertidos: series por músculo, fotos y reacciones desde la DB; los de la vergüenza no suman", async () => {
    const { u1, u2, gym, group } = await setup();
    const legs = await prisma.muscle.create({ data: { name: "Cuádriceps", slug: "cuadriceps", groupKey: "legs" } });
    const glutes = await prisma.muscle.create({ data: { name: "Glúteos", slug: "gluteos", groupKey: "legs" } });
    const chest = await prisma.muscle.create({ data: { name: "Pectoral", slug: "pectoral", groupKey: "chest" } });
    const squat = await prisma.exercise.create({
      data: { slug: "sentadilla", name: "Sentadilla", muscles: { create: [{ muscleId: legs.id, percentage: 70 }, { muscleId: glutes.id, percentage: 30 }] } },
    });
    const bench = await prisma.exercise.create({ data: { slug: "banca", name: "Banca", muscles: { create: [{ muscleId: chest.id, percentage: 100 }] } } });
    const s = await makeSeason(group.id, [u1.id, u2.id], [{ id: gym.id, weight: 1 }], {
      awards: [
        { awardType: "legs", bonusPoints: 5 },
        { awardType: "volume", bonusPoints: 0 },
        { awardType: "influencer", bonusPoints: 0 },
        { awardType: "popular", bonusPoints: 0 },
        { awardType: "ghost", bonusPoints: 50 },
      ],
    });
    const a1 = await act(u1.id, gym.id, W1);
    const a2 = await act(u2.id, gym.id, W1);
    await act(u2.id, gym.id, plus(W1, 1));
    const setsOf = (n: number, kg: number, completed = true) => Array.from({ length: n }, (_, i) => ({ position: i, reps: 10, weightKg: kg, completed }));
    // u1: 4 series de sentadilla (todas piernas) + 1 sin completar; u2: 3 de sentadilla y 5 de banca pesada.
    await prisma.activityExercise.create({ data: { activityId: a1.id, exerciseId: squat.id, position: 0, sets: { create: [...setsOf(4, 60), { position: 9, reps: 10, weightKg: 200, completed: false }] } } });
    await prisma.activityExercise.create({ data: { activityId: a2.id, exerciseId: squat.id, position: 0, sets: { create: setsOf(3, 60) } } });
    await prisma.activityExercise.create({ data: { activityId: a2.id, exerciseId: bench.id, position: 1, sets: { create: setsOf(5, 80) } } });
    await prisma.activityMedia.createMany({ data: [{ activityId: a1.id, url: "https://x/1.webp" }, { activityId: a1.id, url: "https://x/2.webp" }] });
    // Reacciones a u2: una de u1 y una propia (no cuenta).
    await prisma.reaction.createMany({ data: [{ activityId: a2.id, userId: u1.id, emoji: "fire" }, { activityId: a2.id, userId: u2.id, emoji: "fire" }] });

    await finalizeSeason(s.id, { publish: true });
    const winners = await prisma.seasonAwardWinner.findMany({ include: { seasonAward: true } });
    const byType = Object.fromEntries(winners.map((w) => [w.seasonAward.awardType, [w.userId, w.value]]));
    expect(byType).toEqual({
      legs: [u1.id, 4],
      volume: [u2.id, 3 * 600 + 5 * 800],
      influencer: [u1.id, 2],
      popular: [u2.id, 1],
      ghost: [u1.id, 1],
    });
    // +5 de El Piernas para u1; El Fantasma no suma aunque tenga 50 cargados.
    const awardEntries = await prisma.scoreEntry.findMany({ where: { seasonId: s.id, kind: "award" } });
    expect(awardEntries.map((e) => [e.userId, e.points])).toEqual([[u1.id, 5]]);
  });

  it("después de finalizar, recomputeSeason no cambia nada salvo con force", async () => {
    const { u1, gym, group } = await setup();
    const s = await makeSeason(group.id, [u1.id], [{ id: gym.id, weight: 1 }], { awards: [{ awardType: "most_days", bonusPoints: 10 }] });
    await act(u1.id, gym.id, W1);
    await finalizeSeason(s.id, { publish: true });
    expect((await standing(s.id, u1.id))!.points).toBe(33);

    await act(u1.id, gym.id, plus(W1, 1));
    await recomputeSeason(s.id);
    expect((await standing(s.id, u1.id))!.points).toBe(33);

    await recomputeSeason(s.id, { force: true });
    expect((await standing(s.id, u1.id))!.points).toBe(23 * 2 + 10); // conserva el premio ya otorgado
  });

  it("resultsReveal manual: finalizar sin publicar y publicar después", async () => {
    const { u1, gym, group } = await setup();
    const s = await makeSeason(group.id, [u1.id], [{ id: gym.id, weight: 1 }], { resultsReveal: "manual" });
    await finalizeSeason(s.id, { publish: false });
    let season = await prisma.season.findUniqueOrThrow({ where: { id: s.id } });
    expect(season.finalizedAt).not.toBeNull();
    expect(season.resultsPublishedAt).toBeNull();
    await publishSeasonResults(s.id);
    season = await prisma.season.findUniqueOrThrow({ where: { id: s.id } });
    expect(season.resultsPublishedAt).not.toBeNull();
  });
});
