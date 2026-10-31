/** Premios de temporada (roadmap D3). Catálogo en código; puro. */
import { daysInWeekWithin, weekKeysBetween } from "@/src/lib/time";
import type { ScoringActivity, SeasonRules, SeasonScores, UserTotals } from "./types";

export const SEASON_AWARD_TYPES = ["most_days", "most_minutes", "best_streak", "longest_session", "most_categories", "perfect_attendance"] as const;
export type SeasonAwardType = (typeof SEASON_AWARD_TYPES)[number];

export const SEASON_AWARD_INFO: Record<SeasonAwardType, { name: string; description: string; icon: string; unit: string }> = {
  most_days: { name: "El más constante", description: "Más días entrenados", icon: "📅", unit: "días" },
  most_minutes: { name: "Incansable", description: "Más minutos entrenados", icon: "⏱️", unit: "min" },
  best_streak: { name: "Racha de hierro", description: "Mejor racha de semanas cumplidas", icon: "🔥", unit: "semanas" },
  longest_session: { name: "Maratonista", description: "Entrenamiento más largo", icon: "🏃", unit: "min" },
  most_categories: { name: "Todoterreno", description: "Más tipos de actividad distintos", icon: "🧭", unit: "categorías" },
  perfect_attendance: { name: "Asistencia perfecta", description: "Cumplió el objetivo todas las semanas", icon: "🏅", unit: "semanas" },
};

export function isSeasonAwardType(v: string): v is SeasonAwardType {
  return (SEASON_AWARD_TYPES as readonly string[]).includes(v);
}

/** Semanas de la temporada que tienen objetivo (> 0 días). */
export function seasonGoalWeeks(rules: SeasonRules): number {
  if (rules.weeklyGoal <= 0 || rules.endDate < rules.startDate) return 0;
  return weekKeysBetween(rules.startDate, rules.endDate).filter((w) => daysInWeekWithin(w, rules.startDate, rules.endDate) > 0).length;
}

const METRIC: Record<Exclude<SeasonAwardType, "perfect_attendance">, (t: UserTotals) => number> = {
  most_days: (t) => t.daysTrained,
  most_minutes: (t) => t.minutes,
  best_streak: (t) => t.bestStreak,
  longest_session: (t) => t.longestActivityMinutes,
  most_categories: (t) => t.categories,
};

/**
 * Ganadores de un premio. Ganan todos los empatados con el máximo; si el máximo es 0, no hay ganadores.
 * `activities` queda en la firma (contrato) para premios futuros que necesiten el detalle.
 */
export function computeAwardWinners(
  type: SeasonAwardType,
  scores: SeasonScores,
  activities: ScoringActivity[],
  rules: SeasonRules
): { userId: string; value: number }[] {
  if (type === "perfect_attendance") {
    const weeks = seasonGoalWeeks(rules);
    if (weeks === 0) return [];
    return scores.totals.filter((t) => t.weeksGoalMet >= weeks).map((t) => ({ userId: t.userId, value: weeks }));
  }
  const metric = METRIC[type];
  const max = Math.max(0, ...scores.totals.map(metric));
  if (max <= 0) return [];
  return scores.totals.filter((t) => metric(t) === max).map((t) => ({ userId: t.userId, value: max }));
}
