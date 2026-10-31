import { describe, expect, it } from "vitest";
import { looksLikeBravoFormat, parseRoutineText } from "./format";

const s = (reps: number | null, weightKg: number | null = null, kind = "normal", durationSeconds: number | null = null) => ({ kind, reps, weightKg, durationSeconds });

describe("parseRoutineText", () => {
  it("lee el formato que escribe El Bravo", () => {
    const p = parseRoutineText(`🏋️ Pecho y espalda
Notas: llegar al fallo en la última

Press de banca — 4×8 @ 60 kg · desc 90s
Remo con barra — 10 @ 50 kg, 8 @ 55 kg, 6 @ 62,5 kg
Plancha — 3×45s
Dominadas — 3×máx

Hecho con El Bravo · https://elbravo.vercel.app/routines/abc`);
    expect(p.name).toBe("Pecho y espalda");
    expect(p.notes).toBe("llegar al fallo en la última");
    expect(p.exercises).toEqual([
      { name: "Press de banca", restSeconds: 90, sets: [s(8, 60), s(8, 60), s(8, 60), s(8, 60)] },
      { name: "Remo con barra", restSeconds: null, sets: [s(10, 50), s(8, 55), s(6, 62.5)] },
      { name: "Plancha", restSeconds: null, sets: [s(null, null, "normal", 45), s(null, null, "normal", 45), s(null, null, "normal", 45)] },
      { name: "Dominadas", restSeconds: null, sets: [s(null, null, "failure"), s(null, null, "failure"), s(null, null, "failure")] },
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
