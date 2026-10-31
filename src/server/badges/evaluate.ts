/** Evaluación pura de niveles de una insignia a partir del valor de su métrica. */
import type { MetricKey, MetricParams } from "./metrics";

export type BadgeDef = {
  id: string;
  code: string;
  name: string;
  metric: MetricKey;
  params: MetricParams;
  levels: { level: number; threshold: number }[];
};

export type BadgeState = {
  badgeId: string;
  code: string;
  level: number;
  progress: number;
  nextThreshold: number | null;
  maxLevel: number;
};

/** level = mayor nivel con threshold ≤ value (0 si ninguno); progress = value; nextThreshold = umbral del siguiente o null. */
export function evaluateBadge(def: BadgeDef, value: number): BadgeState {
  const levels = [...def.levels].sort((a, b) => a.level - b.level);
  let level = 0;
  let nextThreshold: number | null = null;
  for (const l of levels) {
    if (l.threshold <= value) {
      level = l.level;
    } else {
      nextThreshold = l.threshold;
      break;
    }
  }
  return {
    badgeId: def.id,
    code: def.code,
    level,
    progress: value,
    nextThreshold,
    maxLevel: levels.length ? levels[levels.length - 1].level : 0,
  };
}
