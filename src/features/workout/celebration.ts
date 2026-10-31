/**
 * Secuencia de festejo post-entrenamiento (estilo "terminaste la lección"): funciones puras que deciden
 * qué pantallas mostrar y en qué orden, a partir de los efectos del guardado. Sin I/O.
 */
import type { ScoringEffect } from "@/src/server/scoring/types";
import type { BadgeChange } from "@/src/server/badges/types";
import type { Celebration, NewRecord } from "./types";

export type CelebrationStep =
  | { kind: "complete"; totalPoints: number; workoutNumber: number | null }
  | { kind: "points"; seasons: ScoringEffect[] }
  | { kind: "rank"; effect: ScoringEffect; passed: string[] }
  | { kind: "week"; workouts: number; goal: number; justMet: boolean; perfectStreak: number }
  | { kind: "records"; records: NewRecord[] }
  | { kind: "badgeProgress"; changes: BadgeChange[] }
  | { kind: "badge"; change: BadgeChange };

export const MAX_RECORDS = 3;
export const MAX_PROGRESSED_BADGES = 3;

/**
 * Lo que el entrenamiento le sumó al total de la temporada. No es `activityPoints`: si el día ya tenía
 * otra actividad, los puntos del día se reparten por orden de inicio, y el total además incluye el
 * bonus de semana cumplida y de racha.
 */
export const pointsGained = (e: ScoringEffect) => Math.max(0, e.totalAfter - e.totalBefore);

/** Primer nombre para mensajes cortos ("Pasaste a Beto"). */
export function firstName(name: string | null): string {
  return name?.trim().split(/\s+/)[0] || "alguien";
}

/**
 * Orden: completo → puntos → puesto (uno por temporada en la que subió) → semana → récords → avance de
 * insignias (las más cerca del próximo nivel) → insignias (una por cada subida de nivel, como cierre).
 * Lo que no pasó no tiene pantalla.
 */
export function buildCelebrationSteps(scoring: ScoringEffect[], badges: BadgeChange[], c: Celebration | null): CelebrationStep[] {
  const scored = scoring.filter((e) => pointsGained(e) > 0);
  const steps: CelebrationStep[] = [
    { kind: "complete", totalPoints: scored.reduce((acc, e) => acc + pointsGained(e), 0), workoutNumber: c?.workoutNumber ?? null },
  ];
  if (scored.length > 0) steps.push({ kind: "points", seasons: scored });
  for (const e of scoring) {
    if (e.rankBefore !== null && e.rankAfter > 0 && e.rankAfter < e.rankBefore) {
      steps.push({ kind: "rank", effect: e, passed: c?.passed.find((p) => p.seasonId === e.seasonId)?.names ?? [] });
    }
  }
  if (c?.week) steps.push({ kind: "week", ...c.week });
  if (c && c.records.length > 0) steps.push({ kind: "records", records: c.records.slice(0, MAX_RECORDS) });
  const progressed = badges
    .filter((b) => b.levelAfter === b.levelBefore && b.progressAfter > b.progressBefore && b.nextThreshold !== null)
    .sort((a, b) => b.progressAfter / b.nextThreshold! - a.progressAfter / a.nextThreshold! || a.name.localeCompare(b.name))
    .slice(0, MAX_PROGRESSED_BADGES);
  if (progressed.length > 0) steps.push({ kind: "badgeProgress", changes: progressed });
  for (const b of badges) if (b.levelAfter > b.levelBefore) steps.push({ kind: "badge", change: b });
  return steps;
}

/**
 * Récords de peso: el mayor peso de cada ejercicio en este entrenamiento contra el mejor anterior.
 * Sin historial previo del ejercicio no es récord (si no, el primer entrenamiento sería todo récords).
 */
export function findNewRecords(
  current: { exerciseId: string; exerciseName: string; weightKg: number; reps: number | null }[],
  previousBest: Map<string, number>
): NewRecord[] {
  const best = new Map<string, (typeof current)[number]>();
  for (const s of current) {
    if (s.weightKg <= 0) continue;
    const b = best.get(s.exerciseId);
    if (!b || s.weightKg > b.weightKg || (s.weightKg === b.weightKg && (s.reps ?? 0) > (b.reps ?? 0))) best.set(s.exerciseId, s);
  }
  const out: NewRecord[] = [];
  for (const s of best.values()) {
    const prev = previousBest.get(s.exerciseId);
    if (prev !== undefined && s.weightKg > prev) out.push({ ...s, previousKg: prev });
  }
  return out.sort((a, b) => b.weightKg - b.previousKg - (a.weightKg - a.previousKg) || a.exerciseName.localeCompare(b.exerciseName));
}

/** Quiénes quedaron entre el puesto nuevo y el anterior: son los que el usuario pasó. */
export function passedUsers(
  standings: { userId: string; name: string | null; rank: number }[],
  userId: string,
  rankBefore: number,
  rankAfter: number
): string[] {
  return standings.filter((s) => s.userId !== userId && s.rank > rankAfter && s.rank <= rankBefore).map((s) => firstName(s.name));
}
