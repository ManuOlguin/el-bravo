import "server-only";
import { prisma } from "@/src/lib/db";
import { getActivityPoints } from "@/src/server/scoring/queries";

/** Ítem del historial del DUEÑO (incluye todo lo propio; nunca se usa para perfiles ajenos). */
export type HistoryItem = {
  id: string;
  startedAt: Date;
  categoryName: string;
  durationMinutes: number;
  sets: number;
  volumeKg: number;
  thumbUrl: string | null;
  /** Puntos de temporada que sumó (una entrada por temporada en la que contó). */
  points: { seasonId: string; seasonName: string; points: number }[];
};

/** Cursor opaco "<startedAt ISO>|<id>" (mismo formato que el feed). */
function encodeCursor(r: { startedAt: Date; id: string }) {
  return `${r.startedAt.toISOString()}|${r.id}`;
}
function decodeCursor(cursor: string | null | undefined): { startedAt: Date; id: string } | null {
  if (!cursor) return null;
  const i = cursor.indexOf("|");
  if (i < 0) return null;
  const startedAt = new Date(cursor.slice(0, i));
  const id = cursor.slice(i + 1);
  return Number.isNaN(startedAt.getTime()) || !id ? null : { startedAt, id };
}

/** Historial paginado de entrenamientos de `userId`, del más nuevo al más viejo, con series, volumen y puntos. */
export async function getWorkoutHistory(
  userId: string,
  opts: { cursor?: string | null; limit?: number } = {}
): Promise<{ items: HistoryItem[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);
  const c = decodeCursor(opts.cursor);
  const rows = await prisma.activity.findMany({
    where: { userId, ...(c ? { OR: [{ startedAt: { lt: c.startedAt } }, { startedAt: c.startedAt, id: { lt: c.id } }] } : {}) },
    orderBy: [{ startedAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: {
      id: true,
      startedAt: true,
      durationMinutes: true,
      activityCategory: { select: { name: true } },
      media: { where: { status: "ready" }, orderBy: [{ position: "asc" }, { uploadedAt: "asc" }], take: 1, select: { url: true, thumbUrl: true } },
      exercises: { select: { sets: { where: { completed: true }, select: { reps: true, weightKg: true } } } },
    },
  });
  const page = rows.slice(0, limit);
  const pointsById = await getActivityPoints(page.map((r) => r.id));
  const seasonIds = [...new Set([...pointsById.values()].flat().map((p) => p.seasonId))];
  const seasons = seasonIds.length ? await prisma.season.findMany({ where: { id: { in: seasonIds } }, select: { id: true, name: true } }) : [];
  const seasonName = new Map(seasons.map((s) => [s.id, s.name]));

  return {
    items: page.map((r) => {
      const sets = r.exercises.flatMap((e) => e.sets);
      return {
        id: r.id,
        startedAt: r.startedAt,
        categoryName: r.activityCategory.name,
        durationMinutes: r.durationMinutes,
        sets: sets.length,
        volumeKg: Math.round(sets.reduce((acc, s) => acc + (s.weightKg && s.reps ? s.weightKg * s.reps : 0), 0) * 10) / 10,
        thumbUrl: r.media[0] ? (r.media[0].thumbUrl ?? r.media[0].url) : null,
        points: (pointsById.get(r.id) ?? []).map((p) => ({ seasonId: p.seasonId, seasonName: seasonName.get(p.seasonId) ?? "Temporada", points: p.points })),
      };
    }),
    nextCursor: rows.length > limit ? encodeCursor(page[page.length - 1]) : null,
  };
}
