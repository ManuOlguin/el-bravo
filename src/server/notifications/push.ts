/**
 * Canal push (D12). Hoy: Web Push con VAPID (`web-push`). La interfaz `PushTransport` queda lista para
 * que W4 agregue FCM (Android/iOS nativo con `Device.fcmToken`).
 *
 * - `notify()` dispara el envío inmediato (fire-and-forget, nunca rompe la escritura).
 * - El cron reintenta lo que quedó con `pushedAt = null` (últimas 24 h).
 * - 404/410 del push service = suscripción vencida → se borra el `Device`.
 */
import webpush from "web-push";
import { Prisma } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { loadPrefs } from "./preferences";
import { renderData } from "./queries";
import { renderNotification } from "./rules";

export type WebPushSubscription = { endpoint: string; keys: { p256dh: string; auth: string } };

/** Lo que recibe el service worker (`public/sw.js`). */
export type PushMessage = { title: string; body?: string; icon: string; badge: string; image?: string; tag?: string; href: string };

/** Envío por plataforma. Lanza un error con `statusCode` si el push service responde mal. */
export type PushTransport = {
  web(subscription: WebPushSubscription, payload: string): Promise<void>;
  // W4: fcm?(token: string, message: PushMessage): Promise<void>;
};

export type PushRunResult = { disabled: boolean; notifications: number; delivered: number; failed: number; devicesRemoved: number };

const RETRY_WINDOW_MS = 24 * 3_600_000;

export function isPushEnabled(): boolean {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let vapidConfigured = false;
function defaultTransport(): PushTransport | null {
  if (!isPushEnabled()) return null;
  if (!vapidConfigured) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
    vapidConfigured = true;
  }
  return {
    async web(subscription, payload) {
      await webpush.sendNotification(subscription, payload, { TTL: 24 * 3600, urgency: "normal" });
    },
  };
}

function isSubscription(v: unknown): v is WebPushSubscription {
  const s = v as WebPushSubscription | null;
  return !!s && typeof s.endpoint === "string" && typeof s.keys?.p256dh === "string" && typeof s.keys?.auth === "string";
}

function statusOf(e: unknown): number | null {
  const code = (e as { statusCode?: unknown } | null)?.statusCode;
  return typeof code === "number" ? code : null;
}

const rowSelect = {
  id: true,
  type: true,
  recipientId: true,
  actorId: true,
  groupId: true,
  seasonId: true,
  activityId: true,
  data: true,
  actor: { select: { id: true, name: true, photoUrl: true } },
  group: { select: { name: true } },
  season: { select: { name: true } },
  activity: { select: { media: { where: { status: "ready" }, orderBy: { position: "asc" }, take: 1, select: { thumbUrl: true, url: true } } } },
} satisfies Prisma.NotificationSelect;

