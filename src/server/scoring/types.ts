// Contrato §5.5 (roadmap) + tipos del motor puro (D1).

export type ScoringEffect = {
  seasonId: string;
  seasonName: string;
  groupId: string;
  groupName: string;
  activityPoints: number; // puntos de ESTA actividad (0 si no puntuó)
  activityReason: string | null; // "Sumó al tiempo del día", etc.
  totalBefore: number;
  totalAfter: number;
  rankBefore: number | null;
  rankAfter: number;
};

export type StandingRow = {
  userId: string;
  name: string | null;
  photoUrl: string | null;
  rank: number;
  points: number;
  daysTrained: number;
  activities: number;
  weeksGoalMet: number;
  currentStreak: number;
  bestStreak: number;
  minutes: number;
};

// --- Motor puro (D1) ---

/** Reglas de una temporada, ya convertidas a fechas locales y pesos numéricos. */
export type SeasonRules = {
  startDate: string; // LocalDate (zona del grupo), inclusiva
  endDate: string; // LocalDate (zona del grupo), inclusiva
  timezone: string;
  weeklyGoal: number; // días entrenados por semana
  minDailyMinutes: number; // 20
  dayBasePoints: number; // 10
  timePointsFactor: number; // 10
  timeCurveMinutes: number; // 30
  maxDailyMinutes: number; // 240
  weeklyGoalBonus: number;
  streakBonusStep: number;
  streakBonusCap: number;
  /** Racha de semanas activas (≥ 1 día que cuenta), aparte y más chica que la de semanas cumplidas. */
  activeStreakBonusStep: number;
  activeStreakBonusCap: number;
  categoryWeights: Record<string, number>; // activityCategoryId → 0..2 (ausente = no cuenta)
};

export type ScoringActivity = {
  id: string;
  userId: string;
  activityCategoryId: string;
  startedAt: Date;
  durationMinutes: number;
};

export type ScoreLine = {
  userId: string;
  activityId: string | null;
  kind: "workout" | "weekly_goal" | "streak" | "active_streak" | "award";
  weekKey: string | null;
  points: number;
  reason: string | null;
  detail?: Record<string, unknown>;
};

export type UserWeek = { weekKey: string; days: number; target: number; goalMet: boolean; streak: number; activeStreak: number; finished: boolean };

export type UserTotals = {
  userId: string;
  points: number;
  daysTrained: number;
  activities: number;
  minutes: number;
  weeksGoalMet: number;
  currentStreak: number;
  bestStreak: number;
  longestActivityMinutes: number;
  categories: number;
  weeks: UserWeek[];
};

export type RankedTotals = UserTotals & { rank: number };

export type SeasonScores = { lines: ScoreLine[]; totals: UserTotals[]; ranked: RankedTotals[] };
