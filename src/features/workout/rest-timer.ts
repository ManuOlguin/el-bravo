/** Lógica pura del temporizador de descanso (W2-1 Task 3). */

export const MAX_REST_SECONDS = 3600;
export const DEFAULT_REST = 90;

/** Segundos que faltan (enteros, redondeando hacia arriba); 0 cuando terminó. */
export function remaining(startMs: number, totalS: number, nowMs: number): number {
  return Math.max(0, Math.ceil((startMs + totalS * 1000 - nowMs) / 1000));
}

/** −15 s / +15 s, dentro de [0, 1 h]. */
export function adjustRest(totalS: number, deltaS: number): number {
  return Math.min(MAX_REST_SECONDS, Math.max(0, totalS + deltaS));
}

/** "1:30", "10:05", "1:02:05". */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** Descanso que corresponde a una serie: el de la serie, si no el del ejercicio, si no 90 s. */
export function restFor(set: { restSeconds: number | null }, exercise: { restSeconds: number | null }): number {
  return set.restSeconds ?? exercise.restSeconds ?? DEFAULT_REST;
}
