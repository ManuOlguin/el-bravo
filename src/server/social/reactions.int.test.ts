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

import { toggleReactionAction } from "@/src/server/actions/social";
import { getReactionSummaries, REACTION_EMOJIS } from "./reactions";
import { notify } from "@/src/server/notifications";
import { SESSION_COOKIE, signSessionToken } from "@/src/server/auth/session";

type U = { id: string; email: string; name: string | null };
async function user(name: string): Promise<U> {
  return prisma.user.create({ data: { email: `${name.toLowerCase()}@t.com`, passwordHash: "x", name } });
}
async function as(u: U) {
  cookieJar.set(SESSION_COOKIE, await signSessionToken({ userId: u.id, email: u.email, ver: 0 }));
}
async function activityOf(u: U) {
  const cat = (await prisma.activityCategory.findFirst()) ?? (await prisma.activityCategory.create({ data: { slug: "running", name: "Running" } }));
  return prisma.activity.create({ data: { userId: u.id, activityCategoryId: cat.id, startedAt: new Date(), durationMinutes: 30 } });
}

describe("reacciones", () => {
  beforeEach(async () => {
    await resetDb();
    resetNextMocks();
    vi.mocked(notify).mockClear();
  });

  it("el set fijo de emojis", () => {
    expect(REACTION_EMOJIS).toEqual(["💪", "🔥", "👏", "😂", "🫡"]);
  });

  it("toggle: crea y quita; varios emojis distintos del mismo usuario conviven", async () => {
    const ana = await user("Ana");
    const beto = await user("Beto");
    await prisma.follow.create({ data: { followerId: beto.id, followingId: ana.id } });
    const act = await activityOf(ana);
    await as(beto);

    const r1 = await toggleReactionAction(act.id, "💪");
    expect(r1.ok && r1.data.summary).toEqual([{ emoji: "💪", count: 1, mine: true, users: [{ id: beto.id, name: "Beto" }] }]);
    const r2 = await toggleReactionAction(act.id, "🔥");
    expect(r2.ok && r2.data.summary.map((s) => s.emoji)).toEqual(["💪", "🔥"]);
    expect(await prisma.reaction.count()).toBe(2);

    const r3 = await toggleReactionAction(act.id, "💪");
    expect(r3.ok && r3.data.summary).toEqual([{ emoji: "🔥", count: 1, mine: true, users: [{ id: beto.id, name: "Beto" }] }]);
    expect(await prisma.reaction.count()).toBe(1);
  });

  it("notifica al dueño al crear (no al quitar ni si reacciona el dueño)", async () => {
    const ana = await user("Ana");
    const beto = await user("Beto");
    await prisma.follow.create({ data: { followerId: beto.id, followingId: ana.id } });
    const act = await activityOf(ana);
    await as(beto);
    await toggleReactionAction(act.id, "👏");
    expect(notify).toHaveBeenCalledTimes(1);
    const arg = vi.mocked(notify).mock.calls[0][0];
    expect(arg).toMatchObject({ recipientIds: [ana.id], type: "reaction_received", actorId: beto.id, activityId: act.id, data: { emoji: "👏" } });
    expect(arg.dedupeKey(ana.id)).toBe(`reaction:${act.id}:${beto.id}:👏:${ana.id}`);
    await toggleReactionAction(act.id, "👏"); // quitar
    expect(notify).toHaveBeenCalledTimes(1);
    await as(ana);
    expect((await toggleReactionAction(act.id, "🔥")).ok).toBe(true); // el dueño puede reaccionar
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it("permisos: dueño, seguidor o grupo en común; un desconocido recibe FORBIDDEN", async () => {
    const ana = await user("Ana");
    const caro = await user("Caro");
    const zoe = await user("Zoe");
    const act = await activityOf(ana);
    const g = await prisma.group.create({ data: { name: "G" } });
    await prisma.groupMember.createMany({ data: [{ groupId: g.id, userId: ana.id, role: "admin" }, { groupId: g.id, userId: caro.id, role: "member" }] });

    await as(zoe);
    expect(await toggleReactionAction(act.id, "💪")).toMatchObject({ ok: false, error: "No tenés permiso para hacer esto." });
    await as(caro);
    expect((await toggleReactionAction(act.id, "💪")).ok).toBe(true);
    // si Caro deja el grupo, ya no puede
    await prisma.groupMember.update({ where: { groupId_userId: { groupId: g.id, userId: caro.id } }, data: { leftAt: new Date() } });
    expect((await toggleReactionAction(act.id, "🔥")).ok).toBe(false);
    await as(ana);
    expect((await toggleReactionAction(act.id, "🫡")).ok).toBe(true);
  });

  it("solo acepta emojis del set y actividades existentes", async () => {
    const ana = await user("Ana");
    const act = await activityOf(ana);
    await as(ana);
    expect((await toggleReactionAction(act.id, "🍕" as never)).ok).toBe(false);
    expect((await toggleReactionAction("nope", "💪")).ok).toBe(false);
    expect(await prisma.reaction.count()).toBe(0);
  });

  it("el resumen agrupa por emoji, en el orden del set, con 'mine' y usuarios", async () => {
    const ana = await user("Ana");
    const beto = await user("Beto");
    const caro = await user("Caro");
    const a1 = await activityOf(ana);
    const a2 = await activityOf(ana);
    const a3 = await activityOf(ana);
    const add = (activityId: string, userId: string, emoji: string) => prisma.reaction.create({ data: { activityId, userId, emoji } });
    // claves internas (ver EMOJI_KEYS)
    await add(a1.id, beto.id, "fire");
    await add(a1.id, caro.id, "fire");
    await add(a1.id, beto.id, "muscle");
    await add(a2.id, caro.id, "salute");

    const map = await getReactionSummaries([a1.id, a2.id, a3.id], beto.id);
    expect(map.get(a1.id)).toEqual([
      { emoji: "💪", count: 1, mine: true, users: [{ id: beto.id, name: "Beto" }] },
      { emoji: "🔥", count: 2, mine: true, users: [{ id: beto.id, name: "Beto" }, { id: caro.id, name: "Caro" }] },
    ]);
    expect(map.get(a2.id)).toEqual([{ emoji: "🫡", count: 1, mine: false, users: [{ id: caro.id, name: "Caro" }] }]);
    expect(map.get(a3.id)).toEqual([]);
  });
});
