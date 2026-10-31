/**
 * Secuencia de festejo post-entrenamiento (estilo "terminaste la lección"): funciones puras que deciden
 * qué pantallas mostrar y en qué orden, a partir de los efectos del guardado. Sin I/O.
 */
import type { ScoringEffect } from "@/src/server/scoring/types";
import type { BadgeChange } from "@/src/server/badges/types";
import type { Celebration, MiniStanding, NewRecord, SeasonStandingWindow } from "./types";

export type CelebrationStep =
  | { kind: "complete"; totalPoints: number; workoutNumber: number | null }
  | { kind: "points"; seasons: { effect: ScoringEffect; standings: SeasonStandingWindow | null }[] }
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
 * Orden: completo → puntos (con la mini tabla de cada temporada: si subió de puesto, se anima ahí) → semana → récords → avance de
 * insignias (las más cerca del próximo nivel) → insignias (una por cada subida de nivel, como cierre).
 * Lo que no pasó no tiene pantalla.
 */
export function buildCelebrationSteps(scoring: ScoringEffect[], badges: BadgeChange[], c: Celebration | null): CelebrationStep[] {
  const scored = scoring.filter((e) => pointsGained(e) > 0);
  const steps: CelebrationStep[] = [
    { kind: "complete", totalPoints: scored.reduce((acc, e) => acc + pointsGained(e), 0), workoutNumber: c?.workoutNumber ?? null },
  ];
  if (scored.length > 0) {
    steps.push({
      kind: "points",
      seasons: scored.map((effect) => ({ effect, standings: c?.standings.find((s) => s.seasonId === effect.seasonId) ?? null })),
    });
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

/** Subió de puesto en la temporada (tenía puesto antes y ahora está más arriba). */
export const climbed = (e: ScoringEffect) => e.rankBefore !== null && e.rankAfter > 0 && e.rankAfter < e.rankBefore;

/**
 * Ventana de `size` filas del ranking (ordenado por puesto) con el usuario y sus vecinos: uno arriba y
 * uno abajo; si es primero o último, se corre para seguir mostrando `size`. Sin el usuario: vacía.
 */
export function standingsWindow<T extends { userId: string }>(rows: T[], userId: string, size = 3): T[] {
  const i = rows.findIndex((r) => r.userId === userId);
  if (i < 0) return [];
  const start = Math.max(0, Math.min(i - 1, rows.length - size));
  return rows.slice(start, start + size);
}

/**
 * Orden de las filas ANTES del entrenamiento: los demás no cambiaron sus puntos, el usuario tenía
 * `pointsBefore`. A igual puntaje el usuario queda abajo (todavía no los había pasado).
 */
export function orderBefore(rows: MiniStanding[], userId: string, pointsBefore: number): string[] {
  const pts = (r: MiniStanding) => (r.userId === userId ? pointsBefore : r.points);
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => pts(b.r) - pts(a.r) || (a.r.userId === userId ? 1 : b.r.userId === userId ? -1 : a.i - b.i))
    .map(({ r }) => r.userId);
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
