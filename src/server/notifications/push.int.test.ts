import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { resetDb, prisma } from "@/tests/setup/db";
import { cookieJar, resetNextMocks } from "@/src/server/account/testing/next-mocks";

const { sendNotification, setVapidDetails } = vi.hoisted(() => ({ sendNotification: vi.fn(), setVapidDetails: vi.fn() }));
vi.mock("web-push", () => ({ default: { sendNotification, setVapidDetails } }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", async () => (await import("@/src/server/account/testing/next-mocks")).nextHeadersMock);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { SESSION_COOKIE, signSessionToken } from "@/src/server/auth/session";
import { registerWebPushAction, unregisterDeviceAction, unregisterWebPushAction } from "@/src/server/actions/devices";
import { createActivity } from "@/src/server/activities/service";
import { toggleReaction } from "@/src/server/social/reactions";
import { listNotifications, markRead } from "./queries";
import { notify } from "./notify";
import { flushPush, sendPendingPush, setPushAutoDispatch } from "./push";

const TZ = "America/Argentina/Buenos_Aires";
const NOW = new Date("2026-11-04T18:00:00Z");

async function user(name: string) {
  return prisma.user.create({ data: { email: `${name.toLowerCase()}@t.com`, passwordHash: "x", name, timezone: TZ } });
}
async function as(u: { id: string; email: string }) {
  cookieJar.set(SESSION_COOKIE, await signSessionToken({ userId: u.id, email: u.email, ver: 0 }));
}
const sub = (n: number) => ({ endpoint: `https://push.example.com/send/${n}`, keys: { p256dh: `p256-${n}`, auth: `auth-${n}` } });
async function device(userId: string, n: number) {
  return prisma.device.create({ data: { userId, platform: "web", pushEndpointHash: `h${n}`, pushSubscription: sub(n) } });
}
const statusError = (statusCode: number) => Object.assign(new Error(`status ${statusCode}`), { statusCode });

describe("push web (web-push mockeado)", () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    await resetDb();
    resetNextMocks();
    sendNotification.mockReset();
    sendNotification.mockResolvedValue({ statusCode: 201 });
    setPushAutoDispatch(true);
  });
  afterEach(async () => {
    await flushPush();
    setPushAutoDispatch(false);
    vi.useRealTimers();
  });

  it("notify dispara el push inmediato a todos los dispositivos y marca pushedAt", async () => {
    const manu = await user("Manu");
    const ana = await user("Ana");
    await device(manu.id, 1);
    await device(manu.id, 2);
    await notify({ recipientIds: [manu.id], type: "new_follower", actorId: ana.id, dedupeKey: (r) => `f:${r}` });
    await flushPush();
    expect(sendNotification).toHaveBeenCalledTimes(2);
    const [s, payload] = sendNotification.mock.calls[0];
    expect(s).toEqual(sub(1));
    expect(JSON.parse(payload)).toMatchObject({ title: "👋 Ana empezó a seguirte", href: `/u/${ana.id}`, icon: "/icons/icon-192.png" });
    expect((await prisma.notification.findFirstOrThrow()).pushedAt).toEqual(expect.any(Date));
    // el cron no lo vuelve a mandar
    await sendPendingPush(NOW);
    expect(sendNotification).toHaveBeenCalledTimes(2);
  });

  it("la imagen es la miniatura de la primera foto de la actividad", async () => {
    const manu = await user("Manu");
    const ana = await user("Ana");
    await device(ana.id, 1);
    const cat = await prisma.activityCategory.create({ data: { slug: "gym", name: "Gimnasio" } });
    const act = await prisma.activity.create({ data: { userId: manu.id, activityCategoryId: cat.id, startedAt: NOW, durationMinutes: 30 } });
    await prisma.activityMedia.createMany({
      data: [
        { activityId: act.id, url: "https://cdn/b.webp", thumbUrl: "https://cdn/b-400.webp", position: 1 },
        { activityId: act.id, url: "https://cdn/a.webp", thumbUrl: "https://cdn/a-400.webp", position: 0 },
      ],
    });
    await notify({ recipientIds: [ana.id], type: "friend_workout", actorId: manu.id, activityId: act.id, dedupeKey: (r) => `fw:${r}` });
    await flushPush();
    expect(JSON.parse(sendNotification.mock.calls[0][1])).toMatchObject({ image: "https://cdn/a-400.webp", href: `/workout/${act.id}` });
  });

  it("410/404 borra el dispositivo vencido; los demás reciben", async () => {
    const manu = await user("Manu");
    const ana = await user("Ana");
    const gone = await device(manu.id, 1);
    await device(manu.id, 2);
    sendNotification.mockImplementation(async (s: { endpoint: string }) => {
      if (s.endpoint.endsWith("/1")) throw statusError(410);
      return { statusCode: 201 };
    });
    await notify({ recipientIds: [manu.id], type: "new_follower", actorId: ana.id, dedupeKey: (r) => `f:${r}` });
    await flushPush();
    expect(await prisma.device.findUnique({ where: { id: gone.id } })).toBeNull();
    expect(await prisma.device.count()).toBe(1);
  });

  it("push=false no envía", async () => {
    const manu = await user("Manu");
    const ana = await user("Ana");
    await device(manu.id, 1);
    await prisma.notificationPreference.create({ data: { userId: manu.id, type: "new_follower", push: false } });
    await notify({ recipientIds: [manu.id], type: "new_follower", actorId: ana.id, dedupeKey: (r) => `f:${r}` });
    await flushPush();
    await sendPendingPush(NOW);
    expect(sendNotification).not.toHaveBeenCalled();
    expect(await prisma.notification.count()).toBe(1); // in-app sigue
  });

  it("si el push service falla (500), pushedAt vuelve a null y el cron reintenta", async () => {
    const manu = await user("Manu");
    const ana = await user("Ana");
    await device(manu.id, 1);
    sendNotification.mockRejectedValueOnce(statusError(500));
    await notify({ recipientIds: [manu.id], type: "new_follower", actorId: ana.id, dedupeKey: (r) => `f:${r}` });
    await flushPush();
    expect((await prisma.notification.findFirstOrThrow()).pushedAt).toBeNull();
    const r = await sendPendingPush(NOW);
    expect(r).toMatchObject({ notifications: 1, delivered: 1 });
    expect(sendNotification).toHaveBeenCalledTimes(2);
  });

  it("sin claves VAPID el canal queda apagado", async () => {
    const prev = process.env.VAPID_PRIVATE_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    try {
      const manu = await user("Manu");
      await device(manu.id, 1);
      await notify({ recipientIds: [manu.id], type: "new_follower", dedupeKey: (r) => `f:${r}` });
      await flushPush();
      expect(await sendPendingPush(NOW)).toMatchObject({ disabled: true });
      expect(sendNotification).not.toHaveBeenCalled();
    } finally {
      process.env.VAPID_PRIVATE_KEY = prev;
    }
  });

  it("acciones de dispositivos: registrar (dedupe por endpoint, reasigna), quitar", async () => {
    const manu = await user("Manu");
    const ana = await user("Ana");
    await as(manu);
    const r1 = await registerWebPushAction(sub(7), "Chrome");
    expect(r1.ok).toBe(true);
    const r2 = await registerWebPushAction(sub(7));
    expect(r2.ok && r1.ok && r2.data.deviceId).toBe(r1.ok && r1.data.deviceId);
    expect(await prisma.device.count()).toBe(1);
    expect((await registerWebPushAction({ endpoint: "http://insecure.example.com", keys: { p256dh: "a", auth: "b" } })).ok).toBe(false);
    expect((await registerWebPushAction({ nope: true })).ok).toBe(false);

    await as(ana); // mismo navegador, otra cuenta
    await registerWebPushAction(sub(7));
    expect((await prisma.device.findFirstOrThrow()).userId).toBe(ana.id);

    await as(manu);
    const dev = await prisma.device.findFirstOrThrow();
    await unregisterDeviceAction(dev.id); // no es suyo: no hace nada
    expect(await prisma.device.count()).toBe(1);
    await as(ana);
    await unregisterWebPushAction(sub(7).endpoint);
    expect(await prisma.device.count()).toBe(0);
  });
});

