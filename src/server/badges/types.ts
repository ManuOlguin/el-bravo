/** Contratos públicos de insignias (roadmap §5.6). */

export type BadgeChange = {
  code: string;
  name: string;
  iconKey: string | null;
  levelBefore: number;
  levelAfter: number;
  progressBefore: number;
  progressAfter: number;
  nextThreshold: number | null;
};

export type UserBadgeView = {
  code: string;
  name: string;
  description: string;
  iconKey: string | null;
  level: number;
  maxLevel: number;
  progress: number;
  nextThreshold: number | null;
  achievedAt: Date | null;
  /** Umbral de cada nivel, ordenado (extensión aditiva de W1-2 para la hoja de detalle). */
  levels?: { level: number; threshold: number }[];
};
