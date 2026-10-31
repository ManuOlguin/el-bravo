import { describe, it, expect } from "vitest";
import { romanLevel, levelTone, levelToneClass, ringFraction, progressLabel, splitBadgeChanges } from "./levels";
import type { BadgeChange } from "@/src/server/badges/types";

describe("romanLevel", () => {
  it.each([
    [1, "I"],
    [2, "II"],
    [3, "III"],
    [4, "IV"],
    [9, "IX"],
    [14, "XIV"],
  ])("%i → %s", (n, s) => {
    expect(romanLevel(n)).toBe(s);
  });

  it("0 o negativo → vacío", () => {
    expect(romanLevel(0)).toBe("");
    expect(romanLevel(-1)).toBe("");
  });
});

describe("levelTone", () => {
  it.each([
    [0, "locked"],
    [1, "bronze"],
    [2, "silver"],
    [3, "gold"],
    [4, "gold"],
  ] as const)("nivel %i → %s", (level, tone) => {
    expect(levelTone(level)).toBe(tone);
  });

  it("cada tono usa un token de color", () => {
    expect(levelToneClass(1)).toBe("text-bronze");
    expect(levelToneClass(2)).toBe("text-silver");
    expect(levelToneClass(3)).toBe("text-gold");
    expect(levelToneClass(0)).toBe("text-fg-subtle");
  });
});

describe("ringFraction / progressLabel", () => {
  it("fracción hacia el próximo umbral", () => {
    expect(ringFraction({ progress: 3, nextThreshold: 10 })).toBeCloseTo(0.3);
    expect(ringFraction({ progress: 0, nextThreshold: 10 })).toBe(0);
  });

  it("nivel máximo → anillo completo", () => {
    expect(ringFraction({ progress: 500, nextThreshold: null })).toBe(1);
  });

  it("etiqueta de progreso", () => {
    expect(progressLabel({ progress: 3, nextThreshold: 10 })).toBe("3/10");
    expect(progressLabel({ progress: 500, nextThreshold: null })).toBe("Nivel máximo");
  });
});

describe("splitBadgeChanges", () => {
  const ch = (code: string, lb: number, la: number, pb: number, pa: number): BadgeChange => ({
    code, name: code, iconKey: null, levelBefore: lb, levelAfter: la, progressBefore: pb, progressAfter: pa, nextThreshold: 10,
  });

  it("separa subidas de nivel y hasta 3 avances; ignora bajas", () => {
    const { levelUps, progressed } = splitBadgeChanges([
      ch("A", 0, 0, 1, 2),
      ch("UP", 0, 1, 9, 10),
      ch("B", 0, 0, 1, 2),
      ch("DOWN", 1, 0, 10, 9),
      ch("C", 0, 0, 1, 2),
      ch("D", 0, 0, 1, 2),
    ]);
    expect(levelUps.map((c) => c.code)).toEqual(["UP"]);
    expect(progressed.map((c) => c.code)).toEqual(["A", "B", "C"]);
  });

  it("sin cambios → listas vacías", () => {
    expect(splitBadgeChanges([])).toEqual({ levelUps: [], progressed: [] });
  });
});
