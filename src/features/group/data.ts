import "server-only";
/**
 * Datos de la página de grupo (W2-2 Task 1). Un DTO tipado y sin datos sensibles (nunca `inviteCode`,
 * emails ni notas de entrenamientos). Las stats salen de `SeasonStanding` (motor W1-1), sin truncar.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { addDays, daysInWeekWithin, localDateOf, weekKeyOfLocalDate, zonedToUtc } from "@/src/lib/time";
import { getGroupForMember, type GroupDTO } from "@/src/server/groups/queries";
import { getActivityPoints, getSeasonStandings, type StandingRow } from "@/src/server/scoring";
import { SCORE_REASON } from "@/src/server/scoring/compute";
import { finalizeSeasonIfDue } from "@/src/server/seasons/lifecycle";
import { getReactionSummaries } from "@/src/server/social/reactions";
import type { ReactionSummary } from "@/src/server/social/reaction-types";
import { seasonSummarySelect, toSeasonSummary, type SeasonSummaryRow } from "@/src/features/season/summary";
import { awaitingResults, resultsVisible, type SeasonSummary } from "@/src/features/season/types";

export type { SeasonSummary } from "@/src/features/season/types";

export type PastSeasonSummary = SeasonSummary & {
  winners: { userId: string; name: string | null; photoUrl: string | null; points: number }[];
};

export type MyWeek = {
  weekKey: string;
  daysTrained: number;
  target: number;
  /** Lunes a domingo, en la zona del grupo. `count` = entrenamientos cargados; `counted` = el día suma en la temporada. */
  days: { date: string; count: number; counted: boolean }[];
};

export type GroupFeedItem = {
  id: string;
  user: { id: string; name: string | null; photoUrl: string | null };
  categoryName: string;
  startedAt: Date;
  durationMinutes: number;
  /** Puntos en la temporada de ESTE grupo donde cayó (null si no puntuó en ninguna). */
  points: number | null;
  photoUrl: string | null;
  thumbUrl: string | null;
  reactions: ReactionSummary;
};

export type GroupFeedPage = { items: GroupFeedItem[]; nextCursor: string | null };

export type GroupPageData = {
  group: GroupDTO;
  viewer: { id: string; role: "admin" | "member"; timezone: string };
  current: SeasonSummary | null; // activa, o terminada sin publicar
  upcoming: SeasonSummary | null;
  past: PastSeasonSummary[]; // finalizadas y publicadas, más recientes primero
  standings: StandingRow[]; // de `current` (vacío si no hay o si el viewer todavía no puede ver resultados)
  myWeek: MyWeek | null;
  feed: GroupFeedPage;
};

const FEED_PAGE = 20;

async function loadSeasons(groupId: string) {
  return prisma.season.findMany({ where: { groupId }, select: seasonSummarySelect, orderBy: [{ startDate: "desc" }, { id: "asc" }] });
}

/** Respaldo del cron (D3): finaliza las temporadas `auto` que ya terminaron. Devuelve si cambió algo. */
async function finalizeDue(rows: SeasonSummaryRow[], timezone: string, viewerId: string, now: Date) {
  let changed = false;
  for (const row of rows) {
    if (row.finalizedAt || row.resultsReveal !== "auto") continue;
    if (toSeasonSummary(row, viewerId, timezone, now).status !== "ended") continue;
    if (await finalizeSeasonIfDue(row.id, now)) changed = true;
  }
  return changed;
}

/** Clasifica las temporadas de un grupo (puro sobre los resúmenes). */
export function classifySeasons(seasons: SeasonSummary[]) {
  const byEndDesc = (a: SeasonSummary, b: SeasonSummary) => b.endDate.localeCompare(a.endDate) || a.id.localeCompare(b.id);
  const active = seasons.find((s) => s.status === "active") ?? null;
  const pending = seasons.filter(awaitingResults).sort(byEndDesc)[0] ?? null;
  const upcoming =
    seasons.filter((s) => s.status === "upcoming").sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id))[0] ?? null;
  const past = seasons.filter(resultsVisible).sort(byEndDesc);
  return { current: active ?? pending, upcoming, past };
}

async function getMyWeek(current: SeasonSummary, viewerId: string, timezone: string, now: Date): Promise<MyWeek> {
  const weekKey = weekKeyOfLocalDate(localDateOf(now, timezone));
  const dates = Array.from({ length: 7 }, (_, i) => addDays(weekKey, i));
  const [activities, entries] = await Promise.all([
    prisma.activity.findMany({
      where: { userId: viewerId, startedAt: { gte: zonedToUtc(weekKey, "00:00", timezone), lt: zonedToUtc(addDays(weekKey, 7), "00:00", timezone) } },
      select: { startedAt: true },
    }),
    prisma.scoreEntry.findMany({
      where: { seasonId: current.id, userId: viewerId, kind: "workout", weekKey },
      select: { reason: true, detail: true },
    }),
  ]);
  const count = new Map<string, number>();
  for (const a of activities) {
    const d = localDateOf(a.startedAt, timezone);
    count.set(d, (count.get(d) ?? 0) + 1);
  }
  // Un día suma si sus actividades no quedaron afuera (por categoría o por no llegar al mínimo): lo decide el motor.
  const counted = new Set<string>();
  for (const e of entries) {
    const day = (e.detail as { day?: unknown } | null)?.day;
    if (typeof day === "string" && (e.reason === null || e.reason === SCORE_REASON.merged)) counted.add(day);
  }
  return {
    weekKey,
    daysTrained: counted.size,
    target: Math.min(current.weeklyGoal, daysInWeekWithin(weekKey, current.startDate, current.endDate)),
    days: dates.map((date) => ({ date, count: count.get(date) ?? 0, counted: counted.has(date) })),
  };
}

