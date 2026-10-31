import "server-only";
import type { Prisma } from "@prisma/client";
import { dbDateToLocalDate } from "@/src/lib/time";
import { isSeasonAwardType } from "@/src/server/scoring/awards";
import { statusOfDbSeason } from "@/src/server/seasons/lifecycle";
import type { SeasonSummary } from "./types";

/** Select de Prisma para armar un `SeasonSummary` (sin datos sensibles). */
export const seasonSummarySelect = {
  id: true,
  groupId: true,
  name: true,
  description: true,
  startDate: true,
  endDate: true,
  weeklyGoal: true,
  minDailyMinutes: true,
  dayBasePoints: true,
  timePointsFactor: true,
  timeCurveMinutes: true,
  maxDailyMinutes: true,
  weeklyGoalBonus: true,
  streakBonusStep: true,
  streakBonusCap: true,
  resultsReveal: true,
  finalizedAt: true,
  resultsPublishedAt: true,
  categories: { select: { weight: true, activityCategory: { select: { id: true, name: true, sortOrder: true } } } },
  awards: { select: { awardType: true, bonusPoints: true } },
  members: { where: { leftAt: null }, select: { userId: true } },
} satisfies Prisma.SeasonSelect;

export type SeasonSummaryRow = Prisma.SeasonGetPayload<{ select: typeof seasonSummarySelect }>;

export function toSeasonSummary(s: SeasonSummaryRow, viewerId: string, timezone: string, now: Date): SeasonSummary {
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    startDate: dbDateToLocalDate(s.startDate),
    endDate: dbDateToLocalDate(s.endDate),
    status: statusOfDbSeason({ startDate: s.startDate, endDate: s.endDate, finalizedAt: s.finalizedAt, group: { timezone } }, now),
    resultsReveal: s.resultsReveal,
    resultsPublished: !!s.resultsPublishedAt,
    joined: s.members.some((m) => m.userId === viewerId),
    memberCount: s.members.length,
    weeklyGoal: s.weeklyGoal,
    categories: [...s.categories]
      .sort((a, b) => a.activityCategory.sortOrder - b.activityCategory.sortOrder || a.activityCategory.name.localeCompare(b.activityCategory.name))
      .map((c) => ({ id: c.activityCategory.id, name: c.activityCategory.name, weight: Number(c.weight) })),
    awards: s.awards.flatMap((a) => (isSeasonAwardType(a.awardType) ? [{ awardType: a.awardType, bonusPoints: a.bonusPoints }] : [])),
    rules: {
      weeklyGoal: s.weeklyGoal,
      minDailyMinutes: s.minDailyMinutes,
      dayBasePoints: s.dayBasePoints,
      timePointsFactor: s.timePointsFactor,
      timeCurveMinutes: s.timeCurveMinutes,
      maxDailyMinutes: s.maxDailyMinutes,
      weeklyGoalBonus: s.weeklyGoalBonus,
      streakBonusStep: s.streakBonusStep,
      streakBonusCap: s.streakBonusCap,
    },
  };
}
