import { describe, it, expect } from "vitest";
import { daysBetween, formatWeight, medalOf, startsInLabel, timeLeftLabel, weekdayIndex, weightExplanation } from "./format";

describe("format de temporada", () => {
  it("daysBetween cuenta días calendario", () => {
    expect(daysBetween("2026-11-01", "2026-11-01")).toBe(0);
    expect(daysBetween("2026-11-01", "2026-12-01")).toBe(30);
    expect(daysBetween("2026-11-05", "2026-11-01")).toBe(-4);
  });
  it("tiempo restante y faltante", () => {
    expect(timeLeftLabel("2026-11-10", "2026-11-10")).toBe("Último día");
    expect(timeLeftLabel("2026-11-10", "2026-11-11")).toBe("Termina mañana");
    expect(timeLeftLabel("2026-11-10", "2026-11-20")).toBe("Faltan 10 días");
    expect(startsInLabel("2026-11-10", "2026-11-11")).toBe("Empieza mañana");
    expect(startsInLabel("2026-11-10", "2026-11-13")).toBe("Empieza en 3 días");
  });
  it("pesos con coma decimal", () => {
    expect(formatWeight(1.5)).toBe("×1,5");
    expect(formatWeight(2)).toBe("×2");
    expect(formatWeight(0.25)).toBe("×0,25");
    expect(weightExplanation(1.5)).toBe("×1,5 → 30 min cuentan como 45 min");
    expect(weightExplanation(0.25)).toBe("×0,25 → 30 min cuentan como 7,5 min");
    expect(weightExplanation(0)).toBe("No suma puntos");
  });
  it("medallas y días de la semana", () => {
    expect([1, 2, 3, 4].map(medalOf)).toEqual(["🥇", "🥈", "🥉", null]);
    expect(weekdayIndex("2026-11-02")).toBe(0); // lunes
    expect(weekdayIndex("2026-11-08")).toBe(6); // domingo
  });
});
