/* eslint-disable @typescript-eslint/no-unused-vars -- stub: los parámetros se usan en la implementación real */
// STUB (W0-C). W1-2 lo reemplaza por las implementaciones reales MANTENIENDO estos exports (§5.6).
// Sin "server-only" a propósito: scripts/migrate-v2-data.ts lo importa desde tsx.

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
};

/** Devuelve solo las insignias cuyo nivel o progreso cambió. */
export async function recomputeUserBadges(_userId: string): Promise<BadgeChange[]> {
  return [];
}

export async function getUserBadges(_userId: string): Promise<UserBadgeView[]> {
  return [];
}
