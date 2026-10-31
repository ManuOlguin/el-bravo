import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetDb, prisma } from "@/tests/setup/db";
import { cookieJar, resetNextMocks } from "@/src/server/account/testing/next-mocks";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", async () => (await import("@/src/server/account/testing/next-mocks")).nextHeadersMock);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/src/server/notifications", async (orig) => ({
  ...(await orig<typeof import("@/src/server/notifications")>()),
  notify: vi.fn(async () => {}),
}));
vi.mock("@/src/server/scoring", async (orig) => ({
  ...(await orig<typeof import("@/src/server/scoring")>()),
  recomputeSeason: vi.fn(async () => {}),
}));

import {
  createGroupAction,
  updateGroupAction,
  deleteGroupAction,
  getInviteCodeAction,
  regenerateInviteCodeAction,
  joinGroupAction,
  leaveGroupAction,
  kickMemberAction,
  setMemberRoleAction,
} from "./groups";
import { getGroupForMember } from "@/src/server/groups/queries";
import { notify } from "@/src/server/notifications";
import { recomputeSeason } from "@/src/server/scoring";
import { SESSION_COOKIE, signSessionToken } from "@/src/server/auth/session";
import { __clearRateLimits } from "@/src/server/account/rate-limit";
import { localDateToDbDate } from "@/src/lib/time";

type U = { id: string; email: string };
async function user(name: string): Promise<U> {
  return prisma.user.create({ data: { email: `${name.toLowerCase()}@private.com`, passwordHash: "x", name } });
}
async function as(u: U) {
  cookieJar.set(SESSION_COOKIE, await signSessionToken({ userId: u.id, email: u.email, ver: 0 }));
}
async function member(groupId: string, userId: string) {
  return prisma.groupMember.findUniqueOrThrow({ where: { groupId_userId: { groupId, userId } } });
}
function unwrap<T>(r: { ok: true; data: T } | { ok: false; error: string }): T {
  if (!r.ok) throw new Error(`esperaba ok, vino: ${r.error}`);
  return r.data;
}

async function groupWith(admin: U, ...members: U[]) {
  await as(admin);
  const { groupId } = unwrap(await createGroupAction({ name: "Los Bravos", description: "Desc" }));
  for (const m of members) await prisma.groupMember.create({ data: { groupId, userId: m.id, role: "member" } });
  return groupId;
}

