// Limitador de intentos en memoria, con ventana deslizante (log de timestamps por clave).
// Es POR INSTANCIA del servidor: en Vercel cada lambda tiene su propio mapa. Es suficiente para la
// escala actual (un grupo de amigos); si hiciera falta algo global, se cambia por Redis/DB acá.

const hits = new Map<string, number[]>();
let lastSweep = 0;
const SWEEP_EVERY_MS = 5 * 60_000;
const MAX_WINDOW_MS = 24 * 60 * 60_000; // ninguna clave vive más de un día sin uso

function sweep(now: number) {
  if (now - lastSweep < SWEEP_EVERY_MS) return;
  lastSweep = now;
  for (const [key, list] of hits) {
    if (!list.length || now - list[list.length - 1] > MAX_WINDOW_MS) hits.delete(key);
  }
}

/**
 * Registra un intento para `key` si hay lugar en la ventana.
 * Los intentos rechazados no se registran (no extienden el bloqueo).
 */
export function rateLimit(key: string, opts: { max: number; windowMs: number }): { ok: boolean; retryAfterS: number } {
  const now = Date.now();
  sweep(now);
  const recent = (hits.get(key) ?? []).filter((t) => now - t < opts.windowMs);
  if (recent.length >= opts.max) {
    hits.set(key, recent);
    const retryAfterMs = recent[0] + opts.windowMs - now;
    return { ok: false, retryAfterS: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }
  recent.push(now);
  hits.set(key, recent);
  return { ok: true, retryAfterS: 0 };
}

/** Olvida los intentos de `key` (p. ej. después de un login correcto). */
export function resetRateLimit(key: string) {
  hits.delete(key);
}

/** Solo para tests. */
export function __clearRateLimits() {
  hits.clear();
  lastSweep = 0;
}

/** "N minutos" para los mensajes de bloqueo. */
export function retryAfterMinutes(retryAfterS: number) {
  return Math.max(1, Math.ceil(retryAfterS / 60));
}
