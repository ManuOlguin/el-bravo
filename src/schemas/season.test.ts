import { describe, it, expect } from "vitest";
import { seasonInputSchema, rangesOverlap } from "./season";

const base = {
  groupId: "g1",
  name: "Noviembre",
  startDate: "2026-11-02",
  endDate: "2026-11-29",
  weeklyGoal: 3,
  categories: [{ activityCategoryId: "gym", weight: 1 }],
};
const errors = (input: unknown) => {
  const r = seasonInputSchema.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
};

describe("seasonInputSchema", () => {
  it("acepta el mínimo y completa los defaults", () => {
    const r = seasonInputSchema.parse(base);
    expect(r).toMatchObject({ minDailyMinutes: 20, resultsReveal: "auto", awards: [] });
    expect(r.rules).toBeUndefined();
  });

  it("acepta pesos en pasos de 0,25 entre 0 y 2", () => {
    const cats = [0, 0.25, 0.5, 1.75, 2].map((weight, i) => ({ activityCategoryId: `c${i}`, weight }));
    expect(errors({ ...base, categories: cats })).toEqual([]);
  });

  it("rechaza pesos fuera de rango o que no son múltiplo de 0,25", () => {
    expect(errors({ ...base, categories: [{ activityCategoryId: "gym", weight: 2.25 }] })).toEqual(["categories.0.weight: El peso va de 0 a 2"]);
    expect(errors({ ...base, categories: [{ activityCategoryId: "gym", weight: -0.25 }] })).toHaveLength(2); // rango + ninguna con peso > 0
    expect(errors({ ...base, categories: [{ activityCategoryId: "gym", weight: 0.3 }] })).toEqual(["categories.0.weight: El peso va en pasos de 0,25"]);
  });

  it("exige al menos una categoría con peso > 0", () => {
    expect(errors({ ...base, categories: [] })).toEqual(["categories: Elegí al menos un tipo de actividad"]);
    expect(errors({ ...base, categories: [{ activityCategoryId: "gym", weight: 0 }] })).toEqual([
      "categories: Al menos un tipo de actividad tiene que sumar (peso mayor a 0)",
    ]);
  });

  it("rechaza categorías y premios repetidos", () => {
    expect(errors({ ...base, categories: [base.categories[0], base.categories[0]] })).toEqual(["categories: Hay tipos de actividad repetidos"]);
    const aw = { awardType: "most_days", bonusPoints: 10 };
    expect(errors({ ...base, awards: [aw, aw] })).toEqual(["awards: Hay premios repetidos"]);
  });

  it("valida fechas: formato, fin ≥ inicio y máximo un año", () => {
    expect(errors({ ...base, startDate: "2026-02-30" })).toEqual(["startDate: La fecha de inicio no es válida"]);
    expect(errors({ ...base, endDate: "2026-11-01" })).toEqual(["endDate: La fecha de fin tiene que ser igual o posterior al inicio"]);
    expect(errors({ ...base, endDate: "2026-11-02" })).toEqual([]);
    expect(errors({ ...base, endDate: "2027-11-02" })).toEqual([]);
    expect(errors({ ...base, endDate: "2027-11-03" })).toEqual(["endDate: La temporada puede durar como máximo un año"]);
  });

  it("valida objetivo, minutos mínimos, premios y reglas avanzadas", () => {
    expect(errors({ ...base, weeklyGoal: 0 })).toEqual(["weeklyGoal: Objetivo semanal: mínimo 1"]);
    expect(errors({ ...base, weeklyGoal: 8 })).toEqual(["weeklyGoal: Objetivo semanal: máximo 7"]);
    expect(errors({ ...base, minDailyMinutes: 4 })).toHaveLength(1);
    expect(errors({ ...base, awards: [{ awardType: "nope", bonusPoints: 0 }] })).toEqual(["awards.0.awardType: Premio desconocido"]);
    expect(errors({ ...base, awards: [{ awardType: "most_days", bonusPoints: 201 }] })).toHaveLength(1);
    const rules = { dayBasePoints: 10, timePointsFactor: 10, timeCurveMinutes: 30, maxDailyMinutes: 240, weeklyGoalBonus: 20, streakBonusStep: 5, streakBonusCap: 25 };
    expect(errors({ ...base, rules })).toEqual([]);
    expect(errors({ ...base, rules: { ...rules, timeCurveMinutes: 0 } })).toHaveLength(1);
  });

  it("rechaza nombre vacío", () => {
    expect(errors({ ...base, name: "   " })).toEqual(["name: Poné un nombre para la temporada"]);
  });
});

describe("rangesOverlap (superposición de temporadas)", () => {
  const a = { startDate: "2026-11-02", endDate: "2026-11-29" };
  it("se pisan si comparten al menos un día (inclusivo)", () => {
    expect(rangesOverlap(a, { startDate: "2026-11-29", endDate: "2026-12-20" })).toBe(true);
    expect(rangesOverlap(a, { startDate: "2026-10-01", endDate: "2026-11-02" })).toBe(true);
    expect(rangesOverlap(a, { startDate: "2026-11-10", endDate: "2026-11-12" })).toBe(true);
  });
  it("no se pisan si son contiguas", () => {
    expect(rangesOverlap(a, { startDate: "2026-11-30", endDate: "2026-12-20" })).toBe(false);
    expect(rangesOverlap(a, { startDate: "2026-10-01", endDate: "2026-11-01" })).toBe(false);
  });
});
