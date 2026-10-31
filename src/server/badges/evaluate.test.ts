import { describe, it, expect } from "vitest";
import { evaluateBadge, type BadgeDef } from "./evaluate";

const def = (thresholds: number[]): BadgeDef => ({
  id: "b1",
  code: "EL_PERSISTENTE",
  name: "El Persistente",
  metric: "total_workouts",
  params: {},
  levels: thresholds.map((threshold, i) => ({ level: i + 1, threshold })),
});

describe("evaluateBadge", () => {
  const d = def([10, 50, 150]);

  it.each([
    [0, 0, 10],
    [9, 0, 10],
    [10, 1, 50],
    [149, 2, 150],
    [150, 3, null],
    [500, 3, null],
  ])("valor %i → nivel %i, próximo %s", (value, level, next) => {
    expect(evaluateBadge(d, value)).toEqual({
      badgeId: "b1",
      code: "EL_PERSISTENTE",
      level,
      progress: value,
      nextThreshold: next,
      maxLevel: 3,
    });
  });

  it("ordena los niveles aunque vengan desordenados", () => {
    const unordered: BadgeDef = {
      ...d,
      levels: [
        { level: 3, threshold: 150 },
        { level: 1, threshold: 10 },
        { level: 2, threshold: 50 },
      ],
    };
    expect(evaluateBadge(unordered, 60)).toMatchObject({ level: 2, nextThreshold: 150, maxLevel: 3 });
  });

  it("sin niveles: nivel 0, sin próximo", () => {
    expect(evaluateBadge(def([]), 5)).toMatchObject({ level: 0, nextThreshold: null, maxLevel: 0, progress: 5 });
  });
});
