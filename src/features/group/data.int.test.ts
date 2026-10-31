import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetDb, prisma } from "@/tests/setup/db";
import { addDays, localDateOf, localDateToDbDate, zonedToUtc } from "@/src/lib/time";

vi.mock("server-only", () => ({}));

import { recomputeSeason } from "@/src/server/scoring/recompute";
import { getGroupPageData, getGroupFeed } from "./data";

const TZ = "America/Argentina/Buenos_Aires";
const NOW = new Date("2026-11-04T15:00:00Z"); // miércoles 4/11, 12:00 en Buenos Aires
const today = localDateOf(NOW, TZ);

async function setup(tz = TZ) {
  const admin = await prisma.user.create({ data: { email: "admin@secret.com", passwordHash: "x", name: "Admin" } });
  const member = await prisma.user.create({ data: { email: "member@secret.com", passwordHash: "x", name: "Miembro" } });
  const gym = await prisma.activityCategory.create({ data: { slug: "gym", name: "Gym", sortOrder: 1 } });
  const yoga = await prisma.activityCategory.create({ data: { slug: "yoga", name: "Yoga", sortOrder: 2 } });
  const group = await prisma.group.create({
    data: {
      name: "Los Bravos",
      timezone: tz,
      inviteCode: "ABCD2345",
      inviteCodeExpiresAt: new Date("2027-01-01T00:00:00Z"),
      members: { create: [{ userId: admin.id, role: "admin" }, { userId: member.id, role: "member" }] },
    },
  });
  return { admin, member, gym, yoga, group };
}

type SeasonOpts = { name: string; start: string; end: string; reveal?: "auto" | "manual"; finalized?: boolean; published?: boolean; members: string[]; cat: string };
const season = (groupId: string, o: SeasonOpts) =>
  prisma.season.create({
    data: {
      groupId,
      name: o.name,
      startDate: localDateToDbDate(o.start),
      endDate: localDateToDbDate(o.end),
      resultsReveal: o.reveal ?? "auto",
      finalizedAt: o.finalized ? new Date("2026-10-01T00:00:00Z") : null,
      resultsPublishedAt: o.published ? new Date("2026-10-01T00:00:00Z") : null,
      categories: { create: [{ activityCategoryId: o.cat, weight: 1 }] },
      awards: { create: [{ awardType: "most_days", bonusPoints: 10 }] },
      members: { create: o.members.map((userId) => ({ userId })) },
    },
  });

const viewer = (u: { id: string }) => ({ id: u.id, timezone: TZ });

beforeEach(async () => {
  await resetDb();
});

