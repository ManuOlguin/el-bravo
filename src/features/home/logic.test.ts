import { describe, expect, it } from "vitest";
import { addDays } from "@/src/lib/time";
import type { StandingRow } from "@/src/server/scoring/types";
import { firstName, greetingMessage, standingHint, summarizeStanding } from "./logic";

const MON = "2026-11-02";
const days = Array.from({ length: 7 }, (_, i) => ({ date: addDays(MON, i) }));
const base = { goal: 3, currentStreakWeeks: 0, totalWorkouts: 10, days, today: addDays(MON, 2) };

describe("greetingMessage", () => {
  it("usuario nuevo", () => {
    expect(greetingMessage({ ...base, workoutsThisWeek: 0, totalWorkouts: 0 })).toMatch(/primer entrenamiento/);
  });
  it("le falta 1 o varios", () => {
    expect(greetingMessage({ ...base, workoutsThisWeek: 2 })).toBe("Te falta 1 entrenamiento para cumplir la semana 💪");
    expect(greetingMessage({ ...base, workoutsThisWeek: 1 })).toBe("Te faltan 2 entrenamientos para cumplir la semana 💪");
  });
  it("semana cumplida, con y sin racha", () => {
    expect(greetingMessage({ ...base, workoutsThisWeek: 3, currentStreakWeeks: 4 })).toBe("¡Semana cumplida! 🔥 Racha de 4");
    expect(greetingMessage({ ...base, workoutsThisWeek: 4, currentStreakWeeks: 1 })).toBe("¡Semana cumplida! 🔥");
  });
  it("semana sin arrancar", () => {
    expect(greetingMessage({ ...base, workoutsThisWeek: 0, today: MON })).toBe("Arrancá la semana con todo");
    expect(greetingMessage({ ...base, workoutsThisWeek: 0, today: MON, currentStreakWeeks: 2 })).toMatch(/racha de 2/);
  });
  it("si ya no llega, no le pide lo imposible", () => {
    expect(greetingMessage({ ...base, workoutsThisWeek: 0, today: addDays(MON, 6) })).toMatch(/cada entrenamiento suma/);
  });
});

describe("firstName", () => {
  it("primer nombre o vacío", () => {
    expect(firstName("  Manu  Olguín ")).toBe("Manu");
    expect(firstName(null)).toBe("");
  });
});

const row = (userId: string, rank: number, points: number): StandingRow => ({
  userId, name: userId, photoUrl: null, rank, points, daysTrained: 0, activities: 0, weeksGoalMet: 0, currentStreak: 0, bestStreak: 0, minutes: 0,
});

describe("summarizeStanding / standingHint", () => {
  const rows = [row("a", 1, 355), row("b", 2, 340), row("c", 3, 100)];
  it("segundo: distancia al #1", () => {
    const s = summarizeStanding(rows, "b")!;
    expect(s).toEqual({ rank: 2, points: 340, members: 3, gapToFirst: 15, leadOverNext: null });
    expect(standingHint(s)).toBe("a 15 del #1");
  });
  it("primero: ventaja sobre el siguiente", () => {
    expect(standingHint(summarizeStanding(rows, "a")!)).toBe("15 pts de ventaja");
  });
  it("empates y casos borde", () => {
    expect(standingHint(summarizeStanding([row("a", 1, 10), row("b", 1, 10)], "b")!)).toBe("Empatado en el #1");
    expect(standingHint(summarizeStanding([row("a", 1, 10)], "a")!)).toBe("Sos el único en la tabla");
    expect(summarizeStanding(rows, "zzz")).toBeNull();
  });
});