describe("amigos y reacciones (integración)", () => {
  let catId: string;
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    await resetDb();
    sendNotification.mockReset();
    setPushAutoDispatch(false);
    catId = (await prisma.activityCategory.create({ data: { slug: "run", name: "Running" } })).id;
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  const train = (userId: string, localDate = "2026-11-04", localTime = "14:00") =>
    createActivity(userId, { clientRequestId: randomUUID(), activityCategoryId: catId, localDate, localTime, durationMinutes: 45, exercises: [] });
  async function friends(a: string, b: string) {
    await prisma.follow.createMany({ data: [{ followerId: a, followingId: b }, { followerId: b, followingId: a }] });
  }

  it("friend_workout: un amigo fuera del grupo recibe; un compañero de grupo no; solo seguidor no; throttle de 2 h", async () => {
    const manu = await user("Manu");
    const caro = await user("Caro"); // amiga, sin grupo en común
    const lucio = await user("Lucio"); // amigo y compañero de grupo
    const zoe = await user("Zoe"); // solo sigue a Manu
    await friends(manu.id, caro.id);
    await friends(manu.id, lucio.id);
    await prisma.follow.create({ data: { followerId: zoe.id, followingId: manu.id } });
    await prisma.group.create({
      data: { name: "Los Bravos", timezone: TZ, members: { create: [{ userId: manu.id, role: "admin" }, { userId: lucio.id, role: "member" }] } },
    });

    const { activityId } = await train(manu.id);
    let rows = await prisma.notification.findMany({ where: { type: "friend_workout" } });
    expect(rows.map((r) => r.recipientId)).toEqual([caro.id]);
    expect(rows[0]).toMatchObject({ actorId: manu.id, activityId, dedupeKey: `friend_workout:${manu.id}:${caro.id}:2026-11-04T18` });

    await train(manu.id, "2026-11-04", "14:30"); // misma ventana de 2 h
    rows = await prisma.notification.findMany({ where: { type: "friend_workout" } });
    expect(rows).toHaveLength(1);

    vi.setSystemTime(new Date(NOW.getTime() + 2 * 3600_000)); // ventana siguiente
    await train(manu.id, "2026-11-04", "16:00");
    expect(await prisma.notification.count({ where: { type: "friend_workout" } })).toBe(2);

    const list = await listNotifications(caro.id);
    expect(list.items[0]).toMatchObject({ title: "Manu entrenó", body: "Running · 45 min" });
  });

  it("reacciones: notifican al dueño y se agrupan con más de 3 sin leer; abrir una marca el grupo", async () => {
    const manu = await user("Manu");
    const reactors = await Promise.all(["Ana", "Beto", "Caro", "Dani"].map(user));
    for (const r of reactors) await prisma.follow.create({ data: { followerId: r.id, followingId: manu.id } });
    const act = await prisma.activity.create({ data: { userId: manu.id, activityCategoryId: catId, startedAt: NOW, durationMinutes: 30 } });

    await toggleReaction(reactors[0].id, act.id, "💪");
    await toggleReaction(reactors[1].id, act.id, "🔥");
    await toggleReaction(reactors[2].id, act.id, "👏");
    let list = await listNotifications(manu.id);
    expect(list.items).toHaveLength(3); // 3 o menos: una por una
    expect(list.items.map((i) => i.title)).toContain("Ana reaccionó 💪 a tu entrenamiento");

    vi.setSystemTime(new Date(NOW.getTime() + 60_000));
    await toggleReaction(reactors[3].id, act.id, "🫡");
    list = await listNotifications(manu.id);
    expect(list.items).toHaveLength(1);
    expect(list.items[0]).toMatchObject({ icon: "🫡", title: "Dani y 3 más reaccionaron a tu entrenamiento", href: `/workout/${act.id}` });

    await markRead(manu.id, list.items[0].id);
    expect(await prisma.notification.count({ where: { recipientId: manu.id, readAt: null } })).toBe(0);
    list = await listNotifications(manu.id);
    expect(list.items).toHaveLength(4); // leídas: ya no se agrupan
  });
});
