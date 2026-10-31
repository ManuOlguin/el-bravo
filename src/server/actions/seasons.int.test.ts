import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetDb, prisma } from "@/tests/setup/db";
import { addDays, localDateOf, localDateToDbDate, zonedToUtc } from "@/src/lib/time";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// Sesión inyectada: misma lógica de permisos que dal.ts, pero el usuario sale de `session.user`.
const session = vi.hoisted(() => ({ user: null as null | { id: string; email: string; name: string | null; photoUrl: string | null; timezone: string } }));
vi.mock("@/src/server/auth/dal", async () => {
  const { AuthError } = await import("@/src/server/auth/errors");
  const { membershipRole } = await import("@/src/server/auth/policies");
  const { prisma } = await import("@/src/lib/db");
  const getSession = async () => session.user;
  const requireUser = async () => {
    if (!session.user) throw new AuthError("UNAUTHENTICATED");
    return session.user;
  };
  const requireGroupMember = async (groupId: string) => {
    const user = await requireUser();
    const m = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId: user.id } }, select: { role: true, status: true, leftAt: true } });
    const role = membershipRole(m);
    if (!role) throw new AuthError(m ? "FORBIDDEN" : "NOT_FOUND");
    return { user, role };
  };
  const requireGroupAdmin = async (groupId: string) => {
    const { user, role } = await requireGroupMember(groupId);
    if (role !== "admin") throw new AuthError("FORBIDDEN");
    return user;
  };
  return { AuthError, getSession, requireUser, requireGroupMember, requireGroupAdmin, requirePageUser: requireUser };
});

import { revalidatePath } from "next/cache";
import {
  createSeasonAction, updateSeasonAction, deleteSeasonAction, joinSeasonAction, leaveSeasonAction,
  finalizeSeasonAction, publishSeasonResultsAction, reopenSeasonAction,
} from "./seasons";
import { finalizeDueSeasons, finalizeSeasonIfDue } from "@/src/server/seasons/lifecycle";
import type { SeasonInput } from "@/src/schemas/season";

const TZ = "America/Argentina/Buenos_Aires";
const today = localDateOf(new Date(), TZ);

async function setup() {
  const admin = await prisma.user.create({ data: { email: "admin@x.com", passwordHash: "x", name: "Admin" } });
  const member = await prisma.user.create({ data: { email: "m@x.com", passwordHash: "x", name: "Miembro" } });
  const outsider = await prisma.user.create({ data: { email: "o@x.com", passwordHash: "x", name: "Afuera" } });
  const gym = await prisma.activityCategory.create({ data: { slug: "gym", name: "Gym" } });
  const group = await prisma.group.create({
    data: {
      name: "G", timezone: TZ,
      members: { create: [{ userId: admin.id, role: "admin" }, { userId: member.id, role: "member" }] },
    },
  });
  return { admin, member, outsider, gym, group };
}
const as = (u: { id: string; email: string; name: string | null }) => {
  session.user = { id: u.id, email: u.email, name: u.name, photoUrl: null, timezone: TZ };
};
const input = (groupId: string, catId: string, o: Partial<SeasonInput> = {}): SeasonInput => ({
  groupId, name: "Temporada", description: null, startDate: addDays(today, -14), endDate: addDays(today, 14), weeklyGoal: 3,
  minDailyMinutes: 20, resultsReveal: "auto", categories: [{ activityCategoryId: catId, weight: 1 }], awards: [], ...o,
});
const seasonRow = (groupId: string, catId: string, start: string, end: string, o: { resultsReveal?: "auto" | "manual"; members?: string[]; name?: string } = {}) =>
  prisma.season.create({
    data: {
      groupId, name: o.name ?? "Vieja", startDate: localDateToDbDate(start), endDate: localDateToDbDate(end), resultsReveal: o.resultsReveal ?? "auto",
      categories: { create: [{ activityCategoryId: catId, weight: 1 }] },
      members: { create: (o.members ?? []).map((userId) => ({ userId })) },
    },
  });
const act = (userId: string, catId: string, date: string, minutes = 45) =>
  prisma.activity.create({ data: { userId, activityCategoryId: catId, startedAt: zonedToUtc(date, "12:00", TZ), durationMinutes: minutes } });

