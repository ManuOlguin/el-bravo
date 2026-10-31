import { describe, it, expect } from "vitest";
import { computeSeasonScores, dayPoints } from "./compute";
import { rules, act, week, addD, AFTER, TZ } from "./test-helpers";
import { zonedToUtc } from "@/src/lib/time";

const workoutPts = (r: ReturnType<typeof computeSeasonScores>) => r.lines.filter((l) => l.kind === "workout").map((l) => l.points);
const total = (r: ReturnType<typeof computeSeasonScores>, u: string) => r.totals.find((t) => t.userId === u)!;

describe("curva de puntos del día", () => {
  it("valores de referencia de D1 (con tope de 4 h)", () => {
    expect([19, 20, 30, 45, 60, 90, 120, 180, 240, 300].map((m) => dayPoints(rules(), m)))
      .toEqual([0, 17, 20, 23, 26, 30, 33, 38, 42, 42]);
  });
  it("una actividad por día: puntos según su duración", () => {
    const mins = [20, 30, 45, 60, 120, 180, 300];
    const r = computeSeasonScores(rules(), ["u"], mins.map((m, i) => act("u", addD("2026-11-02", i), "18:00", m)), AFTER);
    expect(workoutPts(r)).toEqual([17, 20, 23, 26, 33, 38, 42]);
  });
  it("el peso de la categoría multiplica los minutos (slider)", () => {
    const r = computeSeasonScores(rules(), ["u"], [act("u", "2026-11-02", "18:00", 30, "run"), act("u", "2026-11-03", "18:00", 60, "yoga")], AFTER);
    expect(workoutPts(r)).toEqual([26, 20]); // 30×2=60 → 26 ; 60×0,5=30 → 20
  });
});

describe("qué no cuenta", () => {
  it("día corto, categoría fuera de temporada y fechas fuera de rango", () => {
    const r = computeSeasonScores(rules(), ["u"], [
      act("u", "2026-11-02", "18:00", 19), act("u", "2026-11-03", "18:00", 45, "swim"), act("u", "2026-11-30", "10:00", 45),
    ], AFTER);
    const w = r.lines.filter((l) => l.kind === "workout");
    expect(w.map((l) => [l.points, l.reason])).toEqual([[0, "El día sumó menos de 20 min"], [0, "Esta actividad no cuenta en la temporada"]]);
    expect(total(r, "u").daysTrained).toBe(0);
  });
  it("peso 0 equivale a categoría deshabilitada", () => {
    const r = computeSeasonScores(rules({ categoryWeights: { gym: 0 } }), ["u"], [act("u", "2026-11-02")], AFTER);
    expect(r.lines.map((l) => [l.points, l.reason])).toEqual([[0, "Esta actividad no cuenta en la temporada"]]);
  });
});

describe("varias actividades el mismo día", () => {
  it("se suman al tiempo del día y cada una recibe su marginal", () => {
    const r = computeSeasonScores(rules(), ["u"], [act("u", "2026-11-02", "07:00", 60), act("u", "2026-11-02", "19:00", 30)], AFTER);
    expect(workoutPts(r)).toEqual([26, 4]); // P(60)=26, P(90)=30
    expect(total(r, "u")).toMatchObject({ points: 30, daysTrained: 1, activities: 2, minutes: 90 });
  });
  it("dos actividades cortas que juntas superan el mínimo", () => {
    const r = computeSeasonScores(rules(), ["u"], [act("u", "2026-11-02", "07:00", 10), act("u", "2026-11-02", "19:00", 10)], AFTER);
    expect(r.lines.filter((l) => l.kind === "workout").map((l) => [l.points, l.reason])).toEqual([[0, "Sumó al tiempo del día"], [17, null]]);
    expect(total(r, "u").daysTrained).toBe(1);
  });
  it("3 actividades en un día no cumplen el objetivo semanal (cuenta días)", () => {
    const r = computeSeasonScores(rules(), ["u"], [act("u", "2026-11-02", "07:00"), act("u", "2026-11-02", "12:00"), act("u", "2026-11-02", "19:00")], AFTER);
    expect(workoutPts(r)).toEqual([23, 7, 5]); // P(45)=23, P(90)=30, P(135)=35
    expect(r.lines.some((l) => l.kind === "weekly_goal")).toBe(false);
  });
  it("el día se calcula en la zona del grupo (domingo 23:30 AR no es lunes)", () => {
    const r = computeSeasonScores(rules(), ["u"], [act("u", "2026-11-08", "23:30"), act("u", "2026-11-09", "00:30")], AFTER);
    expect(workoutPts(r)).toEqual([23, 23]);
    expect(total(r, "u").daysTrained).toBe(2);
  });
});

