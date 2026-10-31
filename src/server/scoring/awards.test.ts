import { describe, it, expect } from "vitest";
import { computeSeasonScores } from "./compute";
import { computeAwardWinners, SEASON_AWARD_TYPES, SEASON_AWARD_INFO, seasonGoalWeeks, type SeasonAwardType } from "./awards";
import { rules, act, week, AFTER } from "./test-helpers";
import type { ScoringActivity } from "./types";

function winners(type: SeasonAwardType, members: string[], acts: ScoringActivity[], r = rules()) {
  const scores = computeSeasonScores(r, members, acts, AFTER);
  return computeAwardWinners(type, scores, acts, r);
}

describe("catálogo", () => {
  it("cada tipo tiene nombre, descripción, ícono y unidad", () => {
    for (const t of SEASON_AWARD_TYPES) expect(SEASON_AWARD_INFO[t]).toMatchObject({ name: expect.any(String), description: expect.any(String), icon: expect.any(String), unit: expect.any(String) });
    expect(SEASON_AWARD_INFO.most_days).toMatchObject({ name: "El más constante", description: "Más días entrenados" });
  });
});

describe("computeAwardWinners", () => {
  it("most_days: más días entrenados (varias actividades el mismo día cuentan 1)", () => {
    const acts = [act("a", "2026-11-02"), act("a", "2026-11-03"), act("b", "2026-11-02", "07:00"), act("b", "2026-11-02", "19:00")];
    expect(winners("most_days", ["a", "b"], acts)).toEqual([{ userId: "a", value: 2 }]);
  });

  it("most_minutes: minutos reales de los días que cuentan", () => {
    const acts = [act("a", "2026-11-02", "18:00", 60), act("b", "2026-11-02", "18:00", 90), act("b", "2026-11-03", "18:00", 10)];
    expect(winners("most_minutes", ["a", "b"], acts)).toEqual([{ userId: "b", value: 90 }]);
  });

  it("best_streak: mejor racha de semanas cumplidas", () => {
    const acts = [...week("a", "2026-11-02"), ...week("a", "2026-11-09"), ...week("b", "2026-11-02")];
    expect(winners("best_streak", ["a", "b"], acts)).toEqual([{ userId: "a", value: 2 }]);
  });

  it("longest_session: actividad más larga en un día que cuenta", () => {
    const acts = [act("a", "2026-11-02", "18:00", 120), act("b", "2026-11-02", "18:00", 90), act("b", "2026-11-05", "18:00", 300, "swim")];
    expect(winners("longest_session", ["a", "b"], acts)).toEqual([{ userId: "a", value: 120 }]);
  });

  it("most_categories: categorías distintas", () => {
    const acts = [act("a", "2026-11-02", "18:00", 45, "gym"), act("a", "2026-11-03", "18:00", 45, "run"), act("b", "2026-11-02")];
    expect(winners("most_categories", ["a", "b"], acts)).toEqual([{ userId: "a", value: 2 }]);
  });

  it("perfect_attendance: todos los que cumplieron todas las semanas", () => {
    const all = (u: string) => ["2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23"].flatMap((m) => week(u, m));
    const acts = [...all("a"), ...all("b"), ...week("c", "2026-11-02")];
    expect(winners("perfect_attendance", ["a", "b", "c"], acts)).toEqual([{ userId: "a", value: 4 }, { userId: "b", value: 4 }]);
  });

  it("empate: ganan los dos", () => {
    const acts = [act("a", "2026-11-02"), act("b", "2026-11-03")];
    expect(winners("most_days", ["a", "b"], acts)).toEqual([{ userId: "a", value: 1 }, { userId: "b", value: 1 }]);
  });

  it("máximo 0: no hay ganadores", () => {
    for (const t of SEASON_AWARD_TYPES) expect(winners(t, ["a", "b"], [])).toEqual([]);
  });

  it("seasonGoalWeeks cuenta semanas parciales", () => {
    expect(seasonGoalWeeks(rules({ startDate: "2026-11-07", endDate: "2026-11-10" }))).toBe(2);
  });
});
