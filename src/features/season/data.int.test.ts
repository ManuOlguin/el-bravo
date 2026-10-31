import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetDb, prisma } from "@/tests/setup/db";
import { localDateToDbDate, zonedToUtc } from "@/src/lib/time";

vi.mock("server-only", () => ({}));

import { finalizeSeason, recomputeSeason } from "@/src/server/scoring/recompute";
import { getSeasonPageData } from "./data";

const TZ = "America/Argentina/Buenos_Aires";
// Temporada de 2 semanas: lun 2/11 → dom 15/11. "Ahora" = miércoles 11/11 (activa) o 20/11 (terminada).
const START = "2026-11-02";
const END = "2026-11-15";
const DURING = new Date("2026-11-11T15:00:00Z");
const AFTER = new Date("2026-11-20T15:00:00Z");

async function setup(o: { reveal?: "auto" | "manual" } = {}) {
  const admin = await prisma.user.create({ data: { email: "admin@secret.com", passwordHash: "x", name: "Admin" } });
  const ana = await prisma.user.create({ data: { email: "ana@secret.com", passwordHash: "x", name: "Ana" } });
  const gym = await prisma.activityCategory.create({ data: { slug: "gym", name: "Gym", sortOrder: 1 } });
  const run = await prisma.activityCategory.create({ data: { slug: "run", name: "Running", sortOrder: 2 } });
  const yoga = await prisma.activityCategory.create({ data: { slug: "yoga", name: "Yoga", sortOrder: 3 } });
  const group = await prisma.group.create({
    data: { name: "G", timezone: TZ, inviteCode: "ZXCV2345", members: { create: [{ userId: admin.id, role: "admin" }, { userId: ana.id, role: "member" }] } },
  });
  const season = await prisma.season.create({
    data: {
      groupId: group.id,
      name: "Noviembre",
      startDate: localDateToDbDate(START),
      endDate: localDateToDbDate(END),
      weeklyGoal: 2,
      resultsReveal: o.reveal ?? "auto",
      categories: { create: [{ activityCategoryId: gym.id, weight: 1 }, { activityCategoryId: run.id, weight: 2 }] },
      awards: { create: [{ awardType: "most_days", bonusPoints: 10 }, { awardType: "longest_session", bonusPoints: 0 }] },
      members: { create: [{ userId: admin.id }, { userId: ana.id }] },
    },
  });
  const act = (userId: string, catId: string, date: string, minutes: number, time = "18:00") =>
    prisma.activity.create({ data: { userId, activityCategoryId: catId, startedAt: zonedToUtc(date, time, TZ), durationMinutes: minutes } });
  // Ana: semana 1 → lun gym 45 + lun run 30 (mismo día), mié gym 60; semana 2 → lun gym 45, mié run 30, vie gym 90.
  await act(ana.id, gym.id, "2026-11-02", 45, "08:00");
  await act(ana.id, run.id, "2026-11-02", 30, "19:00");
  await act(ana.id, gym.id, "2026-11-04", 60);
  await act(ana.id, gym.id, "2026-11-09", 45);
  await act(ana.id, run.id, "2026-11-11", 30);
  await act(ana.id, gym.id, "2026-11-13", 90);
  // Admin: semana 1 → mié gym 30; yoga no cuenta; semana 2 → mié gym 10 (no llega al mínimo).
  await act(admin.id, gym.id, "2026-11-04", 30, "07:00");
  await act(admin.id, yoga.id, "2026-11-05", 60);
  await act(admin.id, gym.id, "2026-11-11", 10, "07:00");
  return { admin, ana, gym, run, group, season };
}

const viewer = (u: { id: string }) => ({ id: u.id, timezone: TZ });

beforeEach(async () => {
  await resetDb();
});

