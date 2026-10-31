// Contrato §5.5 (roadmap). W1-1 agrega acá el resto de sus tipos.

export type ScoringEffect = {
  seasonId: string;
  seasonName: string;
  groupId: string;
  groupName: string;
  activityPoints: number; // puntos de ESTA actividad (0 si no puntuó)
  activityReason: string | null; // "Ya sumaste un entrenamiento hoy", etc.
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
