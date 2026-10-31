import { describe, it, expect } from "vitest";
import { mergeRecent, readRecent, pushRecent, RECENT_KEY, RECENT_MAX } from "./recent";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  };
}

const throwing = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
};

describe("mergeRecent", () => {
  it("pone los nuevos primero, en el orden dado, sin duplicados", () => {
    expect(mergeRecent(["a", "b", "c"], ["c", "d"])).toEqual(["c", "d", "a", "b"]);
    expect(mergeRecent([], ["x", "x", "y"])).toEqual(["x", "y"]);
  });
  it("guarda como máximo 8", () => {
    const prev = ["1", "2", "3", "4", "5", "6", "7", "8"];
    expect(RECENT_MAX).toBe(8);
    expect(mergeRecent(prev, ["new"])).toEqual(["new", "1", "2", "3", "4", "5", "6", "7"]);
  });
});

describe("readRecent / pushRecent", () => {
  it("persiste y lee en orden", () => {
    const s = memoryStorage();
    pushRecent(["a"], s);
    pushRecent(["b", "c"], s);
    expect(readRecent(s)).toEqual(["b", "c", "a"]);
  });
  it("ignora datos corruptos", () => {
    expect(readRecent(memoryStorage({ [RECENT_KEY]: "{nope" }))).toEqual([]);
    expect(readRecent(memoryStorage({ [RECENT_KEY]: JSON.stringify({ a: 1 }) }))).toEqual([]);
    expect(readRecent(memoryStorage({ [RECENT_KEY]: JSON.stringify(["a", 2, null, "b"]) }))).toEqual(["a", "b"]);
  });
  it("tolera un localStorage que tira error o que no existe", () => {
    expect(readRecent(throwing)).toEqual([]);
    expect(pushRecent(["a"], throwing)).toEqual(["a"]);
    expect(readRecent(null)).toEqual([]);
    expect(pushRecent(["a"], null)).toEqual(["a"]);
  });
});
