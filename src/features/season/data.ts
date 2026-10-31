import "server-only";
/**
 * Datos de la página de temporada (W2-2 Task 4): ranking, semanas por usuario, premios con ganadores
 * y stats agregadas. Todo se DERIVA de lo que guardó el motor (SeasonStanding / ScoreEntry /
 * SeasonAwardWinner): acá no se calculan puntos.
 */
import { prisma } from "@/src/lib/db";
import { addDays, localDateOf, weekKeysBetween } from "@/src/lib/time";
import { getGroupForMember } from "@/src/server/groups/queries";
import { getSeasonStandings } from "@/src/server/scoring/queries";
import { SCORE_REASON } from "@/src/server/scoring/compute";
import { isSeasonAwardType, type SeasonAwardType } from "@/src/server/scoring/awards";
import type { StandingRow } from "@/src/server/scoring/types";
import { finalizeSeasonIfDue } from "@/src/server/seasons/lifecycle";
import { weekdayIndex } from "./format";
import { seasonSummarySelect, toSeasonSummary } from "./summary";
import { resultsVisible, type SeasonSummary } from "./types";

export type WeekState = "met" | "missed" | "current" | "future";
export type UserWeekCell = { weekKey: string; state: WeekState; days: number };

export type SeasonAwardView = {
  awardType: SeasonAwardType;
  bonusPoints: number;
  winners: { userId: string; name: string | null; photoUrl: string | null; value: number }[];
};

export type SeasonStats = {
  participants: number;
  daysTrained: number; // días entrenados (que sumaron) de todos
  activities: number;
  minutes: number;
  topCategory: { name: string; count: number } | null;
  topWeekday: { index: number; days: number } | null; // 0 = lunes
  bestWeek: { weekKey: string; days: number } | null;
};

export type MyNumbers = { rank: number; points: number; bestStreak: number; daysTrained: number; averagePoints: number };

export type SeasonPageData = {
  group: { id: string; name: string; timezone: string; admins: { userId: string; name: string | null }[] };
  viewer: { id: string; role: "admin" | "member"; timezone: string };
  season: SeasonSummary;
  today: string; // fecha local en la zona del grupo
  /** Ranking visible: en curso, publicado, o admin (vista previa). */
  canSeeStandings: boolean;
  /** Resultados finales (podio/premios) visibles para todos. */
  canSeeResults: boolean;
  standings: StandingRow[];
  weeks: { weekKeys: string[]; byUser: Record<string, UserWeekCell[]> };
  awards: SeasonAwardView[];
  stats: SeasonStats | null;
  me: MyNumbers | null;
};

function isCounted(reason: string | null) {
  return reason === null || reason === SCORE_REASON.merged;
}

function maxBy<K>(m: Map<K, number>, tieBreak: (a: K, b: K) => number): [K, number] | null {
  let best: [K, number] | null = null;
  for (const [k, v] of m) if (!best || v > best[1] || (v === best[1] && tieBreak(k, best[0]) < 0)) best = [k, v];
  return best;
}

/**
 * Lanza `AuthError` si el viewer no es miembro del grupo. Devuelve null si la temporada no existe o
 * no es de ese grupo.
 */
