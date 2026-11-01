import { describe, expect, it } from "vitest";
import type { CatalogEntry } from "@/src/features/exercises/types";
import { aiImportToDraft, type AiRoutineImport } from "./ai-draft";

const cat = (name: string, o: Partial<CatalogEntry> = {}): CatalogEntry => ({
  id: name.toLowerCase().replace(/\s+/g, "-"), name, nameEn: null, measureType: "reps", equipment: "barbell", tracksWeight: true,
  primaryGroupKey: "chest", mediaUrl: null, aliases: [], groupKeys: ["chest"], isMine: false, ...o,
});
// "Press declinado" está a distancia 2 de "Press inclinado": el matcher aproximado lo daría por encontrado (falso positivo).
const CATALOG = [
  cat("Press de Banca", { nameEn: "Bench Press", aliases: ["banca"] }),
  cat("Sentadillas", { nameEn: "Squat" }),
  cat("Press inclinado"),
];
const S = { kind: "normal" as const, reps: 10, durationSeconds: null, weightKg: null };
const HAMMER = { nameEn: "Hammer Row", equipment: "machine" as const, measureType: "reps" as const, tracksWeight: true, muscles: [{ muscleSlug: "espalda", percentage: 70 }, { muscleSlug: "biceps", percentage: 30 }], source: "ai" as const };

const result = (exercises: { name: string; source: string }[], hints: AiRoutineImport["hints"]): AiRoutineImport => ({
  parsed: { name: "Espalda", notes: null, unparsedLines: [], exercises: exercises.map((e) => ({ name: e.name, restSeconds: null, sets: [S] })) },
  hints,
  sourceNames: exercises.map((e) => e.source),
});

describe("aiImportToDraft", () => {
  it("los del catálogo se encuentran y conservan lo que decía el texto; los nuevos traen lo que propuso la IA", () => {
    const d = aiImportToDraft(result([{ name: "Press de Banca", source: "Banco plano" }, { name: "Remo en máquina Hammer", source: "remo hammer" }], { "remo en maquina hammer": HAMMER }), CATALOG);
    expect(d.name).toBe("Espalda");
    expect(d.items[0]).toMatchObject({ sourceName: "Banco plano", match: { kind: "found", exercise: { id: "press-de-banca" } } });
    expect(d.items[1]).toMatchObject({ sourceName: "remo hammer", match: { kind: "new", draft: { name: "Remo en máquina Hammer", ...HAMMER } } });
  });

  it("sin la IA, el matcher aproximado engancharía 'Press declinado' a 'Press inclinado' (premisa del test siguiente)", () => {
    const d = aiImportToDraft(result([{ name: "Press declinado", source: "declinado" }], {}), CATALOG);
    expect(d.items[0].match).toMatchObject({ kind: "found", exercise: { name: "Press inclinado" } });
  });

  it("si la IA dijo que es nuevo, no se pisa con un parecido aproximado del catálogo", () => {
    const hint = { ...HAMMER, nameEn: "Decline Press", muscles: [{ muscleSlug: "pecho", percentage: 100 }] };
    const d = aiImportToDraft(result([{ name: "Press declinado", source: "declinado" }], { "press declinado": hint }), CATALOG);
    expect(d.items[0]).toMatchObject({ sourceName: "declinado", match: { kind: "new", draft: { name: "Press declinado", source: "ai", nameEn: "Decline Press" } } });
  });

  it("pero una coincidencia exacta (nombre, inglés o alias) sí se respeta", () => {
    const d = aiImportToDraft(result([{ name: "Squat", source: "squat" }, { name: "banca", source: "banca" }], { squat: { ...HAMMER, nameEn: null }, banca: { ...HAMMER, nameEn: null } }), CATALOG);
    expect(d.items[0].match).toMatchObject({ kind: "found", exercise: { name: "Sentadillas" } });
    expect(d.items[1].match).toMatchObject({ kind: "found", exercise: { name: "Press de Banca" } });
  });

  it("el mismo ejercicio nuevo dos veces comparte tempId", () => {
    const hint = { ...HAMMER, nameEn: null };
    const d = aiImportToDraft(result([{ name: "Press declinado", source: "a" }, { name: "Press declinado", source: "b" }], { "press declinado": hint }), CATALOG);
    const ids = d.items.map((i) => (i.match.kind === "new" ? i.match.draft.tempId : ""));
    expect(ids[0]).not.toBe("");
    expect(ids[0]).toBe(ids[1]);
    const [a, b] = d.items.map((i) => i.match);
    expect(a.kind === "new" && b.kind === "new" && a.draft === b.draft).toBe(true);
  });

  it("los hints nunca pisan tempId ni name, tampoco en el ejercicio forzado a nuevo", () => {
    const hint = { ...HAMMER, tempId: "evil", name: "Otro nombre" };
    const d = aiImportToDraft(
      result([{ name: "Press declinado", source: "a" }, { name: "Remo raro", source: "b" }], { "press declinado": hint, "remo raro": hint }),
      CATALOG,
    );
    for (const [i, name] of ["Press declinado", "Remo raro"].entries()) {
      const m = d.items[i].match;
      expect(m.kind).toBe("new");
      if (m.kind === "new") {
        expect(m.draft.name).toBe(name);
        expect(m.draft.tempId).not.toBe("evil");
      }
    }
    const ids = d.items.map((i) => (i.match.kind === "new" ? i.match.draft.tempId : ""));
    expect(new Set(ids).size).toBe(2);
  });

  it("conserva unparsedLines y notas", () => {
    const r = result([{ name: "Press de Banca", source: "x" }], {});
    r.parsed.unparsedLines = ["???"];
    r.parsed.notes = "ojo";
    const d = aiImportToDraft(r, CATALOG);
    expect(d).toMatchObject({ unparsedLines: ["???"], notes: "ojo" });
  });
});
