/**
 * Motor de puntos v2 (roadmap D1). Puro y determinista: sin I/O, sin `Date.now()`.
 * Los puntos se derivan siempre de los datos fuente; `recomputeSeason` reescribe el resultado completo.
 */
import { localDateOf, weekKeyOfLocalDate, weekKeysBetween, daysInWeekWithin, addDays } from "@/src/lib/time";
import type { SeasonRules, ScoringActivity, ScoreLine, UserTotals, UserWeek, SeasonScores } from "./types";

export type { SeasonRules, ScoringActivity, ScoreLine, UserTotals, UserWeek, SeasonScores } from "./types";

export const SCORE_REASON = {
  category: "Esta actividad no cuenta en la temporada",
  shortDay: (min: number) => `El día sumó menos de ${min} min`,
  merged: "Sumó al tiempo del día",
} as const;

/** Puntos de un día con `minutes` minutos efectivos (D1.3). */
export function dayPoints(r: SeasonRules, minutes: number): number {
  if (minutes < r.minDailyMinutes) return 0;
  const m = Math.min(minutes, r.maxDailyMinutes);
  return r.dayBasePoints + Math.round(r.timePointsFactor * Math.log2(1 + m / r.timeCurveMinutes));
}

const KIND_ORDER = { workout: 0, weekly_goal: 1, streak: 2, active_streak: 3, award: 4 } as const;

export function computeSeasonScores(r: SeasonRules, memberIds: string[], activities: ScoringActivity[], now: Date): SeasonScores {
  const members = [...new Set(memberIds)].sort();
  const today = localDateOf(now, r.timezone);
  const lastDay = today < r.endDate ? today : r.endDate;
  const sorted = [...activities].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime() || a.id.localeCompare(b.id));
  const order = new Map(sorted.map((a, i) => [a.id, i]));
  const lines: ScoreLine[] = [];
  const totals: UserTotals[] = [];

  for (const userId of members) {
    const userLines: ScoreLine[] = [];
    const byDay = new Map<string, { a: ScoringActivity; eff: number }[]>();

    for (const a of sorted) {
      if (a.userId !== userId) continue;
      const day = localDateOf(a.startedAt, r.timezone);
      if (day < r.startDate || day > r.endDate) continue;
      const weight = r.categoryWeights[a.activityCategoryId];
      if (weight === undefined || !(weight > 0)) {
        userLines.push({ userId, activityId: a.id, kind: "workout", weekKey: weekKeyOfLocalDate(day), points: 0, reason: SCORE_REASON.category });
        continue;
      }
      const list = byDay.get(day) ?? [];
      list.push({ a, eff: a.durationMinutes * weight });
      byDay.set(day, list);
    }

    const daysByWeek = new Map<string, number>();
    let minutes = 0;
    let activitiesCount = 0;
    let longest = 0;
    const categories = new Set<string>();
    for (const [day, list] of byDay) {
      const weekKey = weekKeyOfLocalDate(day);
      const dayTotal = list.reduce((s, x) => s + x.eff, 0);
      const counts = dayTotal >= r.minDailyMinutes;
      let cum = 0;
      let prev = 0;
      for (const { a, eff } of list) {
        cum += eff;
        const pts = dayPoints(r, cum);
        const marginal = pts - prev;
        prev = pts;
        const reason = !counts ? SCORE_REASON.shortDay(r.minDailyMinutes) : marginal === 0 ? SCORE_REASON.merged : null;
        userLines.push({
          userId, activityId: a.id, kind: "workout", weekKey, points: marginal, reason,
          detail: { day, effectiveMinutes: Math.round(eff), dayMinutes: Math.round(dayTotal) },
        });
      }
      if (counts) {
        daysByWeek.set(weekKey, (daysByWeek.get(weekKey) ?? 0) + 1);
        activitiesCount += list.length;
        for (const { a } of list) {
          minutes += a.durationMinutes;
          longest = Math.max(longest, a.durationMinutes);
          categories.add(a.activityCategoryId);
        }
      }
    }

    const weeks: UserWeek[] = [];
    let streak = 0;
    let best = 0;
    let activeStreak = 0;
    let weeksGoalMet = 0;
    for (const weekKey of lastDay >= r.startDate ? weekKeysBetween(r.startDate, lastDay) : []) {
      const target = Math.min(r.weeklyGoal, daysInWeekWithin(weekKey, r.startDate, r.endDate));
      const days = daysByWeek.get(weekKey) ?? 0;
      const goalMet = target > 0 && days >= target;
      const finished = addDays(weekKey, 6) < today || today > r.endDate;
      if (goalMet) {
        streak += 1;
        weeksGoalMet += 1;
        best = Math.max(best, streak);
        userLines.push({ userId, activityId: null, kind: "weekly_goal", weekKey, points: r.weeklyGoalBonus, reason: null, detail: { days, target } });
        const bonus = Math.min((streak - 1) * r.streakBonusStep, r.streakBonusCap);
        if (bonus > 0) userLines.push({ userId, activityId: null, kind: "streak", weekKey, points: bonus, reason: null, detail: { streak } });
      } else if (finished) {
        streak = 0; // la semana en curso no corta la racha mientras no termine (D1.6)
      }
      // Racha activa (aparte, más chica): semanas seguidas con al menos 1 día que cuenta. Una semana con 2 de 3
      // días corta la racha de cumplidas pero mantiene esta. Misma regla para la semana en curso.
      if (days > 0) {
        activeStreak += 1;
        const activeBonus = Math.min((activeStreak - 1) * r.activeStreakBonusStep, r.activeStreakBonusCap);
        if (activeBonus > 0)
          userLines.push({ userId, activityId: null, kind: "active_streak", weekKey, points: activeBonus, reason: null, detail: { activeStreak } });
      } else if (finished) {
        activeStreak = 0;
      }
      weeks.push({ weekKey, days, target, goalMet, streak, activeStreak, finished });
    }

    userLines.sort(
      (x, y) =>
        (x.weekKey ?? "").localeCompare(y.weekKey ?? "") ||
        KIND_ORDER[x.kind] - KIND_ORDER[y.kind] ||
        (order.get(x.activityId ?? "") ?? 0) - (order.get(y.activityId ?? "") ?? 0)
    );
    lines.push(...userLines);
    totals.push({
      userId,
      points: userLines.reduce((s, l) => s + l.points, 0),
      daysTrained: [...daysByWeek.values()].reduce((s, v) => s + v, 0),
      activities: activitiesCount,
      minutes,
      weeksGoalMet,
      currentStreak: streak,
      bestStreak: best,
      longestActivityMinutes: longest,
      categories: categories.size,
      weeks,
    });
  }
  return { lines, totals, ranked: rankTotals(totals) };
}

/** Ranking D1.8: puntos → semanas cumplidas → días entrenados. Empates comparten puesto (1, 1, 3). */
export function rankTotals<T extends Pick<UserTotals, "userId" | "points" | "weeksGoalMet" | "daysTrained">>(totals: T[]): (T & { rank: number })[] {
  const sorted = [...totals].sort(
    (a, b) => b.points - a.points || b.weeksGoalMet - a.weeksGoalMet || b.daysTrained - a.daysTrained || a.userId.localeCompare(b.userId)
  );
  let rank = 0;
  return sorted.map((t, i) => {
    const prev = sorted[i - 1];
    const tie = !!prev && prev.points === t.points && prev.weeksGoalMet === t.weeksGoalMet && prev.daysTrained === t.daysTrained;
    if (!tie) rank = i + 1;
    return { ...t, rank };
  });
}