describe("getGroupPageData", () => {
  it("no expone inviteCode ni emails", async () => {
    const { admin, member, gym, group } = await setup();
    const s = await season(group.id, { name: "Activa", start: addDays(today, -10), end: addDays(today, 10), members: [admin.id, member.id], cat: gym.id });
    await prisma.activity.create({ data: { userId: member.id, activityCategoryId: gym.id, startedAt: zonedToUtc(addDays(today, -1), "18:00", TZ), durationMinutes: 45, notes: "nota privada" } });
    await recomputeSeason(s.id, { now: NOW });

    for (const u of [admin, member]) {
      const data = await getGroupPageData(group.id, viewer(u), { now: NOW });
      const json = JSON.stringify(data);
      expect(json).not.toContain("ABCD2345");
      expect(json).not.toContain("inviteCode");
      expect(json).not.toContain("@secret.com");
      expect(json).not.toContain("email");
      expect(json).not.toContain("nota privada");
      expect(data.standings.length).toBe(2);
      expect(data.feed.items.length).toBe(1);
    }
  });

  it("clasifica las temporadas: actual, próxima y pasadas (publicadas, más recientes primero)", async () => {
    const { admin, member, gym, group } = await setup();
    const ids = [admin.id, member.id];
    await season(group.id, { name: "Vieja", start: addDays(today, -120), end: addDays(today, -100), finalized: true, published: true, members: ids, cat: gym.id });
    await season(group.id, { name: "Anterior", start: addDays(today, -60), end: addDays(today, -40), finalized: true, published: true, members: ids, cat: gym.id });
    await season(group.id, { name: "Activa", start: addDays(today, -10), end: addDays(today, 10), members: [admin.id], cat: gym.id });
    await season(group.id, { name: "Lejana", start: addDays(today, 60), end: addDays(today, 80), members: [], cat: gym.id });
    await season(group.id, { name: "Próxima", start: addDays(today, 20), end: addDays(today, 30), members: [], cat: gym.id });

    const data = await getGroupPageData(group.id, viewer(member), { now: NOW });
    expect(data.current?.name).toBe("Activa");
    expect(data.current?.status).toBe("active");
    expect(data.current?.joined).toBe(false);
    expect(data.current?.memberCount).toBe(1);
    expect(data.current?.categories).toEqual([{ id: gym.id, name: "Gym", weight: 1 }]);
    expect(data.current?.awards).toEqual([{ awardType: "most_days", bonusPoints: 10 }]);
    expect(data.upcoming?.name).toBe("Próxima");
    expect(data.past.map((p) => p.name)).toEqual(["Anterior", "Vieja"]);
    expect(data.viewer).toEqual({ id: member.id, role: "member", timezone: TZ });
  });

  it("una temporada manual terminada sin publicar es la actual; los miembros no ven el ranking y el admin sí", async () => {
    const { admin, member, gym, group } = await setup();
    const s = await season(group.id, { name: "Manual", start: addDays(today, -30), end: addDays(today, -2), reveal: "manual", members: [admin.id, member.id], cat: gym.id });
    await recomputeSeason(s.id, { now: NOW });

    const asMember = await getGroupPageData(group.id, viewer(member), { now: NOW });
    expect(asMember.current?.name).toBe("Manual");
    expect(asMember.current?.status).toBe("ended");
    expect(asMember.current?.resultsPublished).toBe(false);
    expect(asMember.standings).toEqual([]);
    expect(asMember.past).toEqual([]);

    const asAdmin = await getGroupPageData(group.id, viewer(admin), { now: NOW });
    expect(asAdmin.standings.length).toBe(2);
    expect((await prisma.season.findUniqueOrThrow({ where: { id: s.id } })).finalizedAt).toBeNull(); // manual: no se finaliza solo
  });

  it("una temporada automática que terminó se finaliza al leer y pasa a las pasadas con su ganador", async () => {
    const { admin, member, gym, group } = await setup();
    const s = await season(group.id, { name: "Auto", start: addDays(today, -30), end: addDays(today, -2), members: [admin.id, member.id], cat: gym.id });
    await prisma.activity.create({ data: { userId: member.id, activityCategoryId: gym.id, startedAt: zonedToUtc(addDays(today, -5), "18:00", TZ), durationMinutes: 60 } });

    const data = await getGroupPageData(group.id, viewer(member), { now: NOW });
    expect(data.current).toBeNull();
    expect(data.past.map((p) => [p.name, p.status, p.resultsPublished])).toEqual([["Auto", "finalized", true]]);
    expect(data.past[0].winners.map((w) => w.userId)).toEqual([member.id]);
    const row = await prisma.season.findUniqueOrThrow({ where: { id: s.id } });
    expect(row.finalizedAt).not.toBeNull();
  });

  it("myWeek usa la zona horaria del grupo y cuenta solo los días que suman", async () => {
    const tz = "Asia/Tokyo";
    const { admin, member, gym, yoga, group } = await setup(tz);
    // NOW = jueves 5/11 00:00 en Tokio; la semana del grupo empieza el lunes 2/11.
    const s = await season(group.id, { name: "Activa", start: "2026-10-26", end: "2026-11-29", members: [admin.id, member.id], cat: gym.id });
    // Lunes 2/11 00:30 en Tokio = domingo 1/11 en UTC y en Buenos Aires: tiene que caer en ESTA semana.
    await prisma.activity.create({ data: { userId: member.id, activityCategoryId: gym.id, startedAt: zonedToUtc("2026-11-02", "00:30", tz), durationMinutes: 45 } });
    // Martes: 10 min de gym (no llega al mínimo) + yoga (no cuenta en la temporada).
    await prisma.activity.create({ data: { userId: member.id, activityCategoryId: gym.id, startedAt: zonedToUtc("2026-11-03", "08:00", tz), durationMinutes: 10 } });
    await prisma.activity.create({ data: { userId: member.id, activityCategoryId: yoga.id, startedAt: zonedToUtc("2026-11-03", "09:00", tz), durationMinutes: 60 } });
    await recomputeSeason(s.id, { now: NOW });

    const data = await getGroupPageData(group.id, viewer(member), { now: NOW });
    expect(data.myWeek).not.toBeNull();
    const w = data.myWeek!;
    expect(w.weekKey).toBe("2026-11-02");
    expect(w.target).toBe(3);
    expect(w.daysTrained).toBe(1);
    expect(w.days.map((d) => d.date)).toEqual(["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"]);
    expect(w.days.map((d) => [d.count, d.counted])).toEqual([
      [1, true], [2, false], [0, false], [0, false], [0, false], [0, false], [0, false],
    ]);
  });

  it("myWeek es null si el viewer no está en la temporada activa", async () => {
    const { admin, member, gym, group } = await setup();
    await season(group.id, { name: "Activa", start: addDays(today, -10), end: addDays(today, 10), members: [admin.id], cat: gym.id });
    const data = await getGroupPageData(group.id, viewer(member), { now: NOW });
    expect(data.myWeek).toBeNull();
  });

  it("rechaza a quien no es miembro", async () => {
    const { group } = await setup();
    const outsider = await prisma.user.create({ data: { email: "o@x.com", passwordHash: "x" } });
    await expect(getGroupPageData(group.id, viewer(outsider), { now: NOW })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("getGroupFeed", () => {
  it("pagina con cursor, solo miembros vigentes, con los puntos de la temporada del grupo", async () => {
    const { admin, member, gym, group } = await setup();
    const outsider = await prisma.user.create({ data: { email: "o@x.com", passwordHash: "x" } });
    const s = await season(group.id, { name: "Activa", start: addDays(today, -10), end: addDays(today, 10), members: [admin.id, member.id], cat: gym.id });
    for (let i = 1; i <= 5; i++) {
      await prisma.activity.create({ data: { userId: member.id, activityCategoryId: gym.id, startedAt: zonedToUtc(addDays(today, -i), "18:00", TZ), durationMinutes: 45 } });
    }
    // Fuera de la temporada: sin puntos.
    await prisma.activity.create({ data: { userId: admin.id, activityCategoryId: gym.id, startedAt: zonedToUtc(addDays(today, -40), "18:00", TZ), durationMinutes: 30 } });
    await prisma.activity.create({ data: { userId: outsider.id, activityCategoryId: gym.id, startedAt: zonedToUtc(today, "08:00", TZ), durationMinutes: 30 } });
    await recomputeSeason(s.id, { now: NOW });

    const p1 = await getGroupFeed(group.id, admin.id, { limit: 4 });
    expect(p1.items.length).toBe(4);
    expect(p1.items.every((i) => i.user.id === member.id && i.points === 23)).toBe(true); // 45 min = 23 pts (D1)
    expect(p1.nextCursor).not.toBeNull();
    const p2 = await getGroupFeed(group.id, admin.id, { limit: 4, cursor: p1.nextCursor! });
    expect(p2.items.map((i) => [i.user.id, i.points])).toEqual([
      [member.id, 23],
      [admin.id, null],
    ]);
    expect(p2.nextCursor).toBeNull();
    const all = [...p1.items, ...p2.items].map((i) => i.id);
    expect(new Set(all).size).toBe(6);
  });
});
