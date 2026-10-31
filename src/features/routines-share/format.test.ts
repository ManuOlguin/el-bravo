import { describe, expect, it } from "vitest";
import type { RoutineForEditor } from "@/src/schemas/routine";
import { looksLikeBravoFormat, parseRoutineText, routineToText } from "./format";

const s = (reps: number | null, weightKg: number | null = null, kind = "normal", durationSeconds: number | null = null) => ({ kind, reps, weightKg, durationSeconds });

describe("parseRoutineText", () => {
  it("lee el formato que escribe El Bravo", () => {
    const p = parseRoutineText(`🏋️ Pecho y espalda
Notas: llegar al fallo en la última

Press de banca — 4×8 @ 60 kg · desc 90s
Remo con barra — 10 @ 50 kg, 8 @ 55 kg, 6 @ 62,5 kg
Plancha — 3×45s
Dominadas — 3×máx
Muscle up — 3×fallo
Fondos — F máx @ 10 kg

Hecho con El Bravo · https://elbravo.vercel.app/routines/abc`);
    expect(p.name).toBe("Pecho y espalda");
    expect(p.notes).toBe("llegar al fallo en la última");
    expect(p.exercises).toEqual([
      { name: "Press de banca", restSeconds: 90, sets: [s(8, 60), s(8, 60), s(8, 60), s(8, 60)] },
      { name: "Remo con barra", restSeconds: null, sets: [s(10, 50), s(8, 55), s(6, 62.5)] },
      { name: "Plancha", restSeconds: null, sets: [s(null, null, "normal", 45), s(null, null, "normal", 45), s(null, null, "normal", 45)] },
      { name: "Dominadas", restSeconds: null, sets: [s(null), s(null), s(null)] },
      { name: "Muscle up", restSeconds: null, sets: [s(null, null, "failure"), s(null, null, "failure"), s(null, null, "failure")] },
      { name: "Fondos", restSeconds: null, sets: [s(null, 10, "failure")] },
    ]);
    expect(p.unparsedLines).toEqual([]);
    expect(looksLikeBravoFormat(p)).toBe(true);
  });

  it("es tolerante: x/X/*, guión o dos puntos, sin kg, tiempo m:ss, prefijos W/D/F", () => {
    const p = parseRoutineText(`Piernas
sentadilla - 3x10 @ 80
Peso muerto: 3 X 5 @ 100kg
Bici: 1x20:00
Prensa — W 15 @ 50, 10 @ 120 kg, D 8 @ 90 kg`);
    expect(p.exercises.map((e) => e.name)).toEqual(["sentadilla", "Peso muerto", "Bici", "Prensa"]);
    expect(p.exercises[0].sets[0]).toEqual(s(10, 80));
    expect(p.exercises[1].sets).toHaveLength(3);
    expect(p.exercises[2].sets).toEqual([s(null, null, "normal", 1200)]);
    expect(p.exercises[3].sets).toEqual([s(15, 50, "warmup"), s(10, 120), s(8, 90, "drop")]);
  });

  it("un texto libre no es formato El Bravo", () => {
    const p = parseRoutineText(`Día 1: hacé 4 series de banca pesada, después remo y terminá con abs.
Descansá bien entre series.`);
    expect(looksLikeBravoFormat(p)).toBe(false);
  });

  it("limita series a 30 y reps/tiempo a rangos válidos", () => {
    const p = parseRoutineText(`X\nBanca — 99×8`);
    expect(p.exercises[0].sets).toHaveLength(30);
  });
});

const ex = (name: string, o: Partial<{ measureType: "reps" | "duration"; tracksWeight: boolean }> = {}) => ({
  id: name, name, nameEn: null, measureType: o.measureType ?? "reps", equipment: "barbell" as const, tracksWeight: o.tracksWeight ?? true, primaryGroupKey: null, mediaUrl: null,
});
const rs = (targetReps: number | null, targetWeightKg: number | null = null, kind: "normal" | "warmup" | "drop" | "failure" = "normal", targetDurationSeconds: number | null = null) =>
  ({ kind, targetReps, targetWeightKg, targetDurationSeconds, restSeconds: null });

