/** Ejercicios usados recientemente (por dispositivo, en `localStorage`). Todo acceso con try/catch. */

export const RECENT_KEY = "elbravo:recent-exercises";
export const RECENT_MAX = 8;

type KV = { getItem(k: string): string | null; setItem(k: string, v: string): void };

/** Los nuevos van primero (en el orden dado), sin duplicados, con tope de `max`. */
export function mergeRecent(prev: string[], ids: string[], max = RECENT_MAX): string[] {
  return [...new Set([...ids, ...prev])].slice(0, max);
}

export function readRecent(storage: KV | null | undefined): string[] {
  try {
    const raw = storage?.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string").slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

export function pushRecent(ids: string[], storage: KV | null | undefined): string[] {
  const next = mergeRecent(readRecent(storage), ids);
  try {
    storage?.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Modo privado / sin espacio: los recientes son una comodidad, no importa perderlos.
  }
  return next;
}

function browserStorage(): KV | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export const recent = {
  get: () => readRecent(browserStorage()),
  push: (ids: string[]) => pushRecent(ids, browserStorage()),
};
