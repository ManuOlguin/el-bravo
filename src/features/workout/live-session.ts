/**
 * Estado de un entrenamiento en vivo en el tiempo: cuánto lleva, cuándo fue la última serie tildada y si
 * parece olvidado (como pasaba en Strong: lo dejabas abierto y aparecía uno de 7 horas). Funciones puras.
 */
import type { WorkoutDraft } from "./state";

/** Sin tildar series durante más de 1 h: probablemente terminó y se olvidó de cerrarlo. */
export const IDLE_LIMIT_MS = 60 * 60_000;
/** Más de 3 h en total: se pide confirmar la duración antes de guardar. */
export const LONG_LIMIT_MS = 3 * 60 * 60_000;
/** Lo que se suma después de la última serie al sugerir la hora de fin (estirar, cambiarse). */
export const COOLDOWN_MS = 5 * 60_000;

export type LiveStatus = {
  startedAtMs: number;
  /** Última serie tildada (null si todavía no tildó ninguna). */
  lastSetAtMs: number | null;
  elapsedMs: number;
  /** Desde la última serie tildada o, si no hay, desde que empezó. */
  idleMs: number;
  /** Lleva más de `IDLE_LIMIT_MS` sin actividad. */
  stale: boolean;
  /** Dura más de `LONG_LIMIT_MS`. */
  long: boolean;
  /** Hora de fin sugerida: la última serie + `COOLDOWN_MS` (nunca después de ahora). Sin series: ahora. */
  suggestedEndMs: number;
};

export function lastSetAt(draft: WorkoutDraft): number | null {
  let last: number | null = null;
  for (const e of draft.exercises) for (const s of e.sets) if (s.completed && s.completedAt !== null && (last === null || s.completedAt > last)) last = s.completedAt;
  return last;
}

export function liveStatus(draft: WorkoutDraft, nowMs: number): LiveStatus {
  const startedAtMs = draft.startedAtMs ?? nowMs;
  const lastSetAtMs = lastSetAt(draft);
  const elapsedMs = Math.max(0, nowMs - startedAtMs);
  const idleMs = Math.max(0, nowMs - (lastSetAtMs ?? startedAtMs));
  return {
    startedAtMs,
    lastSetAtMs,
    elapsedMs,
    idleMs,
    stale: idleMs > IDLE_LIMIT_MS,
    long: elapsedMs > LONG_LIMIT_MS,
    suggestedEndMs: lastSetAtMs === null ? nowMs : Math.min(nowMs, lastSetAtMs + COOLDOWN_MS),
  };
}

/** Hay que confirmar la hora de fin antes de guardar. */
export const needsEndConfirmation = (s: LiveStatus) => s.stale || s.long;

export type EndChoice = { kind: "suggested" } | { kind: "now" } | { kind: "custom"; minutes: number };

/** Hora de fin según la elección (la duración a mano se cuenta desde el inicio, mínimo 1 min). */
export function endMsFor(choice: EndChoice, status: LiveStatus, nowMs: number): number {
  if (choice.kind === "suggested") return status.suggestedEndMs;
  if (choice.kind === "now") return nowMs;
  return Math.min(nowMs, status.startedAtMs + Math.max(1, Math.round(choice.minutes)) * 60_000);
}

/** Al volver a la pantalla: ofrecer retomar si tildó algo, o si lo empezó hace poco (aunque no haya tildado). */
export function isResumable(draft: WorkoutDraft, nowMs: number, setsDone: number): boolean {
  if (draft.mode !== "live" || draft.startedAtMs === null) return false;
  return setsDone > 0 || nowMs - draft.startedAtMs < IDLE_LIMIT_MS;
}
