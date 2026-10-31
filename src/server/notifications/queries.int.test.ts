import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetDb, prisma } from "@/tests/setup/db";
import { cookieJar, resetNextMocks } from "@/src/server/account/testing/next-mocks";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", async () => (await import("@/src/server/account/testing/next-mocks")).nextHeadersMock);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { SESSION_COOKIE, signSessionToken } from "@/src/server/auth/session";
import {
  listNotificationsAction,
  markAllReadAction,
  markReadAction,
  unreadCountAction,
  updatePreferenceAction,
} from "@/src/server/actions/notifications";
import { notify } from "./notify";
import { getUserPreferences } from "./preferences";

async function user(name: string) {
  return prisma.user.create({ data: { email: `${name.toLowerCase()}@t.com`, passwordHash: "x", name } });
}
async function as(u: { id: string; email: string }) {
  cookieJar.set(SESSION_COOKIE, await signSessionToken({ userId: u.id, email: u.email, ver: 0 }));
}

describe("acciones de notificaciones", () => {
  beforeEach(async () => {
    await resetDb();
    resetNextMocks();
  });

  it("sin sesión: error de auth", async () => {
    const r = await unreadCountAction();
    expect(r.ok).toBe(false);
  });

  it("contador, lista (sin weekly_digest), marcar una y todas", async () => {
    const manu = await user("Manu");
    const ana = await user("Ana");
    const g = await prisma.group.create({ data: { name: "Los Bravos" } });
    await notify({ recipientIds: [manu.id], type: "new_follower", actorId: ana.id, dedupeKey: (r) => `f:${r}` });
    await notify({ recipientIds: [manu.id], type: "member_joined", actorId: ana.id, groupId: g.id, dedupeKey: (r) => `j:${r}` });
    await prisma.notification.create({ data: { recipientId: manu.id, type: "weekly_digest", dedupeKey: "digest:x", emailedAt: new Date() } });
    await as(manu);

    expect(await unreadCountAction()).toEqual({ ok: true, data: 2 });
    const list = await listNotificationsAction();
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.data.items.map((i) => i.title).sort()).toEqual(["Ana empezó a seguirte", "Ana se unió a Los Bravos"]);
    expect(list.data.items.every((i) => !i.read)).toBe(true);
    expect(list.data.items.find((i) => i.type === "member_joined")?.href).toBe(`/group/${g.id}`);

    const first = list.data.items[0];
    expect(await markReadAction(first.id)).toEqual({ ok: true, data: { unread: 1 } });
    expect((await markAllReadAction()).ok).toBe(true);
    expect(await unreadCountAction()).toEqual({ ok: true, data: 0 });
  });

  it("no se pueden marcar notificaciones ajenas", async () => {
    const manu = await user("Manu");
    const ana = await user("Ana");
    await notify({ recipientIds: [ana.id], type: "new_follower", actorId: manu.id, dedupeKey: (r) => `f:${r}` });
    const n = await prisma.notification.findFirstOrThrow();
    await as(manu);
    await markReadAction(n.id);
    expect((await prisma.notification.findFirstOrThrow()).readAt).toBeNull();
  });

  it("preferencias: defaults (D9), cambio de un canal conserva los otros, resumen semanal y validación", async () => {
    const manu = await user("Manu");
    await as(manu);
    const { rows, weeklyDigest } = await getUserPreferences(manu.id);
    expect(weeklyDigest).toBe(true);
    expect(rows.find((r) => r.type === "new_follower")).toMatchObject({ inApp: true, email: true, push: true });
    expect(rows.find((r) => r.type === "rank_overtaken")).toMatchObject({ inApp: true, email: false, push: true });
    expect(rows.some((r) => (r.type as string) === "weekly_digest")).toBe(false);

    expect(await updatePreferenceAction({ type: "new_follower", channel: "push", value: false })).toEqual({
      ok: true,
      data: { inApp: true, email: true, push: false },
    });
    expect((await updatePreferenceAction({ type: "weekly_digest", channel: "email", value: false })).ok).toBe(true);
    expect((await getUserPreferences(manu.id)).weeklyDigest).toBe(false);
    expect((await updatePreferenceAction({ type: "weekly_digest", channel: "inApp", value: true })).ok).toBe(false);
    expect((await updatePreferenceAction({ type: "nope", channel: "email", value: true })).ok).toBe(false);
  });

  it("paginación por cursor", async () => {
    const manu = await user("Manu");
    for (let i = 0; i < 5; i++) {
      await prisma.notification.create({
        data: { recipientId: manu.id, type: "new_follower", dedupeKey: `p:${i}`, createdAt: new Date(Date.UTC(2026, 10, 1, i)) },
      });
    }
    await as(manu);
    const p1 = await listNotificationsAction(null, 2);
    expect(p1.ok && p1.data.items.length).toBe(2);
    if (!p1.ok) return;
    const p2 = await listNotificationsAction(p1.data.nextCursor, 2);
    const p3 = p2.ok ? await listNotificationsAction(p2.data.nextCursor, 2) : null;
    const all = [...p1.data.items, ...(p2.ok ? p2.data.items : []), ...(p3?.ok ? p3.data.items : [])];
    expect(new Set(all.map((i) => i.id)).size).toBe(5);
    expect(p3?.ok && p3.data.nextCursor).toBeNull();
  });
});