describe("group actions", () => {
  beforeEach(async () => {
    await resetDb();
    resetNextMocks();
    __clearRateLimits();
    vi.mocked(notify).mockClear();
    vi.mocked(recomputeSeason).mockClear();
  });

  describe("crear / editar / borrar", () => {
    it("crea con descripción y el creador queda admin", async () => {
      const ana = await user("Ana");
      await as(ana);
      const { groupId } = unwrap(await createGroupAction({ name: "  Los Bravos ", description: "Entrenamos juntos", photoUrl: null }));
      const g = await prisma.group.findUniqueOrThrow({ where: { id: groupId }, include: { members: true } });
      expect(g).toMatchObject({ name: "Los Bravos", description: "Entrenamos juntos", timezone: "America/Argentina/Buenos_Aires", createdBy: ana.id });
      expect(g.members).toMatchObject([{ userId: ana.id, role: "admin", status: "accepted", leftAt: null }]);
    });

    it("valida el nombre y la zona horaria", async () => {
      await as(await user("Ana"));
      const r = await createGroupAction({ name: " ", timezone: "Nope/Nope" });
      expect(r.ok === false && r.fieldErrors?.name && r.fieldErrors?.timezone).toBeTruthy();
    });

    it("solo un admin edita o borra", async () => {
      const ana = await user("Ana");
      const beto = await user("Beto");
      const groupId = await groupWith(ana, beto);
      await as(beto);
      expect(await updateGroupAction(groupId, { name: "X", timezone: "UTC" })).toMatchObject({ ok: false, error: "No tenés permiso para hacer esto." });
      expect((await deleteGroupAction(groupId)).ok).toBe(false);
      await as(ana);
      expect((await updateGroupAction(groupId, { name: "Nuevo", description: null, timezone: "America/Montevideo" })).ok).toBe(true);
      expect(await prisma.group.findUniqueOrThrow({ where: { id: groupId } })).toMatchObject({ name: "Nuevo", description: null, timezone: "America/Montevideo" });
      expect((await deleteGroupAction(groupId)).ok).toBe(true);
      expect(await prisma.group.count()).toBe(0);
      expect(await prisma.groupMember.count()).toBe(0);
    });
  });

  describe("códigos de invitación", () => {
    it("solo el admin ve el código; 8 caracteres, vence en 7 días, regenerable", async () => {
      const ana = await user("Ana");
      const beto = await user("Beto");
      const groupId = await groupWith(ana, beto);
      await as(beto);
      expect((await getInviteCodeAction(groupId)).ok).toBe(false);
      await as(ana);
      const a = unwrap(await getInviteCodeAction(groupId));
      expect(a.code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
      const days = (a.expiresAt.getTime() - Date.now()) / 86_400_000;
      expect(days).toBeGreaterThan(6.99);
      expect(days).toBeLessThan(7.01);
      expect(unwrap(await getInviteCodeAction(groupId)).code).toBe(a.code);
      const b = unwrap(await regenerateInviteCodeAction(groupId));
      expect(b.code).not.toBe(a.code);
    });

    it("se une con el código en minúsculas y avisa a los admins", async () => {
      const ana = await user("Ana");
      const caro = await user("Caro");
      const groupId = await groupWith(ana);
      const { code } = unwrap(await getInviteCodeAction(groupId));
      await as(caro);
      expect(unwrap(await joinGroupAction(` ${code.toLowerCase()} `))).toEqual({ groupId });
      expect(await member(groupId, caro.id)).toMatchObject({ role: "member", status: "accepted", leftAt: null });
      expect(notify).toHaveBeenCalledTimes(1);
      const arg = vi.mocked(notify).mock.calls[0][0];
      expect(arg).toMatchObject({ recipientIds: [ana.id], type: "member_joined", actorId: caro.id, groupId });
      expect(arg.dedupeKey(ana.id)).toMatch(new RegExp(`^member_joined:${groupId}:${caro.id}:\\d+:${ana.id}$`));
      // volver a unirse siendo miembro no duplica
      expect((await joinGroupAction(code)).ok).toBe(true);
      expect(await prisma.groupMember.count({ where: { groupId } })).toBe(2);
    });

    it("rechaza códigos inválidos o vencidos", async () => {
      const ana = await user("Ana");
      const caro = await user("Caro");
      const groupId = await groupWith(ana);
      const { code } = unwrap(await getInviteCodeAction(groupId));
      await prisma.group.update({ where: { id: groupId }, data: { inviteCodeExpiresAt: new Date(Date.now() - 1000) } });
      await as(caro);
      expect(await joinGroupAction(code)).toMatchObject({ ok: false, error: "El código no es válido o ya venció." });
      expect(await joinGroupAction("ZZZZZZZZ")).toMatchObject({ ok: false, error: "El código no es válido o ya venció." });
      expect((await joinGroupAction("123")).ok).toBe(false);
    });

    it("máximo 10 intentos de unirse por usuario cada 15 minutos", async () => {
      await as(await user("Caro"));
      for (let i = 0; i < 10; i++) expect((await joinGroupAction("ZZZZZZZZ")).ok).toBe(false);
      expect(await joinGroupAction("ZZZZZZZZ")).toMatchObject({ ok: false, error: "Demasiados intentos. Probá de nuevo en 15 minutos." });
    });

    it("un admin que se fue y vuelve entra como member", async () => {
      const ana = await user("Ana");
      const beto = await user("Beto");
      const groupId = await groupWith(ana, beto);
      const { code } = unwrap(await getInviteCodeAction(groupId));
      unwrap(await setMemberRoleAction(groupId, beto.id, "admin"));
      unwrap(await leaveGroupAction(groupId));
      expect((await member(groupId, ana.id)).leftAt).not.toBeNull();
      unwrap(await joinGroupAction(code));
      expect(await member(groupId, ana.id)).toMatchObject({ role: "member", status: "accepted", leftAt: null });
    });

    it("un expulsado no puede volver con el código", async () => {
      const ana = await user("Ana");
      const beto = await user("Beto");
      const groupId = await groupWith(ana, beto);
      const { code } = unwrap(await getInviteCodeAction(groupId));
      unwrap(await kickMemberAction(groupId, beto.id));
      await as(beto);
      expect(await joinGroupAction(code)).toMatchObject({ ok: false, error: "Un admin te sacó de este grupo. Pedile que te invite de nuevo." });
    });

    it("con una temporada activa no se une solo a la temporada", async () => {
      const ana = await user("Ana");
      const caro = await user("Caro");
      const groupId = await groupWith(ana);
      const season = await prisma.season.create({
        data: { groupId, name: "T1", startDate: localDateToDbDate("2026-01-01"), endDate: localDateToDbDate("2099-12-31") },
      });
      const { code } = unwrap(await getInviteCodeAction(groupId));
      await as(caro);
      unwrap(await joinGroupAction(code));
      expect(await prisma.seasonMember.count({ where: { seasonId: season.id } })).toBe(0);
    });
  });

  describe("salir, expulsar y roles", () => {
    it("el último admin no puede salir si quedan miembros", async () => {
      const ana = await user("Ana");
      const beto = await user("Beto");
      const groupId = await groupWith(ana, beto);
      expect(await leaveGroupAction(groupId)).toMatchObject({ ok: false, error: "Nombrá a otro admin antes de salir." });
      unwrap(await setMemberRoleAction(groupId, beto.id, "admin"));
      expect((await leaveGroupAction(groupId)).ok).toBe(true);
    });

    it("si es el único miembro, al salir se borra el grupo", async () => {
      const ana = await user("Ana");
      const groupId = await groupWith(ana);
      const r = await leaveGroupAction(groupId);
      expect(r.ok).toBe(true);
      expect(await prisma.group.count({ where: { id: groupId } })).toBe(0);
    });

    it("salir saca de las temporadas no finalizadas y recalcula", async () => {
      const ana = await user("Ana");
      const beto = await user("Beto");
      const groupId = await groupWith(ana, beto);
      const open = await prisma.season.create({ data: { groupId, name: "Abierta", startDate: localDateToDbDate("2026-01-01"), endDate: localDateToDbDate("2099-01-01") } });
      const closed = await prisma.season.create({ data: { groupId, name: "Cerrada", startDate: localDateToDbDate("2025-01-01"), endDate: localDateToDbDate("2025-02-01"), finalizedAt: new Date() } });
      await prisma.seasonMember.createMany({ data: [{ seasonId: open.id, userId: beto.id }, { seasonId: closed.id, userId: beto.id }] });
      await as(beto);
      unwrap(await leaveGroupAction(groupId));
      expect((await prisma.seasonMember.findFirstOrThrow({ where: { seasonId: open.id, userId: beto.id } })).leftAt).not.toBeNull();
      expect((await prisma.seasonMember.findFirstOrThrow({ where: { seasonId: closed.id, userId: beto.id } })).leftAt).toBeNull();
      expect(recomputeSeason).toHaveBeenCalledWith(open.id);
      expect(recomputeSeason).not.toHaveBeenCalledWith(closed.id);
    });

    it("solo un admin expulsa, y no a sí mismo; marca removed y saca de temporadas activas", async () => {
      const ana = await user("Ana");
      const beto = await user("Beto");
      const caro = await user("Caro");
      const groupId = await groupWith(ana, beto, caro);
      const season = await prisma.season.create({ data: { groupId, name: "T", startDate: localDateToDbDate("2026-01-01"), endDate: localDateToDbDate("2099-01-01") } });
      await prisma.seasonMember.create({ data: { seasonId: season.id, userId: beto.id } });

      await as(caro);
      expect(await kickMemberAction(groupId, beto.id)).toMatchObject({ ok: false, error: "No tenés permiso para hacer esto." });
      await as(ana);
      expect(await kickMemberAction(groupId, ana.id)).toMatchObject({ ok: false, error: "No podés expulsarte a vos mismo." });
      unwrap(await kickMemberAction(groupId, beto.id));
      const m = await member(groupId, beto.id);
      expect(m.status).toBe("removed");
      expect(m.leftAt).not.toBeNull();
      expect((await prisma.seasonMember.findFirstOrThrow({ where: { seasonId: season.id, userId: beto.id } })).leftAt).not.toBeNull();
      expect(recomputeSeason).toHaveBeenCalledWith(season.id);
      await expect(getGroupForMember(groupId, beto.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect((await kickMemberAction(groupId, beto.id)).ok).toBe(false); // ya no es miembro
    });

    it("no se puede sacar el rol al último admin", async () => {
      const ana = await user("Ana");
      const beto = await user("Beto");
      const groupId = await groupWith(ana, beto);
      expect(await setMemberRoleAction(groupId, ana.id, "member")).toMatchObject({ ok: false, error: "Tiene que quedar al menos un admin." });
      await as(beto);
      expect((await setMemberRoleAction(groupId, beto.id, "admin")).ok).toBe(false);
    });
  });

  describe("getGroupForMember", () => {
    it("no devuelve inviteCode ni emails", async () => {
      const ana = await user("Ana");
      const beto = await user("Beto");
      const groupId = await groupWith(ana, beto);
      await getInviteCodeAction(groupId);
      const dto = await getGroupForMember(groupId, beto.id);
      const json = JSON.stringify(dto);
      expect(json).not.toContain("@private.com");
      expect(json).not.toMatch(/inviteCode/i);
      expect(dto).toMatchObject({ id: groupId, name: "Los Bravos", description: "Desc", myRole: "member" });
      expect(dto.members.map((m) => [m.name, m.role])).toEqual([
        ["Ana", "admin"],
        ["Beto", "member"],
      ]);
      expect(Object.keys(dto.members[0]).sort()).toEqual(["joinedAt", "name", "photoUrl", "role", "userId"]);
    });

    it("un no miembro recibe NOT_FOUND", async () => {
      const ana = await user("Ana");
      const zoe = await user("Zoe");
      const groupId = await groupWith(ana);
      await expect(getGroupForMember(groupId, zoe.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });
});
