import { describe, it, expect } from "vitest";
import { splitEvenly, normalizeTo100, isValidShare, sumShare } from "./muscle-share";

describe("splitEvenly", () => {
  it("reparte en partes iguales en pasos de 5", () => {
    expect(splitEvenly(1)).toEqual([100]);
    expect(splitEvenly(2)).toEqual([50, 50]);
    expect(splitEvenly(3)).toEqual([35, 35, 30]);
    expect(splitEvenly(4)).toEqual([25, 25, 25, 25]);
    expect(splitEvenly(6)).toEqual([20, 20, 15, 15, 15, 15]);
  });
  it("siempre suma 100 y nunca da 0", () => {
    for (let n = 1; n <= 15; n++) {
      const v = splitEvenly(n);
      expect(sumShare(v)).toBe(100);
      expect(Math.min(...v)).toBeGreaterThan(0);
    }
  });
  it("0 músculos → vacío", () => expect(splitEvenly(0)).toEqual([]));
});

describe("normalizeTo100", () => {
  it("escala proporcionalmente", () => {
    expect(normalizeTo100([60, 30])).toEqual([65, 35]);
    expect(normalizeTo100([30, 30])).toEqual([50, 50]);
    expect(normalizeTo100([80, 40, 40])).toEqual([50, 25, 25]);
  });
  it("si ya suma 100 no cambia", () => expect(normalizeTo100([70, 20, 10])).toEqual([70, 20, 10]));
  it("todo en 0 → partes iguales", () => expect(normalizeTo100([0, 0])).toEqual([50, 50]));
  it("ningún músculo queda en 0", () => {
    const v = normalizeTo100([100, 1]);
    expect(sumShare(v)).toBe(100);
    expect(Math.min(...v)).toBeGreaterThan(0);
  });
  it("siempre suma 100", () => {
    for (const v of [[5, 5, 5], [95, 95, 10], [1, 2, 3, 4], [33, 33, 33]]) expect(sumShare(normalizeTo100(v))).toBe(100);
  });
});

describe("isValidShare", () => {
  it("suma 100, enteros 1..100, al menos uno", () => {
    expect(isValidShare([60, 40])).toBe(true);
    expect(isValidShare([100])).toBe(true);
    expect(isValidShare([])).toBe(false);
    expect(isValidShare([60, 30])).toBe(false);
    expect(isValidShare([100, 0])).toBe(false);
    expect(isValidShare([50.5, 49.5])).toBe(false);
  });
});
