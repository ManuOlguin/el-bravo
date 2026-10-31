// Tipos de la experiencia de temporada (W2-2). Puros: se importan desde cliente y servidor.
import type { SeasonRules } from "@/src/server/scoring/types";
import type { SeasonAwardType } from "@/src/server/scoring/awards";
import type { SeasonStatus } from "@/src/server/seasons/status";

export type { SeasonStatus } from "@/src/server/seasons/status";
export type { SeasonAwardType } from "@/src/server/scoring/awards";

/** Parámetros de puntaje de una temporada (D1), tal como se guardan. */
export type SeasonRulesView = {
  weeklyGoal: number;
  minDailyMinutes: number;
  dayBasePoints: number;
  timePointsFactor: number;
  timeCurveMinutes: number;
  maxDailyMinutes: number;
  weeklyGoalBonus: number;
  streakBonusStep: number;
  streakBonusCap: number;
  activeStreakBonusStep: number;
  activeStreakBonusCap: number;
};

export type SeasonSummary = {
  id: string;
  name: string;
  description: string | null;
  startDate: string; // LocalDate (zona del grupo)
  endDate: string;
  status: SeasonStatus;
  resultsReveal: "auto" | "manual";
  resultsPublished: boolean;
  joined: boolean;
  memberCount: number;
  weeklyGoal: number;
  categories: { id: string; name: string; weight: number }[]; // ordenadas como el catálogo
  awards: { awardType: SeasonAwardType; bonusPoints: number }[];
  rules: SeasonRulesView;
};

/** Valores por defecto de D1 (iguales a los defaults del schema de Prisma). */
export const DEFAULT_RULES: SeasonRulesView = {
  weeklyGoal: 3,
  minDailyMinutes: 20,
  dayBasePoints: 10,
  timePointsFactor: 10,
  timeCurveMinutes: 30,
  maxDailyMinutes: 240,
  weeklyGoalBonus: 20,
  streakBonusStep: 5,
  streakBonusCap: 25,
  activeStreakBonusStep: 2,
  activeStreakBonusCap: 10,
};

/** Reglas del motor a partir de los parámetros (para `dayPoints`, que no mira fechas ni pesos). */
export function scoringRulesOf(r: SeasonRulesView): SeasonRules {
  return { ...r, startDate: "2000-01-01", endDate: "2000-01-01", timezone: "UTC", categoryWeights: {} };
}

/** Los resultados finales (premios, podio) solo se ven cuando la temporada está finalizada y publicada. */
export function resultsVisible(s: Pick<SeasonSummary, "status" | "resultsPublished">) {
  return s.status === "finalized" && s.resultsPublished;
}

/** Terminó y los resultados todavía no se publicaron (modo manual, o la finalización automática no corrió). */
export function awaitingResults(s: Pick<SeasonSummary, "status" | "resultsPublished">) {
  return s.status === "ended" || (s.status === "finalized" && !s.resultsPublished);
}