export async function getSeasonPageData(
  groupId: string,
  seasonId: string,
  viewer: { id: string; timezone: string },
  opts: { now?: Date } = {}
): Promise<SeasonPageData | null> {
  const now = opts.now ?? new Date();
  const group = await getGroupForMember(groupId, viewer.id);
  const exists = await prisma.season.findFirst({ where: { id: seasonId, groupId }, select: { id: true } });
  if (!exists) return null;
  await finalizeSeasonIfDue(seasonId, now); // respaldo del cron (D3), idempotente

  const row = await prisma.season.findUniqueOrThrow({ where: { id: seasonId }, select: seasonSummarySelect });
  const season = toSeasonSummary(row, viewer.id, group.timezone, now);
  const today = localDateOf(now, group.timezone);
  const isAdmin = group.myRole === "admin";
  const canSeeResults = resultsVisible(season);
  const canSeeStandings = season.status === "upcoming" || season.status === "active" || canSeeResults || isAdmin;

  const [standings, entries, awardRows] = await Promise.all([
    canSeeStandings ? getSeasonStandings(seasonId) : Promise.resolve([] as StandingRow[]),
    canSeeStandings
      ? prisma.scoreEntry.findMany({
          where: { seasonId, kind: { in: ["workout", "weekly_goal"] } },
          select: {
            userId: true,
            kind: true,
            weekKey: true,
            reason: true,
            detail: true,
            activity: { select: { durationMinutes: true, activityCategory: { select: { name: true } } } },
          },
        })
      : Promise.resolve([]),
    prisma.seasonAward.findMany({
      where: { seasonId },
      orderBy: { id: "asc" },
      select: {
        awardType: true,
        bonusPoints: true,
        winners: {
          // Los ganadores solo se muestran cuando los resultados son visibles (o al admin en la vista previa).
          where: canSeeResults || isAdmin ? {} : { id: "__none__" },
          orderBy: { userId: "asc" },
          select: { userId: true, value: true, user: { select: { name: true, photoUrl: true } } },
        },
      },
    }),
  ]);

  // Semanas por usuario (✓ cumplida, · en curso, ✗ no cumplida) y agregados, desde ScoreEntry.
  const weekKeys = season.status === "upcoming" ? [] : weekKeysBetween(season.startDate, season.endDate);
  const met = new Set<string>(); // `${userId}|${weekKey}`
  const daysByUserWeek = new Map<string, Set<string>>();
  const userDays = new Set<string>(); // `${userId}|${day}`
  const byCategory = new Map<string, number>();
  for (const e of entries) {
    if (e.kind === "weekly_goal" && e.weekKey) met.add(`${e.userId}|${e.weekKey}`);
    if (e.kind !== "workout" || !isCounted(e.reason)) continue;
    const day = (e.detail as { day?: unknown } | null)?.day;
    if (typeof day !== "string" || !e.weekKey) continue;
    const k = `${e.userId}|${e.weekKey}`;
    (daysByUserWeek.get(k) ?? daysByUserWeek.set(k, new Set()).get(k)!).add(day);
    userDays.add(`${e.userId}|${day}`);
    if (e.activity) byCategory.set(e.activity.activityCategory.name, (byCategory.get(e.activity.activityCategory.name) ?? 0) + 1);
  }
  const ended = today > season.endDate || season.status === "finalized";
  const byUser: Record<string, UserWeekCell[]> = {};
  for (const s of standings) {
    byUser[s.userId] = weekKeys.map((weekKey) => {
      const days = daysByUserWeek.get(`${s.userId}|${weekKey}`)?.size ?? 0;
      const state: WeekState = met.has(`${s.userId}|${weekKey}`)
        ? "met"
        : weekKey > today
          ? "future"
          : addDays(weekKey, 6) < today || ended
            ? "missed"
            : "current";
      return { weekKey, state, days };
    });
  }

  let stats: SeasonStats | null = null;
  if (canSeeStandings && standings.length) {
    const weekday = new Map<number, number>();
    const week = new Map<string, number>();
    for (const k of userDays) {
      const day = k.slice(k.indexOf("|") + 1);
      weekday.set(weekdayIndex(day), (weekday.get(weekdayIndex(day)) ?? 0) + 1);
    }
    for (const [k, days] of daysByUserWeek) {
      const wk = k.slice(k.indexOf("|") + 1);
      week.set(wk, (week.get(wk) ?? 0) + days.size);
    }
    const cat = maxBy(byCategory, (a, b) => a.localeCompare(b));
    const wd = maxBy(weekday, (a, b) => a - b);
    const bw = maxBy(week, (a, b) => a.localeCompare(b));
    stats = {
      participants: standings.length,
      daysTrained: standings.reduce((s, r) => s + r.daysTrained, 0),
      activities: standings.reduce((s, r) => s + r.activities, 0),
      minutes: standings.reduce((s, r) => s + r.minutes, 0),
      topCategory: cat ? { name: cat[0], count: cat[1] } : null,
      topWeekday: wd && wd[1] > 0 ? { index: wd[0], days: wd[1] } : null,
      bestWeek: bw && bw[1] > 0 ? { weekKey: bw[0], days: bw[1] } : null,
    };
  }

  const mine = standings.find((s) => s.userId === viewer.id);
  const me: MyNumbers | null = mine
    ? {
        rank: mine.rank,
        points: mine.points,
        bestStreak: mine.bestStreak,
        daysTrained: mine.daysTrained,
        averagePoints: Math.round(standings.reduce((s, r) => s + r.points, 0) / standings.length),
      }
    : null;

  return {
    group: {
      id: group.id,
      name: group.name,
      timezone: group.timezone,
      admins: group.members.filter((m) => m.role === "admin").map((m) => ({ userId: m.userId, name: m.name })),
    },
    viewer: { id: viewer.id, role: group.myRole, timezone: viewer.timezone },
    season,
    today,
    canSeeStandings,
    canSeeResults,
    standings,
    weeks: { weekKeys, byUser },
    awards: awardRows.flatMap((a) =>
      isSeasonAwardType(a.awardType)
        ? [
            {
              awardType: a.awardType,
              bonusPoints: a.bonusPoints,
              winners: a.winners.map((w) => ({ userId: w.userId, name: w.user.name, photoUrl: w.user.photoUrl, value: w.value })),
            },
          ]
        : []
    ),
    stats,
    me,
  };
}
