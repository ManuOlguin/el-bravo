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

describe("premios divertidos", () => {
  type Extra = { categorySlug?: string; legs?: number; arms?: number; volumeKg?: number; photos?: number };
  /** Contexto armado a mano: datos extra por actividad y reacciones. */
  function ctxOf(extras: [ScoringActivity, Extra][], reactions: { received?: Record<string, number>; given?: Record<string, number> } = {}) {
    return {
      activities: new Map(
        extras.map(([a, e]) => [
          a.id,
          { categorySlug: e.categorySlug ?? null, setsByGroup: { legs: e.legs ?? 0, arms: e.arms ?? 0 }, volumeKg: e.volumeKg ?? 0, photos: e.photos ?? 0 },
        ])
      ),
      reactionsReceived: new Map(Object.entries(reactions.received ?? {})),
      reactionsGiven: new Map(Object.entries(reactions.given ?? {})),
    };
  }
  const run = (type: SeasonAwardType, members: string[], acts: ScoringActivity[], ctx = ctxOf([]), r = rules()) =>
    computeAwardWinners(type, computeSeasonScores(r, members, acts, AFTER), acts, r, ctx);

  it("todos tienen grupo; el catálogo no repite nombres", () => {
    for (const t of SEASON_AWARD_TYPES) expect(SEASON_AWARD_INFO[t].group).toBeTruthy();
    const names = SEASON_AWARD_TYPES.map((t) => SEASON_AWARD_INFO[t].name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("El Piernas: más series de piernas (repartidas por músculo); Mueve Montañas: más kilos", () => {
    const a1 = act("a", "2026-11-02"), a2 = act("a", "2026-11-03"), b1 = act("b", "2026-11-02");
    const ctx = ctxOf([[a1, { legs: 6, volumeKg: 1000 }], [a2, { legs: 2.5 }], [b1, { legs: 9, arms: 12, volumeKg: 3000 }]]);
    expect(run("legs", ["a", "b"], [a1, a2, b1], ctx)).toEqual([{ userId: "b", value: 9 }]); // a: 6 + 2,5 = 8,5
    expect(run("arms", ["a", "b"], [a1, a2, b1], ctx)).toEqual([{ userId: "b", value: 12 }]);
    expect(run("volume", ["a", "b"], [a1, a2, b1], ctx)).toEqual([{ userId: "b", value: 3000 }]);
    // Nadie hizo series de core: sin ganador.
    expect(run("core", ["a", "b"], [a1, a2, b1], ctx)).toEqual([]);
  });

  it("deportes: minutos por categoría; Rata de Gimnasio cuenta sesiones de fuerza", () => {
    const r1 = act("a", "2026-11-02", "18:00", 40, "run"), r2 = act("b", "2026-11-02", "18:00", 30, "run"), g1 = act("b", "2026-11-03"), g2 = act("b", "2026-11-04");
    const ctx = ctxOf([[r1, { categorySlug: "running" }], [r2, { categorySlug: "trail_running" }], [g1, { categorySlug: "strength" }], [g2, { categorySlug: "crossfit" }]]);
    expect(run("running", ["a", "b"], [r1, r2, g1, g2], ctx)).toEqual([{ userId: "a", value: 40 }]);
    expect(run("gym_rat", ["a", "b"], [r1, r2, g1, g2], ctx)).toEqual([{ userId: "b", value: 2 }]);
  });

  it("horarios en la zona del grupo: Gallo (< 8), Búho (≥ 21), Finde y Lunes Sagrado", () => {
    const acts = [
      act("a", "2026-11-02", "07:59"), // lunes temprano
      act("a", "2026-11-09", "06:30"), // lunes temprano
      act("b", "2026-11-03", "21:00"), // martes de noche
      act("b", "2026-11-07", "10:00"), // sábado
      act("b", "2026-11-08", "22:15"), // domingo de noche
    ];
    expect(run("early_bird", ["a", "b"], acts)).toEqual([{ userId: "a", value: 2 }]);
    expect(run("night_owl", ["a", "b"], acts)).toEqual([{ userId: "b", value: 2 }]);
    expect(run("weekend", ["a", "b"], acts)).toEqual([{ userId: "b", value: 2 }]);
    expect(run("monday", ["a", "b"], acts)).toEqual([{ userId: "a", value: 2 }]);
  });

  it("Doble Turno: días con dos actividades; Último Minuto: semanas salvadas el domingo", () => {
    // a: semana 1 con lunes, miércoles y domingo (el domingo completa las 3) → 1 semana salvada.
    // b: semana 1 con lunes, martes, miércoles y domingo → ya había cumplido: no cuenta.
    const acts = [
      act("a", "2026-11-02"), act("a", "2026-11-04"), act("a", "2026-11-08"),
      ...week("b", "2026-11-02"), act("b", "2026-11-08"), act("b", "2026-11-08", "08:00", 30),
    ];
    expect(run("last_minute", ["a", "b"], acts)).toEqual([{ userId: "a", value: 1 }]);
    expect(run("double_shift", ["a", "b"], acts)).toEqual([{ userId: "b", value: 1 }]);
  });

  it("social: fotos, reacciones recibidas y dadas", () => {
    const a1 = act("a", "2026-11-02"), b1 = act("b", "2026-11-02");
    const ctx = ctxOf([[a1, { photos: 3 }], [b1, { photos: 1 }]], { received: { a: 2, b: 5 }, given: { a: 7 } });
    expect(run("influencer", ["a", "b"], [a1, b1], ctx)).toEqual([{ userId: "a", value: 3 }]);
    expect(run("popular", ["a", "b"], [a1, b1], ctx)).toEqual([{ userId: "b", value: 5 }]);
    expect(run("fan", ["a", "b"], [a1, b1], ctx)).toEqual([{ userId: "a", value: 7 }]);
  });

  it("El Fantasma: el que menos días entrenó (empates incluidos); sin ganador si todos igual", () => {
    const acts = [...week("a", "2026-11-02"), act("b", "2026-11-02")];
    expect(run("ghost", ["a", "b", "c"], acts)).toEqual([{ userId: "c", value: 0 }]);
    expect(run("ghost", ["a", "b"], acts)).toEqual([{ userId: "b", value: 1 }]);
    expect(run("ghost", ["a", "b"], [act("a", "2026-11-02"), act("b", "2026-11-03")])).toEqual([]);
    expect(SEASON_AWARD_INFO.ghost.shame).toBe(true);
  });

  it("solo cuentan las actividades dentro de la temporada", () => {
    const before = act("a", "2026-11-01", "07:00"), inside = act("b", "2026-11-02", "07:00");
    expect(run("early_bird", ["a", "b"], [before, inside])).toEqual([{ userId: "b", value: 1 }]);
  });
});
