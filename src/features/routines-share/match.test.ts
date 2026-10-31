import { describe, expect, it } from "vitest";
import type { CatalogEntry } from "@/src/features/exercises/types";
import { importDraftToRoutine, isPendingExerciseId, matchImport, referencedPending } from "./match";
import { parseRoutineText } from "./format";

const cat = (name: string, o: Partial<CatalogEntry> = {}): CatalogEntry => ({
  id: name.toLowerCase().replace(/\s+/g, "-"), name, nameEn: null, measureType: "reps", equipment: "barbell", tracksWeight: true,
  primaryGroupKey: "chest", mediaUrl: null, aliases: [], groupKeys: ["chest"], isMine: false, ...o,
});
const CATALOG = [cat("Press de Banca", { nameEn: "Bench Press", aliases: ["banca"] }), cat("Sentadillas", { nameEn: "Squat" }), cat("Plancha", { measureType: "duration", tracksWeight: false })];

const label = (d: ReturnType<typeof matchImport>) =>
  d.items.map((i) => (i.match.kind === "found" ? i.match.exercise.name : `nuevo:${i.match.draft.name}`));

describe("matchImport", () => {
  it("encuentra por nombre exacto, alias, inglés o un error de tipeo; el resto es nuevo", () => {
    const d = matchImport(parseRoutineText(`X\nbanca — 3×8\nSquat — 3×5 @ 100 kg\nPlanch — 3×45s\nRemo Hammer — 3×12`), CATALOG);
    expect(label(d)).toEqual(["Press de Banca", "Sentadillas", "Plancha", "nuevo:Remo Hammer"]);
  });

  it("no asocia por prefijo: un nombre más largo o más corto que uno del catálogo es un ejercicio nuevo", () => {
    const remo = [cat("Remo en Máquina")];
    expect(label(matchImport(parseRoutineText(`X\nRemo en máquina Hammer — 3×12`), remo))).toEqual(["nuevo:Remo en máquina Hammer"]);
    expect(label(matchImport(parseRoutineText(`X\nPress — 3×8`), CATALOG))).toEqual(["nuevo:Press"]);
  });

  it("tolera un error en nombres largos, pero no dos en nombres de 9 letras o menos", () => {
    expect(label(matchImport(parseRoutineText(`X\nSentadilla — 3×8`), CATALOG))).toEqual(["Sentadillas"]);
    expect(label(matchImport(parseRoutineText(`X\nSentadila — 3×8`), CATALOG))).toEqual(["nuevo:Sentadila"]);
  });

  it("los nombres cortos (< 5 letras) solo coinciden exacto", () => {
    const c = [cat("Remo")];
    expect(label(matchImport(parseRoutineText(`X\nRemo — 3×8`), c))).toEqual(["Remo"]);
    expect(label(matchImport(parseRoutineText(`X\nRema — 3×8`), c))).toEqual(["nuevo:Rema"]);
  });

  it("elige la menor distancia y, en empate, el primero del catálogo", () => {
    const c = [cat("Plancho"), cat("Plancha"), cat("Planchas")];
    expect(label(matchImport(parseRoutineText(`X\nPlancha — 3×8`), c))).toEqual(["Plancha"]);
    expect(label(matchImport(parseRoutineText(`X\nPlanchi — 3×8`), c))).toEqual(["Plancho"]);
  });

  it("un ejercicio nuevo infiere el tipo y si usa peso por sus series", () => {
    const d = matchImport(parseRoutineText(`X\nWall sit — 3×60s\nMuscle up — 3×5\nPress Arnold — 3×10 @ 14 kg`), CATALOG);
    const drafts = d.items.map((i) => (i.match.kind === "new" ? i.match.draft : null));
    expect(drafts.map((x) => [x?.measureType, x?.tracksWeight, x?.source, x?.muscles])).toEqual([
      ["duration", false, "user", []], ["reps", false, "user", []], ["reps", true, "user", []],
    ]);
  });

  it("el mismo ejercicio nuevo dos veces comparte tempId", () => {
    const d = matchImport(parseRoutineText(`X\nRemo Hammer — 3×12\nRemo hammer — 2×10`), CATALOG);
    const ids = d.items.map((i) => (i.match.kind === "new" ? i.match.draft.tempId : ""));
    expect(ids[0]).toBe(ids[1]);
  });

  it("los hints (fase 3) completan el ejercicio nuevo", () => {
    const d = matchImport(parseRoutineText(`X\nRemo Hammer — 3×12`), CATALOG, new Map([["remo hammer", { equipment: "machine", muscles: [{ muscleSlug: "dorsal", percentage: 100 }], source: "ai" }]]));
    expect(d.items[0].match).toMatchObject({ kind: "new", draft: { equipment: "machine", source: "ai", muscles: [{ muscleSlug: "dorsal", percentage: 100 }] } });
  });

  it("importDraftToRoutine arma un RoutineForEditor con ids new: para los nuevos", () => {
    const r = importDraftToRoutine(matchImport(parseRoutineText(`Mi rutina\nbanca — 2×8 @ 60\nRemo Hammer — 3×12`), CATALOG));
    expect(r.name).toBe("Mi rutina");
    expect(r.exercises[0].exercise.id).toBe("press-de-banca");
    expect(isPendingExerciseId(r.exercises[1].exercise.id)).toBe(true);
    expect(r.exercises[0].sets[0]).toEqual({ kind: "normal", targetReps: 8, targetWeightKg: 60, targetDurationSeconds: null, restSeconds: null });
  });
});

describe("referencedPending", () => {
  const mk = (tempId: string) => ({ tempId, name: tempId, nameEn: null, measureType: "reps" as const, equipment: "other" as const, tracksWeight: true, muscles: [], source: "user" as const });
  it("keeps only pending exercises still used by the draft", () => {
    const pending = [mk("a"), mk("b")];
    expect(referencedPending(pending, ["x", "new:b"]).map((p) => p.tempId)).toEqual(["b"]);
    expect(referencedPending(pending, ["x"])).toEqual([]);
    expect(referencedPending([], ["new:a"])).toEqual([]);
  });
});
