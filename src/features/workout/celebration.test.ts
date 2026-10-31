import { describe, expect, it } from "vitest";
import type { ScoringEffect } from "@/src/server/scoring/types";
import type { BadgeChange } from "@/src/server/badges/types";
import { buildCelebrationSteps, climbed, findNewRecords, firstName, orderBefore, passedUsers, standingsWindow } from "./celebration";
import type { Celebration, MiniStanding, SeasonStandingWindow } from "./types";

const effect = (o: Partial<ScoringEffect> = {}): ScoringEffect => ({
  seasonId: "s1",
  seasonName: "Temporada",
  groupId: "g1",
  groupName: "Grupo",
  activityPoints: 20,
  activityReason: null,
  totalBefore: 100,
  totalAfter: 120,
  rankBefore: 2,
  rankAfter: 2,
  ...o,
});

const badge = (o: Partial<BadgeChange> = {}): BadgeChange => ({
  code: "b",
  name: "El Persistente",
  iconKey: null,
  levelBefore: 0,
  levelAfter: 1,
  progressBefore: 2,
  progressAfter: 3,
  nextThreshold: 10,
  ...o,
});

const celebration = (o: Partial<Celebration> = {}): Celebration => ({ workoutNumber: 7, week: null, records: [], standings: [], ...o });

describe("buildCelebrationSteps", () => {
  it("siempre arranca con 'completo' y suma lo que subió el total en todas las temporadas", () => {
    const steps = buildCelebrationSteps(
      [effect({ totalBefore: 100, totalAfter: 120 }), effect({ seasonId: "s2", totalBefore: 50, totalAfter: 56 })],
      [],
      celebration()
    );
    expect(steps[0]).toEqual({ kind: "complete", totalPoints: 26, workoutNumber: 7 });
    expect(steps[1]).toMatchObject({ kind: "points" });
  });

  it("cuenta la suba del total, no los puntos asignados a la actividad (día compartido, bonus de semana)", () => {
    // El día ya tenía otra actividad: a esta le tocan 26 por orden, pero el total sube 9; con la semana cumplida, +20 más.
    const steps = buildCelebrationSteps([effect({ activityPoints: 26, totalBefore: 305, totalAfter: 334 })], [], null);
    expect(steps[0]).toMatchObject({ totalPoints: 29 });
  });

  it("sin puntos ni logros: una sola pantalla", () => {
    const steps = buildCelebrationSteps([effect({ activityPoints: 0, totalBefore: 100, totalAfter: 100 })], [], null);
    expect(steps).toEqual([{ kind: "complete", totalPoints: 0, workoutNumber: null }]);
  });

  it("orden completo → puntos → semana → récords → insignias, solo lo que pasó; la tabla va en puntos", () => {
    const window: SeasonStandingWindow = { seasonId: "s1", meId: "me", rows: [], passed: ["Beto", "Caro"] };
    const steps = buildCelebrationSteps(
      [effect({ rankBefore: 3, rankAfter: 1 })],
      [badge(), badge({ code: "p", levelBefore: 1, levelAfter: 1 })],
      celebration({
        week: { workouts: 3, goal: 3, justMet: true, perfectStreak: 2 },
        records: [{ exerciseId: "e", exerciseName: "Banca", weightKg: 85, reps: 5, previousKg: 80 }],
        standings: [window],
      })
    );
    expect(steps.map((s) => s.kind)).toEqual(["complete", "points", "week", "records", "badgeProgress", "badge"]);
    expect(steps[1]).toMatchObject({ kind: "points", seasons: [{ standings: window }] });
  });

  it("climbed: solo si mejoró (no si bajó, se mantuvo o es su primer puesto)", () => {
    expect(climbed(effect({ rankBefore: 3, rankAfter: 1 }))).toBe(true);
    expect(climbed(effect({ rankBefore: 2, rankAfter: 3 }))).toBe(false);
    expect(climbed(effect({ rankBefore: 2, rankAfter: 2 }))).toBe(false);
    expect(climbed(effect({ rankBefore: null, rankAfter: 1 }))).toBe(false);
  });

  it("insignias: una pantalla por subida de nivel; el progreso sin subir no tiene pantalla", () => {
    const steps = buildCelebrationSteps([], [badge({ code: "a" }), badge({ code: "b", levelBefore: 1, levelAfter: 2 }), badge({ code: "c", levelBefore: 1, levelAfter: 1 })], null);
    expect(steps.filter((s) => s.kind === "badge")).toHaveLength(2);
  });

  it("avance de insignias: las 3 más cerca del próximo nivel, sin las de nivel máximo", () => {
    const step = buildCelebrationSteps(
      [],
      [
        badge({ code: "a", levelBefore: 1, levelAfter: 1, progressBefore: 1, progressAfter: 2, nextThreshold: 10 }),
        badge({ code: "b", levelBefore: 1, levelAfter: 1, progressBefore: 3, progressAfter: 4, nextThreshold: 5 }),
        badge({ code: "c", levelBefore: 1, levelAfter: 1, progressBefore: 5, progressAfter: 6, nextThreshold: 10 }),
        badge({ code: "d", levelBefore: 1, levelAfter: 1, progressBefore: 7, progressAfter: 9, nextThreshold: 30 }),
        badge({ code: "max", levelBefore: 3, levelAfter: 3, progressBefore: 90, progressAfter: 99, nextThreshold: null }),
      ],
      null
    ).find((s) => s.kind === "badgeProgress");
    expect(step && step.kind === "badgeProgress" && step.changes.map((c) => c.code)).toEqual(["b", "c", "d"]);
  });

  it("como mucho 3 récords", () => {
    const records = Array.from({ length: 5 }, (_, i) => ({ exerciseId: `e${i}`, exerciseName: `E${i}`, weightKg: 50 + i, reps: 5, previousKg: 40 }));
    const step = buildCelebrationSteps([], [], celebration({ records })).find((s) => s.kind === "records");
    expect(step && step.kind === "records" && step.records).toHaveLength(3);
  });
});

