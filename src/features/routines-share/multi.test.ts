// src/features/routines-share/multi.test.ts
import { describe, expect, it } from "vitest";
import type { CatalogEntry } from "@/src/features/exercises/types";
import type { AiRoutineImport } from "./ai-draft";
import { buildMultiDraft, multiDraftToInputs, omittedText, routinesUsing } from "./multi";
import type { ImportItem, ParsedSet } from "./types";

const cat = (name: string, o: Partial<CatalogEntry> = {}): CatalogEntry => ({
  id: name.toLowerCase().replace(/\s+/g, "-"), name, nameEn: null, measureType: "reps", equipment: "barbell", tracksWeight: true,
  primaryGroupKey: "chest", mediaUrl: null, aliases: [], groupKeys: ["chest"], isMine: false, ...o,
});
const CATALOG = [cat("Press de Banca"), cat("Plancha", { measureType: "duration", tracksWeight: false })];
const s = (reps: number, weightKg: number | null = null): ParsedSet => ({ kind: "normal", reps, durationSeconds: null, weightKg });
const routine = (name: string, exercises: [string, ParsedSet[]][], hints: AiRoutineImport["hints"] = {}): AiRoutineImport => ({
  parsed: { name, notes: null, exercises: exercises.map(([n, sets]) => ({ name: n, restSeconds: null, sets })), unparsedLines: [] },
  hints,
  sourceNames: exercises.map(([n]) => `decía ${n}`),
});
const REMO_HINT: AiRoutineImport["hints"] = { "remo hammer": { equipment: "machine", muscles: [{ muscleSlug: "espalda", percentage: 100 }], source: "ai" } };
const twoDays = () =>
  buildMultiDraft(
    [
      routine("Día 1", [["Press de Banca", [s(8, 60)]], ["Remo Hammer", [s(12)]]], REMO_HINT),
      routine("Día 2", [["remo hammer", [s(10), s(10)]], ["Plancha", [s(1)]]]),
    ],
    CATALOG
  );
const label = (i: ImportItem) => (i.match.kind === "found" ? i.match.exercise.name : `nuevo:${i.match.draft.name}`);

describe("buildMultiDraft", () => {
  it("una sola revisión: cada ejercicio distinto es un ítem aunque esté en varias rutinas; cada rutina conserva sus series", () => {
    const m = twoDays();
    expect(m.review.items.map(label)).toEqual(["Press de Banca", "nuevo:Remo Hammer", "Plancha"]);
    expect(m.review.items[1].match.kind === "new" && m.review.items[1].match.draft).toMatchObject({ equipment: "machine", source: "ai" });
    expect(m.review.items[1].sourceName).toBe("decía Remo Hammer");
    expect(m.routines.map((r) => [r.name, r.entries.map((e) => e.itemKey)])).toEqual([["Día 1", ["i0", "i1"]], ["Día 2", ["i1", "i2"]]]);
    expect(m.routines[1].entries[0].sets).toEqual([s(10), s(10)]);
    expect(routinesUsing(m)).toEqual({ i0: ["Día 1"], i1: ["Día 1", "Día 2"], i2: ["Día 2"] });
  });

  it("un nombre sin letras (clave vacía) nunca se junta con otro", () => {
    const m = buildMultiDraft([routine("A", [["🔥", [s(10)]]]), routine("B", [["🔥", [s(10)]]])], CATALOG);
    expect(m.review.items).toHaveLength(2);
  });
});

describe("multiDraftToInputs", () => {
  it("el nuevo revisado una vez vale para todas: mismo tempId y nombre editado; cada rutina manda solo los nuevos que usa", () => {
    const m = twoDays();
    const review = {
      ...m.review,
      items: m.review.items.map((i) => (i.match.kind === "new" ? { ...i, match: { kind: "new" as const, draft: { ...i.match.draft, name: "Remo en máquina Hammer" } } } : i)),
    };
    const remo = review.items[1].match;
    if (remo.kind !== "new") throw new Error("esperaba nuevo");
    const [d1, d2] = multiDraftToInputs({ ...m, review });
    expect(d1.exercises.map((e) => e.exerciseId)).toEqual(["press-de-banca", `new:${remo.draft.tempId}`]);
    expect(d2.exercises.map((e) => e.exerciseId)).toEqual([`new:${remo.draft.tempId}`, "plancha"]);
    expect(d1.newExercises).toEqual([expect.objectContaining({ tempId: remo.draft.tempId, name: "Remo en máquina Hammer", equipment: "machine" })]);
    expect(d2.newExercises).toEqual(d1.newExercises);
    expect(d2.exercises[0].sets).toEqual([
      { kind: "normal", targetReps: 10, targetWeightKg: null, targetDurationSeconds: null, restSeconds: null },
      { kind: "normal", targetReps: 10, targetWeightKg: null, targetDurationSeconds: null, restSeconds: null },
    ]);
    expect(d1).toMatchObject({ name: "Día 1", notes: null });
  });

  it("cambiar un ítem a uno del catálogo lo cambia en todas y ya no se manda el nuevo", () => {
    const m = twoDays();
    const plancha = m.review.items[2].match;
    const review = { ...m.review, items: m.review.items.map((i) => (i.key === "i1" ? { ...i, match: plancha } : i)) };
    const [d1, d2] = multiDraftToInputs({ ...m, review });
    expect(d1.exercises.map((e) => e.exerciseId)).toEqual(["press-de-banca", "plancha"]);
    expect(d2.exercises.map((e) => e.exerciseId)).toEqual(["plancha", "plancha"]);
    expect(d1.newExercises).toBeUndefined();
    expect(d2.newExercises).toBeUndefined();
  });
});

describe("omittedText", () => {
  it("singular y plural", () => {
    expect(omittedText(1)).toBe("Quedó afuera 1 rutina más (máximo 7 por vez): importala por separado.");
    expect(omittedText(3)).toBe("Quedaron afuera 3 rutinas más (máximo 7 por vez): importalas por separado.");
  });
});
