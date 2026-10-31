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

import { inviteFriendsToGroupAction, joinGroupByInviteTokenAction, createGroupAction, kickMemberAction } from "./groups";
import { listFriendsAction } from "./social";
import { notify } from "@/src/server/notifications";
import { SESSION_COOKIE, signSessionToken } from "@/src/server/auth/session";

type U = { id: string; email: string };
async function user(name: string): Promise<U> {
  return prisma.user.create({ data: { email: `${name.toLowerCase()}@t.com`, passwordHash: "x", name } });
}
async function as(u: U) {
  cookieJar.set(SESSION_COOKIE, await signSessionToken({ userId: u.id, email: u.email, ver: 0 }));
}
async function friends(a: U, b: U) {
  await prisma.follow.createMany({ data: [{ followerId: a.id, followingId: b.id }, { followerId: b.id, followingId: a.id }] });
}
function tokenFromNotify(callIndex = 0): string {
  const data = vi.mocked(notify).mock.calls[callIndex][0].data as { href: string };
  return new URL(data.href, "http://x").searchParams.get("token")!;
}

describe("invitar amigos a un grupo", () => {
  beforeEach(async () => {
    await resetDb();
    resetNextMocks();
    vi.mocked(notify).mockClear();
  });

  async function setup() {
    const ana = await user("Ana");
    const beto = await user("Beto");
    const caro = await user("Caro");
    await friends(ana, beto);
    await prisma.follow.create({ data: { followerId: ana.id, followingId: caro.id } }); // Ana sigue a Caro, no es mutuo
    await as(ana);
    const r = await createGroupAction({ name: "Los Bravos" });
    if (!r.ok) throw new Error(r.error);
    return { ana, beto, caro, groupId: r.data.groupId };
  }

  it("listFriendsAction devuelve solo amigos mutuos", async () => {
    const { beto } = await setup();
    const r = await listFriendsAction();
    expect(r.ok && r.data).toEqual([{ id: beto.id, name: "Beto", photoUrl: null }]);
  });

  it("invitar a alguien que no es amigo da error", async () => {
    const { caro, groupId } = await setup();
    expect(await inviteFriendsToGroupAction(groupId, [caro.id])).toMatchObject({ ok: false, error: "Solo podés invitar a tus amigos." });
    expect(notify).not.toHaveBeenCalled();
  });

  it("solo un admin puede invitar", async () => {
    const { ana, beto, groupId } = await setup();
    await prisma.groupMember.create({ data: { groupId, userId: beto.id, role: "member" } });
    const dani = await user("Dani");
    await friends(beto, dani);
    await as(beto);
    expect(await inviteFriendsToGroupAction(groupId, [dani.id])).toMatchObject({ ok: false, error: "No tenés permiso para hacer esto." });
    void ana;
  });

  it("entrega la invitación como member_joined (kind: invite) y el token solo sirve a su destinatario", async () => {
    const { ana, beto, caro, groupId } = await setup();
    const r = await inviteFriendsToGroupAction(groupId, [beto.id]);
    expect(r).toMatchObject({ ok: true, data: { invited: 1 } });
    const arg = vi.mocked(notify).mock.calls[0][0];
    expect(arg).toMatchObject({ recipientIds: [beto.id], type: "member_joined", actorId: ana.id, groupId, data: { kind: "invite", groupId, inviterId: ana.id } });
    expect((arg.data as { href: string }).href).toMatch(/^\/groups\/join\?token=/);
    const token = tokenFromNotify();

    await as(caro);
    expect(await joinGroupByInviteTokenAction(token)).toMatchObject({ ok: false, error: "Esta invitación no es para vos." });
    expect(await prisma.groupMember.count({ where: { groupId, userId: caro.id } })).toBe(0);

    await as(beto);
    expect(await joinGroupByInviteTokenAction(token)).toMatchObject({ ok: true, data: { groupId } });
    expect(await prisma.groupMember.findUniqueOrThrow({ where: { groupId_userId: { groupId, userId: beto.id } } })).toMatchObject({ role: "member", status: "accepted" });
    expect((await joinGroupByInviteTokenAction("basura")).ok).toBe(false);
  });

  it("los que ya son miembros no se vuelven a invitar; un expulsado puede volver con invitación", async () => {
    const { beto, groupId } = await setup();
    await prisma.groupMember.create({ data: { groupId, userId: beto.id, role: "member" } });
    expect(await inviteFriendsToGroupAction(groupId, [beto.id])).toMatchObject({ ok: true, data: { invited: 0 } });
    expect(notify).not.toHaveBeenCalled();
    expect((await kickMemberAction(groupId, beto.id)).ok).toBe(true);
    expect(await inviteFriendsToGroupAction(groupId, [beto.id])).toMatchObject({ ok: true, data: { invited: 1 } });
    const token = tokenFromNotify();
    await as(beto);
    expect((await joinGroupByInviteTokenAction(token)).ok).toBe(true);
  });
});
