// Punto de entrada del motor de puntos y temporadas (contrato §5.5, dueño W1-1).
// Sin "server-only" a propósito: scripts/migrate-v2-data.ts lo importa desde tsx.
export type {
  ScoringEffect,
  StandingRow,
  SeasonRules,
  ScoringActivity,
  ScoreLine,
  UserWeek,
  UserTotals,
  RankedTotals,
  SeasonScores,
} from "./types";
export { computeSeasonScores, dayPoints, rankTotals, SCORE_REASON } from "./compute";
export { SEASON_AWARD_TYPES, SEASON_AWARD_INFO, computeAwardWinners, isSeasonAwardType, type SeasonAwardType } from "./awards";
export { recomputeSeason, recomputeSeasonsForChange, finalizeSeason, publishSeasonResults, reopenSeason } from "./recompute";
export { getSeasonStandings, getActivityPoints } from "./queries";