describe("getSeasonPageData", () => {
  it("activa: ranking en vivo, grilla de semanas y sin datos sensibles", async () => {
    const { admin, ana, group, season } = await setup();
    await recomputeSeason(season.id, { now: DURING });
    const d = (await getSeasonPageData(group.id, season.id, viewer(ana), { now: DURING }))!;
    expect(d.season.status).toBe("active");
    expect(d.canSeeStandings).toBe(true);
    expect(d.standings.map((s) => s.userId)).toEqual([ana.id, admin.id]);
    expect(d.weeks.weekKeys).toEqual(["2026-11-02", "2026-11-09"]);
    // Ana cumplió las 2 semanas (la 2 ya tiene 3 días cargados); el admin no cumplió la 1 y la 2 está en curso.
    expect(d.weeks.byUser[ana.id].map((w) => [w.state, w.days])).toEqual([["met", 2], ["met", 3]]);
    expect(d.weeks.byUser[admin.id].map((w) => [w.state, w.days])).toEqual([["missed", 1], ["current", 0]]);
    expect(d.awards.every((a) => a.winners.length === 0)).toBe(true); // premios: recién al finalizar
    const json = JSON.stringify(d);
    expect(json).not.toContain("@secret.com");
    expect(json).not.toContain("ZXCV2345");
  });

  it("finalizada y publicada: premios con ganadores, stats del grupo y tus números", async () => {
    const { admin, ana, group, season } = await setup();
    await finalizeSeason(season.id, { publish: true, now: AFTER });
    const d = (await getSeasonPageData(group.id, season.id, viewer(admin), { now: AFTER }))!;
    expect(d.season.status).toBe("finalized");
    expect(d.season.resultsPublished).toBe(true);
    expect(d.canSeeResults).toBe(true);

    const mostDays = d.awards.find((a) => a.awardType === "most_days")!;
    expect(mostDays.bonusPoints).toBe(10);
    expect(mostDays.winners.map((w) => [w.userId, w.value])).toEqual([[ana.id, 5]]);
    const longest = d.awards.find((a) => a.awardType === "longest_session")!;
    expect(longest.winners.map((w) => [w.userId, w.value])).toEqual([[ana.id, 90]]);

    // Días que suman: Ana 5 (lun, mié, lun, mié, vie), admin 1 (mié 4/11). Yoga y el día de 10 min no cuentan.
    expect(d.stats).toEqual({
      participants: 2,
      daysTrained: 6,
      activities: 7, // Ana 6 + admin 1
      minutes: 45 + 30 + 60 + 45 + 30 + 90 + 30,
      topCategory: { name: "Gym", count: 5 },
      topWeekday: { index: 2, days: 3 }, // miércoles: Ana 4/11 y 11/11 + admin 4/11
      bestWeek: { weekKey: "2026-11-02", days: 3 },
    });
    const anaRow = d.standings.find((s) => s.userId === ana.id)!;
    const adminRow = d.standings.find((s) => s.userId === admin.id)!;
    expect(d.me).toEqual({
      rank: adminRow.rank,
      points: adminRow.points,
      bestStreak: adminRow.bestStreak,
      daysTrained: 1,
      averagePoints: Math.round((anaRow.points + adminRow.points) / 2),
    });
  });

  it("manual terminada sin publicar: el miembro no ve resultados; el admin ve la vista previa", async () => {
    const { admin, ana, group, season } = await setup({ reveal: "manual" });
    await recomputeSeason(season.id, { now: AFTER });
    const asAna = (await getSeasonPageData(group.id, season.id, viewer(ana), { now: AFTER }))!;
    expect(asAna.season.status).toBe("ended");
    expect(asAna.canSeeStandings).toBe(false);
    expect(asAna.canSeeResults).toBe(false);
    expect(asAna.standings).toEqual([]);
    expect(asAna.stats).toBeNull();
    expect(asAna.me).toBeNull();
    expect(asAna.group.admins.map((a) => a.name)).toEqual(["Admin"]);

    const asAdmin = (await getSeasonPageData(group.id, season.id, viewer(admin), { now: AFTER }))!;
    expect(asAdmin.canSeeStandings).toBe(true);
    expect(asAdmin.standings.length).toBe(2);
    expect(asAdmin.stats?.participants).toBe(2);
    // No se finalizó sola (manual).
    expect((await prisma.season.findUniqueOrThrow({ where: { id: season.id } })).finalizedAt).toBeNull();
  });

  it("auto terminada: se finaliza al abrir la página", async () => {
    const { ana, group, season } = await setup();
    await recomputeSeason(season.id, { now: AFTER });
    const d = (await getSeasonPageData(group.id, season.id, viewer(ana), { now: AFTER }))!;
    expect(d.season.status).toBe("finalized");
    expect(d.canSeeResults).toBe(true);
    expect(d.awards.find((a) => a.awardType === "most_days")!.winners.length).toBe(1);
  });

  it("devuelve null si la temporada no es del grupo y lanza si no sos miembro", async () => {
    const { ana, group, season } = await setup();
    const other = await prisma.group.create({ data: { name: "Otro", members: { create: [{ userId: ana.id, role: "admin" }] } } });
    expect(await getSeasonPageData(other.id, season.id, viewer(ana), { now: DURING })).toBeNull();
    const outsider = await prisma.user.create({ data: { email: "o@x.com", passwordHash: "x" } });
    await expect(getSeasonPageData(group.id, season.id, viewer(outsider), { now: DURING })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