describe("objetivo semanal y racha", () => {
  it("+20 por semana cumplida y racha +5, +10, +15", () => {
    const acts = [...week("u", "2026-11-02"), ...week("u", "2026-11-09"), ...week("u", "2026-11-16"), ...week("u", "2026-11-23")];
    const r = computeSeasonScores(rules(), ["u"], acts, AFTER);
    expect(r.lines.filter((l) => l.kind === "weekly_goal").map((l) => l.points)).toEqual([20, 20, 20, 20]);
    expect(r.lines.filter((l) => l.kind === "streak").map((l) => l.points)).toEqual([5, 10, 15]);
    expect(total(r, "u")).toMatchObject({ points: 12 * 23 + 80 + 30, weeksGoalMet: 4, bestStreak: 4, currentStreak: 4, daysTrained: 12 });
  });
  it("el tope de racha es +25", () => {
    const r = computeSeasonScores(rules({ endDate: "2026-12-27" }), ["u"],
      Array.from({ length: 8 }, (_, i) => week("u", addD("2026-11-02", i * 7))).flat(), new Date("2027-01-15T12:00:00Z"));
    expect(r.lines.filter((l) => l.kind === "streak").map((l) => l.points)).toEqual([5, 10, 15, 20, 25, 25, 25]);
  });
  it("una semana sin cumplir corta la racha", () => {
    const acts = [...week("u", "2026-11-02"), ...week("u", "2026-11-09", 2), ...week("u", "2026-11-16"), ...week("u", "2026-11-23")];
    const r = computeSeasonScores(rules(), ["u"], acts, AFTER);
    expect(r.lines.filter((l) => l.kind === "streak").map((l) => l.points)).toEqual([5]);
    expect(total(r, "u")).toMatchObject({ bestStreak: 2, currentStreak: 2 });
  });
  it("semana parcial: objetivo = días de la semana dentro de la temporada", () => {
    const r = computeSeasonScores(rules({ startDate: "2026-11-07" }), ["u"], [act("u", "2026-11-07"), act("u", "2026-11-08")], AFTER);
    expect(total(r, "u").weeks[0]).toMatchObject({ weekKey: "2026-11-02", target: 2, goalMet: true });
  });
  it("la semana en curso no corta la racha ni se inventan semanas futuras", () => {
    const now = zonedToUtc("2026-11-17", "12:00", TZ);
    const r = computeSeasonScores(rules(), ["u"], [...week("u", "2026-11-02"), ...week("u", "2026-11-09"), act("u", "2026-11-16")], now);
    expect(total(r, "u").currentStreak).toBe(2);
    expect(total(r, "u").weeks).toHaveLength(3);
    expect(total(r, "u").weeks.at(-1)).toMatchObject({ finished: false, goalMet: false });
  });
  it("antes de que empiece la temporada no hay semanas", () => {
    const r = computeSeasonScores(rules(), ["u"], [], new Date("2026-10-01T12:00:00Z"));
    expect(total(r, "u")).toMatchObject({ points: 0, weeks: [] });
  });
});

describe("la constancia gana (escenarios de D1)", () => {
  it("2 días × 2 h supera a 1 día con 3 actividades de 45 min", () => {
    const r = computeSeasonScores(rules(), ["b", "d"], [
      act("b", "2026-11-02", "18:00", 120), act("b", "2026-11-04", "18:00", 120),
      act("d", "2026-11-03", "07:00"), act("d", "2026-11-03", "12:00"), act("d", "2026-11-03", "19:00"),
    ], AFTER);
    expect(total(r, "b").points).toBe(66);
    expect(total(r, "d").points).toBe(35);
  });
  it("4 días × 45 min = 112 en la semana", () => {
    const r = computeSeasonScores(rules({ endDate: "2026-11-08" }), ["a"], week("a", "2026-11-02", 4), AFTER);
    expect(total(r, "a").points).toBe(4 * 23 + 20);
  });
  it("3 días de 1 h, uno con 30 min extra = 102", () => {
    const r = computeSeasonScores(rules({ endDate: "2026-11-08" }), ["a"], [
      ...week("a", "2026-11-02", 3, 60), act("a", "2026-11-02", "20:00", 30),
    ], AFTER);
    expect(total(r, "a").points).toBe(102);
  });
});

describe("miembros y ranking", () => {
  it("ignora no-miembros e incluye miembros sin actividad con 0", () => {
    const r = computeSeasonScores(rules(), ["u", "v"], [act("x", "2026-11-02")], AFTER);
    expect(r.totals.map((t) => [t.userId, t.points])).toEqual([["u", 0], ["v", 0]]);
  });
  it("puntos → semanas cumplidas → días; empates comparten puesto", () => {
    const r = computeSeasonScores(rules(), ["a", "b", "c"], [act("a", "2026-11-02"), act("b", "2026-11-02")], AFTER);
    expect(r.ranked.map((t) => [t.userId, t.rank])).toEqual([["a", 1], ["b", 1], ["c", 3]]);
  });
  it("es determinista: el orden de entrada no cambia el resultado", () => {
    const acts = [act("u", "2026-11-02", "07:00", 30), act("u", "2026-11-02", "19:00", 70), act("u", "2026-11-03")];
    expect(computeSeasonScores(rules(), ["u"], [...acts].reverse(), AFTER)).toEqual(computeSeasonScores(rules(), ["u"], acts, AFTER));
  });
});