const ROUTINE: RoutineForEditor = {
  id: "r1", name: "Pecho y espalda", notes: "llegar al fallo",
  exercises: [
    { exercise: ex("Press de banca"), restSeconds: 90, notes: null, sets: [rs(8, 60), rs(8, 60), rs(8, 60), rs(8, 60)] },
    { exercise: ex("Remo con barra"), restSeconds: null, notes: null, sets: [rs(10, 50), rs(8, 55), rs(6, 62.5)] },
    { exercise: ex("Plancha", { measureType: "duration", tracksWeight: false }), restSeconds: null, notes: null, sets: [rs(null, null, "normal", 45), rs(null, null, "normal", 45)] },
    { exercise: ex("Dominadas", { tracksWeight: false }), restSeconds: null, notes: null, sets: [rs(null, null, "failure"), rs(null, null, "failure")] },
    { exercise: ex("Prensa"), restSeconds: null, notes: null, sets: [rs(15, 50, "warmup"), rs(10, 120)] },
  ],
};

/** Series con objetivos en blanco: deben sobrevivir a exportar y volver a importar. */
const BLANK_ROUTINE: RoutineForEditor = {
  id: "r2", name: "Libre", notes: null,
  exercises: [
    { exercise: ex("Flexiones", { tracksWeight: false }), restSeconds: null, notes: null, sets: [rs(null), rs(null), rs(null)] },
    { exercise: ex("Aperturas"), restSeconds: null, notes: null, sets: [rs(null, null, "warmup"), rs(12, 10)] },
    { exercise: ex("Curl"), restSeconds: 60, notes: null, sets: [rs(10, 20), rs(null, 15, "drop")] },
    { exercise: ex("Remo"), restSeconds: null, notes: null, sets: [rs(null, 20, "warmup"), rs(null, null, "failure")] },
    { exercise: ex("Press militar"), restSeconds: null, notes: null, sets: [rs(12, 20, "warmup"), rs(12, 20, "warmup"), rs(12, 20, "warmup")] },
  ],
};

describe("routineToText", () => {
  it("escribe el formato canónico", () => {
    expect(routineToText(ROUTINE, { url: "https://elbravo.vercel.app/routines/r1" })).toBe(`🏋️ Pecho y espalda
Notas: llegar al fallo

Press de banca — 4×8 @ 60 kg · desc 90s
Remo con barra — 10 @ 50 kg, 8 @ 55 kg, 6 @ 62,5 kg
Plancha — 2×45s
Dominadas — 2×F máx
Prensa — W 15 @ 50 kg, 10 @ 120 kg

Hecho con El Bravo · https://elbravo.vercel.app/routines/r1`);
  });

  it("ida y vuelta: leer lo escrito devuelve las mismas series", () => {
    const p = parseRoutineText(routineToText(ROUTINE));
    expect(p.name).toBe(ROUTINE.name);
    expect(p.exercises.map((e) => [e.name, e.restSeconds, e.sets.map((x) => [x.kind, x.reps, x.weightKg, x.durationSeconds])])).toEqual(
      ROUTINE.exercises.map((e) => [e.exercise.name, e.restSeconds, e.sets.map((x) => [x.kind, x.targetReps, x.targetWeightKg, x.targetDurationSeconds])])
    );
  });

  it("ida y vuelta sin pérdida con series en blanco, de calentamiento o drop sin reps", () => {
    const text = routineToText(BLANK_ROUTINE);
    expect(text).toContain("Flexiones — 3×máx\n");
    expect(text).toContain("Press militar — 3×W 12 @ 20 kg\n");
    const p = parseRoutineText(text);
    expect(p.exercises.map((e) => [e.name, e.restSeconds, e.sets.map((y) => [y.kind, y.reps, y.weightKg, y.durationSeconds])])).toEqual(
      BLANK_ROUTINE.exercises.map((e) => [e.exercise.name, e.restSeconds, e.sets.map((y) => [y.kind, y.targetReps, y.targetWeightKg, y.targetDurationSeconds])])
    );
  });

  it("sin url, el pie no lleva link", () => {
    expect(routineToText(ROUTINE).trimEnd().split("\n").at(-1)).toBe("Hecho con El Bravo");
  });
});
