/** Lecturas y marcas de lectura del feed in-app (campana, /notifications, "Novedades"). */
import type { NotificationType, Prisma } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { renderNotification } from "./rules";

export type NotificationView = {
  id: string;
  type: NotificationType;
  icon: string;
  title: string;
  body?: string;
  href: string;
  emphasis: string[];
  createdAt: string; // ISO
  read: boolean;
  actor: { id: string; name: string | null; photoUrl: string | null } | null;
};

/** El resumen semanal es un registro técnico del envío por email: nunca se muestra en la UI. */
const VISIBLE = { type: { not: "weekly_digest" } } satisfies Prisma.NotificationWhereInput;

const rowSelect = {
  id: true,
  type: true,
  actorId: true,
  groupId: true,
  seasonId: true,
  activityId: true,
  data: true,
  readAt: true,
  createdAt: true,
  actor: { select: { id: true, name: true, photoUrl: true } },
  group: { select: { name: true } },
  season: { select: { name: true } },
} satisfies Prisma.NotificationSelect;

type Row = Prisma.NotificationGetPayload<{ select: typeof rowSelect }>;

/** Datos para `renderNotification`: el JSON guardado + ids de la fila + nombres actuales (pisan a los guardados). */
export function renderData(row: Pick<Row, "data" | "actorId" | "groupId" | "seasonId" | "activityId" | "actor" | "group" | "season">) {
  const stored = row.data && typeof row.data === "object" && !Array.isArray(row.data) ? (row.data as Record<string, unknown>) : {};
  return {
    ...stored,
    actorId: row.actorId,
    groupId: row.groupId,
    seasonId: row.seasonId,
    activityId: row.activityId,
    ...(row.actor ? { actorName: row.actor.name } : {}),
    ...(row.group ? { groupName: row.group.name } : {}),
    ...(row.season ? { seasonName: row.season.name } : {}),
  };
}

function toView(row: Row, viewerId: string, extra: Record<string, unknown> = {}): NotificationView {
  const r = renderNotification(row.type, { ...renderData(row), ...extra }, viewerId);
  return {
    id: row.id,
    type: row.type,
    icon: r.icon,
    title: r.title,
    ...(r.body ? { body: r.body } : {}),
    href: r.href,
    emphasis: r.emphasis,
    createdAt: row.createdAt.toISOString(),
    read: !!row.readAt,
    actor: row.actor,
  };
}

export async function unreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { recipientId: userId, readAt: null, ...VISIBLE } });
}

/** Página de notificaciones (más nuevas primero). `cursor` = id de la última fila de la página anterior. */
export async function listNotifications(
  userId: string,
  opts: { cursor?: string | null; limit?: number } = {}
): Promise<{ items: NotificationView[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);
  const rows = await prisma.notification.findMany({
    where: { recipientId: userId, ...VISIBLE },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    select: rowSelect,
  });
  const page = rows.slice(0, limit);
  const groups = await reactionGroups(userId, page);
  const items: NotificationView[] = [];
  for (const r of page) {
    const g = r.type === "reaction_received" && !r.readAt && r.activityId ? groups.get(r.activityId) : undefined;
    if (!g) items.push(toView(r, userId));
    else if (g.newestId === r.id) items.push(toView(r, userId, { othersCount: g.count - 1 }));
    // las demás reacciones no leídas del mismo entrenamiento quedan dentro del grupo
  }
  return { items, nextCursor: rows.length > limit ? page[page.length - 1].id : null };
}

/** Más de 3 reacciones no leídas sobre el mismo entrenamiento se muestran como un solo ítem ("Lucio y 3 más…"). */
export const REACTION_GROUP_MIN = 4;

async function reactionGroups(userId: string, page: Row[]): Promise<Map<string, { newestId: string; count: number }>> {
  const activityIds = [...new Set(page.filter((r) => r.type === "reaction_received" && !r.readAt && r.activityId).map((r) => r.activityId!))];
  const out = new Map<string, { newestId: string; count: number }>();
  if (!activityIds.length) return out;
  const unread = await prisma.notification.findMany({
    where: { recipientId: userId, type: "reaction_received", readAt: null, activityId: { in: activityIds } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true, activityId: true },
  });
  for (const u of unread) {
    const g = out.get(u.activityId!);
    if (g) g.count++;
    else out.set(u.activityId!, { newestId: u.id, count: 1 });
  }
  for (const [k, g] of out) if (g.count < REACTION_GROUP_MIN) out.delete(k);
  return out;
}

/** Marca una como leída. Si es una reacción, marca todas las reacciones no leídas de ese entrenamiento (el grupo). */
export async function markRead(userId: string, id: string, now: Date = new Date()): Promise<void> {
  const n = await prisma.notification.findFirst({ where: { id, recipientId: userId }, select: { type: true, activityId: true } });
  if (!n) return;
  const where: Prisma.NotificationWhereInput =
    n.type === "reaction_received" && n.activityId
      ? { recipientId: userId, type: "reaction_received", activityId: n.activityId, readAt: null }
      : { id, recipientId: userId, readAt: null };
  await prisma.notification.updateMany({ where, data: { readAt: now } });
}

export async function markAllRead(userId: string, now: Date = new Date()): Promise<number> {
  const { count } = await prisma.notification.updateMany({ where: { recipientId: userId, readAt: null }, data: { readAt: now } });
  return count;
}
