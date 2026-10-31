import { describe, it, expect } from "vitest";
import {
  activePreset,
  applyPreset,
  clampWeight,
  initialSeasonForm,
  mapFieldErrors,
  previewDayPoints,
  previewTable,
  seasonFormFromSummary,
  suggestedStart,
  summaryLine,
  toSeasonInput,
  validateSeasonForm,
  type CategoryOption,
} from "./season-form-state";
import { DEFAULT_RULES, type SeasonSummary } from "./types";

const CATS: CategoryOption[] = [
  { id: "c-strength", slug: "strength", name: "Fuerza" },
  { id: "c-running", slug: "running", name: "Running" },
  { id: "c-yoga", slug: "yoga_pilates", name: "Yoga" },
  { id: "c-crossfit", slug: "crossfit", name: "CrossFit" },
];
const TODAY = "2026-10-31"; // sábado
const G = "group-1";

describe("estado inicial", () => {
  it("arranca el lunes que viene, 4 semanas, todo ×1, premios por defecto y reglas de D1", () => {
    const s = initialSeasonForm(CATS, TODAY);
    expect(s.startDate).toBe("2026-11-02");
    expect(s.endDate).toBe("2026-11-29");
    expect(Object.values(s.categories)).toEqual(CATS.map(() => ({ enabled: true, weight: 1 })));
    expect(Object.entries(s.awards).filter(([, a]) => a.enabled).map(([t]) => t)).toEqual(["most_days", "best_streak"]);
    expect(s.rules.dayBasePoints).toBe(10);
    expect(s.weeklyGoal).toBe(3);
    expect(s.minDailyMinutes).toBe(20);
    expect(s.resultsReveal).toBe("auto");
    expect(activePreset(s, CATS)).toBe("equal");
  });
  it("si hoy es lunes empieza hoy", () => {
    expect(suggestedStart("2026-11-02")).toBe("2026-11-02");
    expect(suggestedStart("2026-11-08")).toBe("2026-11-09");
  });
});

describe("presets", () => {
  it("Solo gimnasio prende fuerza/crossfit y apaga el resto", () => {
    const s = applyPreset(initialSeasonForm(CATS, TODAY), "gym", CATS);
    expect(s.categories["c-strength"]).toEqual({ enabled: true, weight: 1 });
    expect(s.categories["c-crossfit"].enabled).toBe(true);
    expect(s.categories["c-running"].enabled).toBe(false);
    expect(s.categories["c-yoga"].enabled).toBe(false);
    expect(activePreset(s, CATS)).toBe("gym");
  });
  it("Más puntos al cardio pone ×1,5 al cardio", () => {
    const s = applyPreset(initialSeasonForm(CATS, TODAY), "cardio", CATS);
    expect(s.categories["c-running"]).toEqual({ enabled: true, weight: 1.5 });
    expect(s.categories["c-strength"]).toEqual({ enabled: true, weight: 1 });
    expect(activePreset(s, CATS)).toBe("cardio");
  });
  it("un ajuste manual no coincide con ningún preset", () => {
    const s = initialSeasonForm(CATS, TODAY);
    s.categories["c-yoga"] = { enabled: true, weight: 0.5 };
    expect(activePreset(s, CATS)).toBeNull();
  });
  it("clampWeight respeta pasos de 0,25 entre 0,25 y 2", () => {
    expect(clampWeight(1.3)).toBe(1.25);
    expect(clampWeight(5)).toBe(2);
    expect(clampWeight(0)).toBe(0.25);
  });
});

describe("conversión a SeasonInput", () => {
  it("solo manda categorías y premios activos, con pesos, bonus y reglas", () => {
    const s = initialSeasonForm(CATS, TODAY);
    s.name = "  Verano  ";
    s.categories["c-running"] = { enabled: true, weight: 2 };
    s.categories["c-yoga"] = { enabled: false, weight: 1 };
    s.awards.most_days.bonusPoints = 15;
    s.awards.longest_session = { enabled: true, bonusPoints: null };
    s.resultsReveal = "manual";
    const input = toSeasonInput(s, G);
    expect(input.name).toBe("Verano");
    expect(input.description).toBeNull();
    expect(input.categories).toEqual([
      { activityCategoryId: "c-strength", weight: 1 },
      { activityCategoryId: "c-running", weight: 2 },
      { activityCategoryId: "c-crossfit", weight: 1 },
    ]);
    expect(input.awards).toEqual([
      { awardType: "most_days", bonusPoints: 15 },
      { awardType: "best_streak", bonusPoints: 0 },
      { awardType: "longest_session", bonusPoints: 0 },
    ]);
    expect(input.rules).toEqual({
      dayBasePoints: 10, timePointsFactor: 10, timeCurveMinutes: 30, maxDailyMinutes: 240, weeklyGoalBonus: 20, streakBonusStep: 5, streakBonusCap: 25, activeStreakBonusStep: 2, activeStreakBonusCap: 10,
    });
    expect(input.resultsReveal).toBe("manual");
  });

  it("ida y vuelta desde una temporada guardada", () => {
    const summary: SeasonSummary = {
      id: "s1", name: "Otoño", description: "desc", startDate: "2026-11-02", endDate: "2026-11-29", status: "active", resultsReveal: "manual",
      resultsPublished: false, joined: true, memberCount: 3, weeklyGoal: 2,
      categories: [{ id: "c-running", name: "Running", weight: 2 }, { id: "c-yoga", name: "Yoga", weight: 0 }],
      awards: [{ awardType: "most_minutes", bonusPoints: 5 }],
      rules: { ...DEFAULT_RULES, weeklyGoal: 2, weeklyGoalBonus: 30 },
    };
    const s = seasonFormFromSummary(summary, CATS);
    expect(s.categories["c-running"]).toEqual({ enabled: true, weight: 2 });
    expect(s.categories["c-yoga"].enabled).toBe(false);
    expect(s.categories["c-strength"].enabled).toBe(false);
    const input = toSeasonInput(s, G);
    expect(input.categories).toEqual([{ activityCategoryId: "c-running", weight: 2 }]);
    expect(input.awards).toEqual([{ awardType: "most_minutes", bonusPoints: 5 }]);
    expect(input.weeklyGoal).toBe(2);
    expect(input.rules?.weeklyGoalBonus).toBe(30);
    expect(input.description).toBe("desc");
  });
});