export async function getGroupPageData(
  groupId: string,
  viewer: { id: string; timezone: string },
  opts: { now?: Date } = {}
): Promise<GroupPageData> {
  const now = opts.now ?? new Date();
  const group = await getGroupForMember(groupId, viewer.id); // lanza NOT_FOUND / FORBIDDEN
  const tz = group.timezone;

  let rows = await loadSeasons(groupId);
  if (await finalizeDue(rows, tz, viewer.id, now)) rows = await loadSeasons(groupId);
  const summaries = rows.map((r) => toSeasonSummary(r, viewer.id, tz, now));
  const { current, upcoming, past } = classifySeasons(summaries);

  const canSeeStandings = !!current && (current.status === "active" || resultsVisible(current) || group.myRole === "admin");
  const [standings, winners, myWeek, feed] = await Promise.all([
    current && canSeeStandings ? getSeasonStandings(current.id) : Promise.resolve([]),
    past.length
      ? prisma.seasonStanding.findMany({
          where: { seasonId: { in: past.map((p) => p.id) }, rank: 1 },
          orderBy: { userId: "asc" },
          select: { seasonId: true, userId: true, points: true, user: { select: { name: true, photoUrl: true } } },
        })
      : Promise.resolve([]),
    current && current.status === "active" && current.joined ? getMyWeek(current, viewer.id, tz, now) : Promise.resolve(null),
    getGroupFeed(groupId, viewer.id, { limit: FEED_PAGE }, { group, seasonIds: summaries.map((s) => s.id) }),
  ]);

  return {
    group,
    viewer: { id: viewer.id, role: group.myRole, timezone: viewer.timezone },
    current,
    upcoming,
    past: past.map((p) => ({
      ...p,
      winners: winners
        .filter((w) => w.seasonId === p.id)
        .map((w) => ({ userId: w.userId, name: w.user.name, photoUrl: w.user.photoUrl, points: w.points })),
    })),
    standings,
    myWeek,
    feed,
  };
}

// ---------------------------------------------------------------- feed

const feedSelect = {
  id: true,
  startedAt: true,
  durationMinutes: true,
  user: { select: { id: true, name: true, photoUrl: true } },
  activityCategory: { select: { name: true } },
  media: { where: { status: "ready" }, orderBy: [{ position: "asc" }, { uploadedAt: "asc" }], take: 1, select: { url: true, thumbUrl: true } },
} satisfies Prisma.ActivitySelect; // sin `notes` a propósito

/** Cursor opaco "<startedAt ISO>|<id>". */
function encodeCursor(r: { startedAt: Date; id: string }) {
  return `${r.startedAt.toISOString()}|${r.id}`;
}
function decodeCursor(cursor: string | undefined | null): { startedAt: Date; id: string } | null {
  if (!cursor) return null;
  const i = cursor.indexOf("|");
  if (i < 0) return null;
  const startedAt = new Date(cursor.slice(0, i));
  const id = cursor.slice(i + 1);
  return Number.isNaN(startedAt.getTime()) || !id ? null : { startedAt, id };
}

/**
 * Entrenamientos de los miembros vigentes del grupo, del más nuevo al más viejo. Cada uno con los puntos
 * que sumó en la temporada de este grupo donde cayó. El caller ya validó que el viewer es miembro
 * (o lo valida `getGroupForMember` si no se pasa `ctx`).
 */
export async function getGroupFeed(
  groupId: string,
  viewerId: string,
  opts: { cursor?: string | null; limit?: number } = {},
  ctx?: { group: Pick<GroupDTO, "members">; seasonIds: string[] }
): Promise<GroupFeedPage> {
  const limit = Math.min(Math.max(opts.limit ?? FEED_PAGE, 1), 50);
  const group = ctx?.group ?? (await getGroupForMember(groupId, viewerId));
  const seasonIds = new Set(
    ctx?.seasonIds ?? (await prisma.season.findMany({ where: { groupId }, select: { id: true } })).map((s) => s.id)
  );
  const memberIds = group.members.map((m) => m.userId);
  if (!memberIds.length) return { items: [], nextCursor: null };
  const c = decodeCursor(opts.cursor);
  const rows = await prisma.activity.findMany({
    where: {
      userId: { in: memberIds },
      ...(c ? { OR: [{ startedAt: { lt: c.startedAt } }, { startedAt: c.startedAt, id: { lt: c.id } }] } : {}),
    },
    orderBy: [{ startedAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: feedSelect,
  });
  const page = rows.slice(0, limit);
  const ids = page.map((r) => r.id);
  const [points, reactions] = await Promise.all([getActivityPoints(ids), getReactionSummaries(ids, viewerId)]);
  return {
    items: page.map((r) => ({
      id: r.id,
      user: r.user,
      categoryName: r.activityCategory.name,
      startedAt: r.startedAt,
      durationMinutes: r.durationMinutes,
      points: (points.get(r.id) ?? []).find((p) => seasonIds.has(p.seasonId))?.points ?? null,
      photoUrl: r.media[0]?.url ?? null,
      thumbUrl: r.media[0]?.thumbUrl ?? null,
      reactions: reactions.get(r.id) ?? [],
    })),
    nextCursor: rows.length > limit ? encodeCursor(page[page.length - 1]) : null,
  };
}
