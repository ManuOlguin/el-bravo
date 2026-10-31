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

import { followAction, unfollowAction, searchUsersAction } from "@/src/server/actions/social";
import { isFriend, listFriends, getFollowSuggestions } from "./follows";
import { notify } from "@/src/server/notifications";
import { SESSION_COOKIE, signSessionToken } from "@/src/server/auth/session";

async function user(name: string, extra: Partial<{ isActive: boolean }> = {}) {
  return prisma.user.create({
    data: { email: `${name.toLowerCase().replace(/\W/g, "")}-${Math.random().toString(36).slice(2, 7)}@t.com`, passwordHash: "x", name, ...extra },
  });
}

async function loginAs(u: { id: string; email: string }) {
  cookieJar.set(SESSION_COOKIE, await signSessionToken({ userId: u.id, email: u.email, ver: 0 }));
}

describe("follows", () => {
  beforeEach(async () => {
    await resetDb();
    resetNextMocks();
    vi.mocked(notify).mockClear();
  });

  it("seguir y dejar de seguir", async () => {
    const ana = await user("Ana");
    const beto = await user("Beto");
    await loginAs(ana);
    expect(await followAction(beto.id)).toEqual({ ok: true, data: { isFollowing: true, isFriend: false } });
    expect(await prisma.follow.count({ where: { followerId: ana.id, followingId: beto.id } })).toBe(1);
    expect(await unfollowAction(beto.id)).toEqual({ ok: true, data: { isFollowing: false } });
    expect(await prisma.follow.count()).toBe(0);
    // dejar de seguir a alguien que no seguís no falla
    expect((await unfollowAction(beto.id)).ok).toBe(true);
  });

  it("seguir dos veces es idempotente y notifica una sola vez", async () => {
    const ana = await user("Ana");
    const beto = await user("Beto");
    await loginAs(ana);
    await followAction(beto.id);
    await followAction(beto.id);
    expect(await prisma.follow.count()).toBe(1);
    expect(notify).toHaveBeenCalledTimes(1);
    const arg = vi.mocked(notify).mock.calls[0][0];
    expect(arg).toMatchObject({ recipientIds: [beto.id], type: "new_follower", actorId: ana.id });
    expect(arg.dedupeKey(beto.id)).toBe(`new_follower:${ana.id}:${beto.id}`);
  });

  it("no se puede seguir a uno mismo ni a alguien que no existe", async () => {
    const ana = await user("Ana");
    await loginAs(ana);
    expect(await followAction(ana.id)).toMatchObject({ ok: false, error: "No podés seguirte a vos mismo." });
    expect((await followAction("no-existe")).ok).toBe(false);
    expect(await prisma.follow.count()).toBe(0);
  });

  it("isFriend con seguimiento mutuo", async () => {
    const ana = await user("Ana");
    const beto = await user("Beto");
    await loginAs(ana);
    await followAction(beto.id);
    expect(await isFriend(ana.id, beto.id)).toBe(false);
    await loginAs(beto);
    expect(await followAction(ana.id)).toEqual({ ok: true, data: { isFollowing: true, isFriend: true } });
    expect(await isFriend(ana.id, beto.id)).toBe(true);
    expect(await isFriend(beto.id, ana.id)).toBe(true);
    expect((await listFriends(ana.id)).map((f) => f.id)).toEqual([beto.id]);
  });

  it("sin sesión no deja seguir", async () => {
    const beto = await user("Beto");
    expect(await followAction(beto.id)).toMatchObject({ ok: false, error: "Tenés que iniciar sesión." });
  });

  it("busca por prefijo de nombre o de palabra, sin acentos, mínimo 2 caracteres", async () => {
    const ana = await user("Ana");
    const jose = await user("José Pérez");
    await user("Rosendo");
    await user("Joselo Inactivo", { isActive: false });
    await loginAs(ana);
    await followAction(jose.id);

    const r1 = await searchUsersAction("jose");
    expect(r1.ok && r1.data).toEqual([{ id: jose.id, name: "José Pérez", photoUrl: null, isFollowing: true }]);
    const r2 = await searchUsersAction("PERE");
    expect(r2.ok && r2.data.map((u) => u.id)).toEqual([jose.id]);
    const r3 = await searchUsersAction("ose"); // no es prefijo de ninguna palabra
    expect(r3.ok && r3.data).toEqual([]);
    const r4 = await searchUsersAction("j");
    expect(r4.ok && r4.data).toEqual([]);
    // no se encuentra a uno mismo
    const r5 = await searchUsersAction("ana");
    expect(r5.ok && r5.data).toEqual([]);
  });

  it("la búsqueda devuelve como máximo 20 resultados", async () => {
    const ana = await user("Ana");
    for (let i = 0; i < 25; i++) await user(`Martín ${i}`);
    await loginAs(ana);
    const r = await searchUsersAction("martin");
    expect(r.ok && r.data.length).toBe(20);
  });

  it("sugiere gente de tus grupos que todavía no seguís", async () => {
    const ana = await user("Ana");
    const beto = await user("Beto");
    const caro = await user("Caro");
    const dani = await user("Dani");
    const g = await prisma.group.create({ data: { name: "G" } });
    await prisma.groupMember.createMany({
      data: [
        { groupId: g.id, userId: ana.id, role: "admin" },
        { groupId: g.id, userId: beto.id, role: "member" },
        { groupId: g.id, userId: caro.id, role: "member" },
        { groupId: g.id, userId: dani.id, role: "member", leftAt: new Date() },
      ],
    });
    await prisma.follow.create({ data: { followerId: ana.id, followingId: beto.id } });
    const s = await getFollowSuggestions(ana.id, 10);
    expect(s.map((u) => u.id)).toEqual([caro.id]);
  });
});