describe("validación", () => {
  const valid = () => {
    const s = initialSeasonForm(CATS, TODAY);
    s.name = "Temporada";
    return s;
  };

  it("un formulario completo es válido", () => {
    const r = validateSeasonForm(valid(), G, []);
    expect(r.ok).toBe(true);
  });
  it("marca nombre vacío, fin antes del inicio y objetivo fuera de rango en su campo", () => {
    const s = valid();
    s.name = " ";
    s.endDate = "2026-11-01";
    s.weeklyGoal = 9;
    const r = validateSeasonForm(s, G, []);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.name).toMatch(/nombre/);
    expect(r.errors.endDate).toMatch(/posterior/);
    expect(r.errors.weeklyGoal).toMatch(/máximo 7/);
  });
  it("campos numéricos vacíos son un error (no un 0 silencioso)", () => {
    const s = valid();
    s.rules.dayBasePoints = null;
    const r = validateSeasonForm(s, G, []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors["rules.dayBasePoints"]).toBeTruthy();
  });
  it("sin actividades que sumen es un error de categorías", () => {
    const s = valid();
    for (const id of Object.keys(s.categories)) s.categories[id].enabled = false;
    const r = validateSeasonForm(s, G, []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.categories).toBeTruthy();
  });
  it("detecta la superposición con otra temporada y la muestra en las fechas", () => {
    const r = validateSeasonForm(valid(), G, [{ name: "Primavera", startDate: "2026-10-01", endDate: "2026-11-02" }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.startDate).toBe('Las fechas se superponen con la temporada "Primavera"');
    expect(validateSeasonForm(valid(), G, [{ name: "Vieja", startDate: "2026-10-01", endDate: "2026-11-01" }]).ok).toBe(true);
  });
  it("traduce los fieldErrors de la acción a las claves del formulario", () => {
    const s = valid();
    s.awards.most_minutes = { enabled: true, bonusPoints: 999 };
    expect(mapFieldErrors({ "awards.1.bonusPoints": ["máximo 200"], "categories.0.weight": ["x"], name: ["n"] }, s)).toEqual({
      "award.most_minutes": "máximo 200",
      categories: "x",
      name: "n",
    });
  });
});

describe("vista previa de puntos (D1)", () => {
  it("el resumen usa dayPoints con los valores por defecto", () => {
    expect(summaryLine(initialSeasonForm(CATS, TODAY))).toBe("Un día de 45 min = 23 pts · 1 h = 26 · 2 h = 33 · Semana cumplida = +20");
    expect(previewTable(initialSeasonForm(CATS, TODAY))).toEqual([
      { label: "30 min", points: 20 },
      { label: "1 h", points: 26 },
      { label: "2 h", points: 33 },
      { label: "3 h", points: 38 },
    ]);
  });
  it("running ×2: 30 min cuentan como 60 y suman 26", () => {
    const s = initialSeasonForm(CATS, TODAY);
    s.categories["c-running"] = { enabled: true, weight: 2 };
    expect(previewDayPoints(s, 30, "c-running")).toBe(26);
    expect(previewDayPoints(s, 30, "c-strength")).toBe(20);
    s.categories["c-running"].enabled = false;
    expect(previewDayPoints(s, 30, "c-running")).toBe(0);
  });
  it("cambia al mover los parámetros avanzados", () => {
    const s = initialSeasonForm(CATS, TODAY);
    s.rules.dayBasePoints = 20;
    s.rules.weeklyGoalBonus = 50;
    expect(summaryLine(s)).toBe("Un día de 45 min = 33 pts · 1 h = 36 · 2 h = 43 · Semana cumplida = +50");
  });
});
