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

function toView(row: Row, viewerId: string): NotificationView {
  const r = renderNotification(row.type, renderData(row), viewerId);
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
  return {
    items: page.map((r) => toView(r, userId)),
    nextCursor: rows.length > limit ? page[page.length - 1].id : null,
  };
}

export async function markRead(userId: string, id: string, now: Date = new Date()): Promise<void> {
  await prisma.notification.updateMany({ where: { id, recipientId: userId, readAt: null }, data: { readAt: now } });
}

export async function markAllRead(userId: string, now: Date = new Date()): Promise<number> {
  const { count } = await prisma.notification.updateMany({ where: { recipientId: userId, readAt: null }, data: { readAt: now } });
  return count;
}
