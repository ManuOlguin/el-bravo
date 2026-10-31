/** Lecturas del resultado del motor (tablas `SeasonStanding` y `ScoreEntry`). */
import { prisma } from "@/src/lib/db";
import type { StandingRow } from "./types";

export async function getSeasonStandings(seasonId: string): Promise<StandingRow[]> {
  const rows = await prisma.seasonStanding.findMany({
    where: { seasonId },
    orderBy: [{ rank: "asc" }, { userId: "asc" }],
    include: { user: { select: { name: true, photoUrl: true } } },
  });
  return rows.map((r) => ({
    userId: r.userId,
    name: r.user.name,
    photoUrl: r.user.photoUrl,
    rank: r.rank,
    points: r.points,
    daysTrained: r.daysTrained,
    activities: r.activities,
    weeksGoalMet: r.weeksGoalMet,
    currentStreak: r.currentStreak,
    bestStreak: r.bestStreak,
    minutes: r.minutes,
  }));
}

/** Puntos de cada actividad por temporada (kind `workout`). Las actividades sin temporada no aparecen. */
export async function getActivityPoints(
  activityIds: string[]
): Promise<Map<string, { seasonId: string; points: number; reason: string | null }[]>> {
  const out = new Map<string, { seasonId: string; points: number; reason: string | null }[]>();
  if (!activityIds.length) return out;
  const rows = await prisma.scoreEntry.findMany({
    where: { activityId: { in: activityIds }, kind: "workout" },
    select: { activityId: true, seasonId: true, points: true, reason: true },
    orderBy: [{ seasonId: "asc" }],
  });
  for (const r of rows) {
    if (!r.activityId) continue;
    const list = out.get(r.activityId) ?? [];
    list.push({ seasonId: r.seasonId, points: r.points, reason: r.reason });
    out.set(r.activityId, list);
  }
  return out;
}