/** Envía las notificaciones que cumplen `where` (y siguen sin enviar) a todos los dispositivos del destinatario. */
export async function sendPushFor(
  where: Prisma.NotificationWhereInput,
  opts: { transport?: PushTransport | null; now?: Date } = {}
): Promise<PushRunResult> {
  const transport = opts.transport === undefined ? defaultTransport() : opts.transport;
  const result: PushRunResult = { disabled: !transport, notifications: 0, delivered: 0, failed: 0, devicesRemoved: 0 };
  if (!transport) return result;

  const rows = await prisma.notification.findMany({
    where: { ...where, pushedAt: null, readAt: null, type: { not: "weekly_digest" } },
    orderBy: { createdAt: "asc" },
    take: 200,
    select: rowSelect,
  });
  if (!rows.length) return result;

  const recipientIds = [...new Set(rows.map((r) => r.recipientId))];
  const [prefs, devices] = await Promise.all([
    loadPrefs(recipientIds, [...new Set(rows.map((r) => r.type))]),
    prisma.device.findMany({
      where: { userId: { in: recipientIds }, pushSubscription: { not: Prisma.DbNull } },
      select: { id: true, userId: true, pushSubscription: true },
    }),
  ]);
  const byUser = new Map<string, { id: string; sub: WebPushSubscription }[]>();
  for (const d of devices) {
    if (!isSubscription(d.pushSubscription)) continue;
    const list = byUser.get(d.userId) ?? [];
    list.push({ id: d.id, sub: d.pushSubscription });
    byUser.set(d.userId, list);
  }
  const removed = new Set<string>();

  for (const row of rows) {
    const targets = (byUser.get(row.recipientId) ?? []).filter((d) => !removed.has(d.id));
    if (!targets.length || !prefs(row.recipientId, row.type).push) continue;
    // Reclamo atómico: el envío inmediato y el cron nunca mandan la misma notificación dos veces.
    const claimed = await prisma.notification.updateMany({ where: { id: row.id, pushedAt: null }, data: { pushedAt: opts.now ?? new Date() } });
    if (claimed.count === 0) continue;
    result.notifications++;

    const r = renderNotification(row.type, renderData(row), row.recipientId);
    const media = row.activity?.media[0];
    const message: PushMessage = {
      title: `${r.icon} ${r.title}`,
      ...(r.body ? { body: r.body } : {}),
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      ...(media ? { image: media.thumbUrl ?? media.url } : {}),
      // Las reacciones a un mismo entrenamiento se reemplazan en la bandeja del sistema.
      tag: row.type === "reaction_received" && row.activityId ? `reaction:${row.activityId}` : row.id,
      href: r.href,
    };
    const payload = JSON.stringify(message);

    let ok = 0;
    let retryable = 0;
    for (const d of targets) {
      try {
        await transport.web(d.sub, payload);
        ok++;
      } catch (e) {
        const status = statusOf(e);
        if (status === 404 || status === 410) {
          removed.add(d.id);
          await prisma.device.deleteMany({ where: { id: d.id } });
          result.devicesRemoved++;
        } else {
          retryable++;
          console.error("[push] falló el envío", row.id, status ?? e);
        }
      }
    }
    result.delivered += ok;
    if (ok === 0 && retryable > 0) {
      result.failed++;
      await prisma.notification.updateMany({ where: { id: row.id }, data: { pushedAt: null } }); // reintenta el cron
    }
  }
  return result;
}

/** Para el cron: reintenta las de las últimas 24 h que quedaron sin enviar. */
export async function sendPendingPush(now: Date = new Date(), opts: { transport?: PushTransport | null } = {}): Promise<PushRunResult> {
  return sendPushFor({ createdAt: { gte: new Date(now.getTime() - RETRY_WINDOW_MS), lte: now } }, { ...opts, now });
}

export type PushDeviceView = { id: string; platform: "web" | "android" | "ios"; label: string | null; lastSeenAt: string; createdAt: string };

/** Dispositivos con push del usuario (para la lista de ajustes). */
export async function listPushDevices(userId: string): Promise<PushDeviceView[]> {
  const rows = await prisma.device.findMany({
    where: { userId, OR: [{ pushSubscription: { not: Prisma.DbNull } }, { fcmToken: { not: null } }] },
    orderBy: { lastSeenAt: "desc" },
    select: { id: true, platform: true, label: true, lastSeenAt: true, createdAt: true },
  });
  return rows.map((d) => ({ ...d, lastSeenAt: d.lastSeenAt.toISOString(), createdAt: d.createdAt.toISOString() }));
}

// --- Envío inmediato desde notify() ---

/** En tests (NODE_ENV=test) el envío automático está apagado para no dejar queries colgadas entre tests. */
let autoDispatch = process.env.NODE_ENV !== "test";
const inflight = new Set<Promise<unknown>>();

export function setPushAutoDispatch(on: boolean) {
  autoDispatch = on;
}

/** Espera los envíos en curso (tests y scripts). */
export async function flushPush(): Promise<void> {
  await Promise.allSettled([...inflight]);
}

/** Fire-and-forget: nunca lanza ni demora a quien llama. */
export function dispatchPush(dedupeKeys: string[]): void {
  if (!autoDispatch || !dedupeKeys.length || !isPushEnabled()) return;
  const p = sendPushFor({ dedupeKey: { in: dedupeKeys } })
    .catch((e) => console.error("[push]", e))
    .finally(() => inflight.delete(p));
  inflight.add(p);
}