beforeEach(async () => {
  await resetDb();
  session.user = null;
  vi.mocked(revalidatePath).mockClear();
});

describe("createSeasonAction", () => {
  it("el admin crea: queda como miembro, se guardan categorías/premios y se recalcula", async () => {
    const { admin, gym, group } = await setup();
    as(admin);
    await act(admin.id, gym.id, addDays(today, -1));
    const r = await createSeasonAction(input(group.id, gym.id, { awards: [{ awardType: "most_days", bonusPoints: 15 }] }));
    expect(r).toMatchObject({ ok: true, message: "Temporada creada" });
    const seasonId = r.ok ? r.data.seasonId : "";
    const s = await prisma.season.findUniqueOrThrow({ where: { id: seasonId }, include: { members: true, categories: true, awards: true, standings: true } });
    expect(s.members.map((m) => m.userId)).toEqual([admin.id]);
    expect(s.categories.map((c) => [c.activityCategoryId, Number(c.weight)])).toEqual([[gym.id, 1]]);
    expect(s.awards.map((a) => [a.awardType, a.bonusPoints])).toEqual([["most_days", 15]]);
    expect(s.standings.map((x) => [x.userId, x.points])).toEqual([[admin.id, 23]]);
    expect(revalidatePath).toHaveBeenCalledWith(`/group/${group.id}`);
  });

  it("valida permisos y sesión", async () => {
    const { member, outsider, gym, group } = await setup();
    expect(await createSeasonAction(input(group.id, gym.id))).toEqual({ ok: false, error: "Tenés que iniciar sesión." });
    as(member);
    expect(await createSeasonAction(input(group.id, gym.id))).toEqual({ ok: false, error: "No tenés permiso para hacer esto." });
    as(outsider);
    expect((await createSeasonAction(input(group.id, gym.id))).ok).toBe(false);
    expect(await prisma.season.count()).toBe(0);
  });

  it("devuelve fieldErrors con input inválido", async () => {
    const { admin, gym, group } = await setup();
    as(admin);
    const r = await createSeasonAction({ ...input(group.id, gym.id), name: "", weeklyGoal: 9 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.fieldErrors ?? {})).toEqual(expect.arrayContaining(["name", "weeklyGoal"]));
  });

  it("no permite temporadas superpuestas en el grupo (contiguas sí)", async () => {
    const { admin, gym, group } = await setup();
    as(admin);
    await seasonRow(group.id, gym.id, addDays(today, 10), addDays(today, 40), { name: "Diciembre" });
    expect(await createSeasonAction(input(group.id, gym.id))).toEqual({ ok: false, error: 'Las fechas se superponen con la temporada "Diciembre"' });
    expect((await createSeasonAction(input(group.id, gym.id, { endDate: addDays(today, 9) }))).ok).toBe(true);
  });

  it("rechaza categorías inexistentes", async () => {
    const { admin, group } = await setup();
    as(admin);
    expect(await createSeasonAction(input(group.id, "nope"))).toEqual({ ok: false, error: "Algún tipo de actividad no es válido" });
  });
});

