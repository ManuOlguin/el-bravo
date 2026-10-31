/** Lógica pura de la home (W2-4): mensaje del saludo y resumen de posición en una temporada. */
import type { LocalDate } from "@/src/lib/time";
import type { StandingRow } from "@/src/server/scoring/types";

export function firstName(name: string | null | undefined): string {
  const n = name?.trim();
  return n ? n.split(/\s+/)[0] : "";
}

/**
 * Mensaje dinámico del saludo según cómo viene la semana.
 * `days` son los 7 días (lunes..domingo) de la semana actual y `today` la fecha local de hoy.
 */
export function greetingMessage(input: {
  workoutsThisWeek: number;
  goal: number;
  currentStreakWeeks: number;
  totalWorkouts: number;
  days: { date: LocalDate }[];
  today: LocalDate;
}): string {
  const { workoutsThisWeek: done, goal, currentStreakWeeks: streak, totalWorkouts, days, today } = input;
  if (totalWorkouts === 0) return "Registrá tu primer entrenamiento y arrancá la racha 💪";
  if (done >= goal) return streak > 1 ? `¡Semana cumplida! 🔥 Racha de ${streak}` : "¡Semana cumplida! 🔥";
  const missing = goal - done;
  const todayIndex = days.findIndex((d) => d.date === today);
  const daysLeft = todayIndex < 0 ? 7 : 7 - todayIndex; // incluye hoy
  if (missing > daysLeft) return "Esta semana no llegás al objetivo, pero cada entrenamiento suma 💪";
  if (done === 0) return streak > 0 ? `Arrancá la semana con todo y sostené la racha de ${streak} 🔥` : "Arrancá la semana con todo";
  return missing === 1 ? "Te falta 1 entrenamiento para cumplir la semana 💪" : `Te faltan ${missing} entrenamientos para cumplir la semana 💪`;
}

export type StandingSummary = {
  rank: number;
  points: number;
  members: number;
  /** Puntos que le faltan para alcanzar al #1 (0 si es #1). */
  gapToFirst: number;
  /** Si es #1: ventaja sobre el siguiente (null si está solo o empatado con nadie detrás). */
  leadOverNext: number | null;
};

/** Posición de `userId` en el ranking de una temporada, o null si no participa. */
export function summarizeStanding(rows: StandingRow[], userId: string): StandingSummary | null {
  const me = rows.find((r) => r.userId === userId);
  if (!me) return null;
  const top = rows.reduce((max, r) => Math.max(max, r.points), 0);
  let leadOverNext: number | null = null;
  if (me.rank === 1) {
    const next = rows.filter((r) => r.userId !== userId).reduce<number | null>((max, r) => (max === null || r.points > max ? r.points : max), null);
    leadOverNext = next === null ? null : me.points - next;
  }
  return { rank: me.rank, points: me.points, members: rows.length, gapToFirst: Math.max(0, top - me.points), leadOverNext };
}

/** Texto corto de la tarjeta de posición: "a 15 del #1", "15 de ventaja", "empatado en el #1". */
export function standingHint(s: StandingSummary): string {
  if (s.rank === 1) {
    if (s.leadOverNext === null) return "Sos el único en la tabla";
    if (s.leadOverNext === 0) return "Empatado en el #1";
    return `${s.leadOverNext} pts de ventaja`;
  }
  return s.gapToFirst === 0 ? "Empatado en el #1" : `a ${s.gapToFirst} del #1`;
}
