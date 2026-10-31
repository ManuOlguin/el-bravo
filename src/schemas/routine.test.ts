import { describe, it, expect } from "vitest";
import { routineInputSchema } from "./routine";

const set = (o: Record<string, unknown> = {}) => ({ kind: "normal", targetReps: null, targetDurationSeconds: null, targetWeightKg: null, restSeconds: null, ...o });

describe("routineInputSchema", () => {
  it("acepta un ejercicio por tiempo y pesos distintos por serie", () => {
    const r = routineInputSchema.safeParse({
      name: "Core",
      exercises: [
        { exerciseId: "plank", restSeconds: 30, sets: [set({ targetDurationSeconds: 45 })] },
        { exerciseId: "bench", sets: [set({ targetReps: 10, targetWeightKg: 40 }), set({ targetReps: 8, targetWeightKg: 45, kind: "failure" })] },
      ],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.exercises[0].sets[0]).toMatchObject({ targetReps: null, targetDurationSeconds: 45 });
      expect(r.data.exercises[1].sets.map((s) => s.targetWeightKg)).toEqual([40, 45]);
      expect(r.data.exercises[1].restSeconds).toBeNull();
    }
  });

  it("trata strings vacíos como ausentes y permite series sin objetivo", () => {
    const r = routineInputSchema.safeParse({ name: "Core", exercises: [{ exerciseId: "plank", sets: [{ targetReps: "", targetWeightKg: "" }] }] });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.exercises[0].sets[0]).toMatchObject({ kind: "normal", targetReps: null, targetWeightKg: null });
  });

  it("exige nombre, al menos un ejercicio y al menos una serie, en español", () => {
    const r = routineInputSchema.safeParse({ name: "  ", exercises: [] });
    expect(r.success).toBe(false);
    if (!r.success) {
      const messages = r.error.issues.map((i) => i.message);
      expect(messages).toContain("Poné un nombre a la rutina");
      expect(messages).toContain("Agregá al menos un ejercicio");
    }
    const noSets = routineInputSchema.safeParse({ name: "X", exercises: [{ exerciseId: "a", sets: [] }] });
    expect(noSets.success).toBe(false);
    if (!noSets.success) expect(noSets.error.issues[0]?.message).toBe("Agregá al menos una serie");
  });

  it("rechaza peso negativo", () => {
    const r = routineInputSchema.safeParse({ name: "X", exercises: [{ exerciseId: "a", sets: [set({ targetWeightKg: -1 })] }] });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toBe("El peso no puede ser negativo");
  });
});