describe("updateSeasonAction", () => {
  it("recalcula con las reglas nuevas y conserva las reglas avanzadas si no vienen", async () => {
    const { admin, gym, group } = await setup();
    as(admin);
    const r = await createSeasonAction(input(group.id, gym.id, { weeklyGoal: 3, rules: { dayBasePoints: 10, timePointsFactor: 10, timeCurveMinutes: 30, maxDailyMinutes: 240, weeklyGoalBonus: 30, streakBonusStep: 5, streakBonusCap: 25, activeStreakBonusStep: 2, activeStreakBonusCap: 10 } }));
    const seasonId = r.ok ? r.data.seasonId : "";
    // Dos días de la semana pasada (semana completa dentro de la temporada).
    const lastMonday = addDays(today, -7 - ((new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7));
    await act(admin.id, gym.id, lastMonday);
    await act(admin.id, gym.id, addDays(lastMonday, 1));

    expect(await updateSeasonAction(seasonId, input(group.id, gym.id, { weeklyGoal: 2 }))).toMatchObject({ ok: true });
    const s = await prisma.season.findUniqueOrThrow({ where: { id: seasonId }, include: { standings: true } });
    expect(s.weeklyGoal).toBe(2);
    expect(s.weeklyGoalBonus).toBe(30);
    expect(s.standings[0].points).toBe(2 * 23 + 30);
  });

  it("no permite superponer con otra temporada ni editar una finalizada", async () => {
    const { admin, gym, group } = await setup();
    as(admin);
    const other = await seasonRow(group.id, gym.id, addDays(today, 30), addDays(today, 60), { name: "Otra" });
    const r = await createSeasonAction(input(group.id, gym.id));
    const seasonId = r.ok ? r.data.seasonId : "";
    expect(await updateSeasonAction(seasonId, input(group.id, gym.id, { endDate: addDays(today, 30) }))).toEqual({ ok: false, error: 'Las fechas se superponen con la temporada "Otra"' });
    expect((await updateSeasonAction(seasonId, input(group.id, gym.id, { name: "Renombrada" }))).ok).toBe(true);

    await prisma.season.update({ where: { id: other.id }, data: { finalizedAt: new Date() } });
    expect(await updateSeasonAction(other.id, input(group.id, gym.id, { startDate: addDays(today, 30), endDate: addDays(today, 60) }))).toEqual({
      ok: false, error: "La temporada está finalizada. Reabrila para editarla.",
    });
  });

  it("un miembro no puede editar", async () => {
    const { admin, member, gym, group } = await setup();
    as(admin);
    const r = await createSeasonAction(input(group.id, gym.id));
    as(member);
    expect(await updateSeasonAction(r.ok ? r.data.seasonId : "", input(group.id, gym.id))).toEqual({ ok: false, error: "No tenés permiso para hacer esto." });
  });
});

describe("join / leave / delete", () => {
  it("unirse y salir recalculan; temporada terminada da error", async () => {
    const { admin, member, outsider, gym, group } = await setup();
    as(admin);
    const r = await createSeasonAction(input(group.id, gym.id));
    const seasonId = r.ok ? r.data.seasonId : "";
    await act(member.id, gym.id, addDays(today, -1));

    as(member);
    expect(await joinSeasonAction(seasonId)).toMatchObject({ ok: true });
    expect((await prisma.seasonStanding.findMany({ where: { seasonId }, orderBy: { rank: "asc" } })).map((s) => [s.userId, s.points])).toEqual([[member.id, 23], [admin.id, 0]]);

    expect(await leaveSeasonAction(seasonId)).toMatchObject({ ok: true });
    expect((await prisma.seasonStanding.findMany({ where: { seasonId } })).map((s) => s.userId)).toEqual([admin.id]);

    as(outsider);
    expect((await joinSeasonAction(seasonId)).ok).toBe(false);

    const old = await seasonRow(group.id, gym.id, addDays(today, -90), addDays(today, -60));
    as(member);
    expect(await joinSeasonAction(old.id)).toEqual({ ok: false, error: "La temporada ya terminó" });
  });

  it("solo el admin borra", async () => {
    const { admin, member, gym, group } = await setup();
    const s = await seasonRow(group.id, gym.id, addDays(today, 30), addDays(today, 60));
    as(member);
    expect((await deleteSeasonAction(s.id)).ok).toBe(false);
    as(admin);
    expect(await deleteSeasonAction(s.id)).toMatchObject({ ok: true });
    expect(await prisma.season.count()).toBe(0);
    expect(await deleteSeasonAction("no-existe")).toEqual({ ok: false, error: "No encontramos lo que buscabas." });
  });
});

describe("finalizar / publicar / reabrir", () => {
  it("auto publica al finalizar; manual espera a publicar", async () => {
    const { admin, gym, group } = await setup();
    as(admin);
    const auto = await seasonRow(group.id, gym.id, addDays(today, -60), addDays(today, -40), { members: [admin.id] });
    const manual = await seasonRow(group.id, gym.id, addDays(today, -30), addDays(today, -10), { resultsReveal: "manual", members: [admin.id] });

    expect(await finalizeSeasonAction(auto.id)).toMatchObject({ ok: true });
    expect(await finalizeSeasonAction(manual.id)).toMatchObject({ ok: true });
    const [a, m] = await Promise.all([auto, manual].map((s) => prisma.season.findUniqueOrThrow({ where: { id: s.id } })));
    expect(a.finalizedAt && a.resultsPublishedAt).toBeTruthy();
    expect(m.finalizedAt).not.toBeNull();
    expect(m.resultsPublishedAt).toBeNull();

    expect(await publishSeasonResultsAction(manual.id)).toMatchObject({ ok: true });
    expect((await prisma.season.findUniqueOrThrow({ where: { id: manual.id } })).resultsPublishedAt).not.toBeNull();
  });

  it("no finaliza una temporada que no empezó ni publica una sin finalizar", async () => {
    const { admin, gym, group } = await setup();
    as(admin);
    const up = await seasonRow(group.id, gym.id, addDays(today, 10), addDays(today, 40));
    expect(await finalizeSeasonAction(up.id)).toEqual({ ok: false, error: "La temporada todavía no empezó" });
    expect(await publishSeasonResultsAction(up.id)).toEqual({ ok: false, error: "Primero finalizá la temporada" });
  });

  it("reabrir borra ganadores y premios y permite editar", async () => {
    const { admin, gym, group } = await setup();
    as(admin);
    const r = await createSeasonAction(input(group.id, gym.id, { awards: [{ awardType: "most_days", bonusPoints: 10 }] }));
    const seasonId = r.ok ? r.data.seasonId : "";
    await act(admin.id, gym.id, addDays(today, -1));
    await finalizeSeasonAction(seasonId);
    expect(await prisma.seasonAwardWinner.count()).toBe(1);
    expect((await prisma.seasonStanding.findFirstOrThrow({ where: { seasonId } })).points).toBe(33);

    expect(await reopenSeasonAction(seasonId)).toMatchObject({ ok: true });
    const s = await prisma.season.findUniqueOrThrow({ where: { id: seasonId }, include: { standings: true } });
    expect(s.finalizedAt).toBeNull();
    expect(await prisma.seasonAwardWinner.count()).toBe(0);
    expect(await prisma.scoreEntry.count({ where: { kind: "award" } })).toBe(0);
    expect(s.standings[0].points).toBe(23);
    expect((await updateSeasonAction(seasonId, input(group.id, gym.id, { name: "Otra vez" }))).ok).toBe(true);
  });
});

describe("finalización automática (página + cron)", () => {
  it("finalizeSeasonIfDue (respaldo de las páginas) solo finaliza temporadas terminadas con resultsReveal auto", async () => {
    const { admin, gym, group } = await setup();
    const ended = await seasonRow(group.id, gym.id, addDays(today, -60), addDays(today, -40), { members: [admin.id] });
    const manual = await seasonRow(group.id, gym.id, addDays(today, -30), addDays(today, -20), { resultsReveal: "manual" });
    const active = await seasonRow(group.id, gym.id, addDays(today, -5), addDays(today, 5));
    await Promise.all([ended, manual, active].map((s) => finalizeSeasonIfDue(s.id)));
    const rows = await prisma.season.findMany({ select: { id: true, finalizedAt: true, resultsPublishedAt: true } });
    const byId = new Map(rows.map((r) => [r.id, r]));
    expect(byId.get(ended.id)!.finalizedAt).not.toBeNull();
    expect(byId.get(ended.id)!.resultsPublishedAt).not.toBeNull();
    expect(byId.get(manual.id)!.finalizedAt).toBeNull();
    expect(byId.get(active.id)!.finalizedAt).toBeNull();
  });

  it("finalizeDueSeasons (cron) finaliza las auto terminadas y es idempotente", async () => {
    const { admin, gym, group } = await setup();
    const g2 = await prisma.group.create({ data: { name: "G2", timezone: TZ } });
    const ended = await seasonRow(group.id, gym.id, addDays(today, -60), addDays(today, -40), { members: [admin.id] });
    const yesterday = await seasonRow(g2.id, gym.id, addDays(today, -10), addDays(today, -1));
    await seasonRow(group.id, gym.id, addDays(today, -30), addDays(today, -20), { resultsReveal: "manual" });
    await seasonRow(group.id, gym.id, addDays(today, -5), addDays(today, 5));
    expect((await finalizeDueSeasons()).sort()).toEqual([ended.id, yesterday.id].sort());
    expect(await finalizeDueSeasons()).toEqual([]);
  });
});
