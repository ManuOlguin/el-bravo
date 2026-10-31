// STUB (W0-C). W1-1 lo reemplaza por las implementaciones reales MANTENIENDO estos exports (§5.5).
// Hasta entonces los puntos quedan en 0: no se escriben ScoreEntry ni SeasonStanding.
// Sin "server-only" a propósito: scripts/migrate-v2-data.ts lo importa desde tsx.
import { prisma } from "@/src/lib/db";
import type { ActivityChange } from "@/src/server/activities/effects";
import type { ScoringEffect, StandingRow } from "./types";

export type { ScoringEffect, StandingRow } from "./types";

export async function recomputeSeason(_seasonId: string): Promise<void> {}

export async function recomputeSeasonsForChange(_change: ActivityChange): Promise<ScoringEffect[]> {
  return [];
}

export async function finalizeSeason(_seasonId: string, _opts: { publish: boolean }): Promise<void> {}

/** Lee la tabla SeasonStanding (vacía hasta que W1-1 implemente el recálculo). */
export async function getSeasonStandings(seasonId: string): Promise<StandingRow[]> {
  const rows = await prisma.seasonStanding.findMany({
    where: { seasonId },
    orderBy: { rank: "asc" },
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

export async function getActivityPoints(
  _activityIds: string[]
): Promise<Map<string, { seasonId: string; points: number; reason: string | null }[]>> {
  return new Map();
}
