import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readRestTimer, restTimerKey, writeRestTimer } from "./rest-alerts";

// localStorage mínimo (los tests unitarios corren en Node).
const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  };
});
afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

const KEY = restTimerKey("workout-draft:live:r1");
const T0 = 1_800_000_000_000;

describe("descanso guardado", () => {
  it("la clave no se confunde con la del borrador (el aviso global busca por prefijo)", () => {
    expect(KEY).toBe("rest-timer:workout-draft:live:r1");
    expect(KEY.startsWith("workout-draft:live:")).toBe(false);
  });

  it("sobrevive a una recarga mientras corre", () => {
    writeRestTimer(KEY, { id: 1, startMs: T0, totalS: 90 });
    expect(readRestTimer(KEY, T0 + 60_000)).toEqual({ id: 1, startMs: T0, totalS: 90 });
  });

  it("si terminó hace poco (< 30 s) se restaura para avisar; si hace más, no", () => {
    writeRestTimer(KEY, { id: 1, startMs: T0, totalS: 90 });
    expect(readRestTimer(KEY, T0 + 110_000)).not.toBeNull();
    expect(readRestTimer(KEY, T0 + 125_000)).toBeNull();
  });

  it("null borra; basura o versión vieja se ignora", () => {
    writeRestTimer(KEY, { id: 1, startMs: T0, totalS: 90 });
    writeRestTimer(KEY, null);
    expect(readRestTimer(KEY, T0)).toBeNull();
    store.set(KEY, "{no es json");
    expect(readRestTimer(KEY, T0)).toBeNull();
    store.set(KEY, JSON.stringify({ startMs: "ayer" }));
    expect(readRestTimer(KEY, T0)).toBeNull();
  });
});
