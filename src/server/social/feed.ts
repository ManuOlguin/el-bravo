import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { followingIds } from "./follows";
import { getReactionSummaries } from "./reactions";
import type { ReactionSummary } from "./reaction-types";

export type FeedItem = {
  activityId: string;
  user: { id: string; name: string | null; photoUrl: string | null };
  categoryName: string;
  startedAt: Date;
  durationMinutes: number;
  thumbUrl: string | null;
  photoUrl: string | null;
  reactions: ReactionSummary;
};

const feedSelect = {
  id: true,
  startedAt: true,
  durationMinutes: true,
  user: { select: { id: true, name: true, photoUrl: true } },
  activityCategory: { select: { name: true } },
  media: { where: { status: "ready" }, orderBy: [{ position: "asc" }, { uploadedAt: "asc" }], take: 1, select: { url: true, thumbUrl: true } },
} satisfies Prisma.ActivitySelect; // sin `notes` a propósito

type Row = Prisma.ActivityGetPayload<{ select: typeof feedSelect }>;

async function toItems(rows: Row[], viewerId: string): Promise<FeedItem[]> {
  const reactions = await getReactionSummaries(
    rows.map((r) => r.id),
    viewerId
  );
  return rows.map((r) => ({
    activityId: r.id,
    user: r.user,
    categoryName: r.activityCategory.name,
    startedAt: r.startedAt,
    durationMinutes: r.durationMinutes,
    thumbUrl: r.media[0]?.thumbUrl ?? null,
    photoUrl: r.media[0]?.url ?? null,
    reactions: reactions.get(r.id) ?? [],
  }));
}

/** Cursor opaco "<startedAt ISO>|<id>". */
function encodeCursor(r: { startedAt: Date; id: string }) {
  return `${r.startedAt.toISOString()}|${r.id}`;
}
function decodeCursor(cursor: string | undefined): { startedAt: Date; id: string } | null {
  if (!cursor) return null;
  const i = cursor.indexOf("|");
  if (i < 0) return null;
  const startedAt = new Date(cursor.slice(0, i));
  const id = cursor.slice(i + 1);
  return Number.isNaN(startedAt.getTime()) || !id ? null : { startedAt, id };
}

/** Actividades de la gente que el viewer SIGUE + las propias, por `startedAt` desc. Nunca expone notas. */
export async function getFriendsFeed(
  viewerId: string,
  opts: { cursor?: string; limit?: number }
): Promise<{ items: FeedItem[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);
  const authors = [viewerId, ...(await followingIds(viewerId))];
  const c = decodeCursor(opts.cursor);
  const rows = await prisma.activity.findMany({
    where: {
      userId: { in: authors },
      user: { isActive: true },
      ...(c ? { OR: [{ startedAt: { lt: c.startedAt } }, { startedAt: c.startedAt, id: { lt: c.id } }] } : {}),
    },
    orderBy: [{ startedAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: feedSelect,
  });
  const page = rows.slice(0, limit);
  return {
    items: await toItems(page, viewerId),
    nextCursor: rows.length > limit ? encodeCursor(page[page.length - 1]) : null,
  };
}

/** Últimas actividades CON FOTO de la gente que el viewer sigue (sin las propias). Para el widget (W4). */
export async function getFriendsLatestWithPhoto(viewerId: string, limit: number): Promise<FeedItem[]> {
  const authors = await followingIds(viewerId);
  if (authors.length === 0) return [];
  const rows = await prisma.activity.findMany({
    where: { userId: { in: authors }, user: { isActive: true }, media: { some: { status: "ready" } } },
    orderBy: [{ startedAt: "desc" }, { id: "desc" }],
    take: Math.min(Math.max(limit, 1), 50),
    select: feedSelect,
  });
  return toItems(rows, viewerId);
}