describe("findNewRecords", () => {
  const sets = [
    { exerciseId: "bench", exerciseName: "Press de banca", weightKg: 80, reps: 8 },
    { exerciseId: "bench", exerciseName: "Press de banca", weightKg: 85, reps: 5 },
    { exerciseId: "squat", exerciseName: "Sentadillas", weightKg: 100, reps: 5 },
    { exerciseId: "row", exerciseName: "Remo", weightKg: 60, reps: 10 },
  ];

  it("toma el mejor peso del entrenamiento y lo compara con el mejor anterior", () => {
    const r = findNewRecords(sets, new Map([["bench", 82.5], ["squat", 100]]));
    expect(r).toEqual([{ exerciseId: "bench", exerciseName: "Press de banca", weightKg: 85, reps: 5, previousKg: 82.5 }]);
  });

  it("igualar el récord no es récord; sin historial del ejercicio tampoco", () => {
    expect(findNewRecords(sets, new Map([["squat", 100]]))).toEqual([]);
  });

  it("ordena por mayor mejora en kg", () => {
    const r = findNewRecords(sets, new Map([["bench", 84], ["row", 50]]));
    expect(r.map((x) => x.exerciseId)).toEqual(["row", "bench"]);
  });
});

describe("passedUsers", () => {
  const standings = [
    { userId: "me", name: "Ana Demo", rank: 1 },
    { userId: "b", name: "Beto Pérez", rank: 2 },
    { userId: "c", name: "Caro", rank: 3 },
    { userId: "d", name: null, rank: 4 },
  ];

  it("de 3° a 1°: pasó a los que ahora están 2° y 3°", () => {
    expect(passedUsers(standings, "me", 3, 1)).toEqual(["Beto", "Caro"]);
  });

  it("sin nombre: 'alguien'", () => {
    // De 4° a 3°: pasó al que ahora está 4° (sin nombre).
    expect(passedUsers([{ userId: "me", name: "Ana", rank: 3 }, standings[3]], "me", 4, 3)).toEqual(["alguien"]);
  });

  it("firstName", () => {
    expect([firstName("  Beto  Pérez "), firstName(null), firstName("")]).toEqual(["Beto", "alguien", "alguien"]);
  });
});

describe("mini tabla del ranking", () => {
  const row = (userId: string, rank: number, points: number): MiniStanding => ({ userId, name: userId, photoUrl: null, rank, points });
  const table = [row("a", 1, 300), row("b", 2, 250), row("me", 3, 240), row("c", 4, 200), row("d", 5, 100)];

  it("ventana: uno arriba y uno abajo; en los bordes se corre para mostrar 3", () => {
    expect(standingsWindow(table, "me").map((r) => r.userId)).toEqual(["b", "me", "c"]);
    expect(standingsWindow(table, "a").map((r) => r.userId)).toEqual(["a", "b", "me"]);
    expect(standingsWindow(table, "d").map((r) => r.userId)).toEqual(["me", "c", "d"]);
    expect(standingsWindow(table.slice(0, 2), "a").map((r) => r.userId)).toEqual(["a", "b"]);
    expect(standingsWindow(table, "nadie")).toEqual([]);
  });

  it("orden de antes: con los puntos previos del usuario, que pierde los empates", () => {
    // Ahora: a 300, me 260, b 250. Antes tenía 240: estaba abajo de b.
    const after = [row("a", 1, 300), row("me", 2, 260), row("b", 3, 250)];
    expect(orderBefore(after, "me", 240)).toEqual(["a", "b", "me"]);
    // Empate antes (250 = 250): queda abajo, todavía no lo había pasado.
    expect(orderBefore(after, "me", 250)).toEqual(["a", "b", "me"]);
    // No subió: mismo orden.
    expect(orderBefore(after, "me", 255)).toEqual(["a", "me", "b"]);
  });
});
