import { describe, it, expect } from "vitest";
import { createRoutineSchema } from "./routine";

describe("createRoutineSchema", () => {
  it("acepta un ejercicio por tiempo (sin reps) y conserva duración y peso", () => {
    const r = createRoutineSchema.safeParse({
      name: "Core",
      exercises: [
        { exerciseId: "plank", sets: 3, reps: null, durationSeconds: 45, weightKg: null },
        { exerciseId: "bench", sets: 4, reps: 8, durationSeconds: null, weightKg: 60 },
      ],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.exercises[0]).toMatchObject({ reps: null, durationSeconds: 45 });
      expect(r.data.exercises[1]).toMatchObject({ reps: 8, weightKg: 60 });
    }
  });

  it("trata strings vacíos como ausentes", () => {
    const r = createRoutineSchema.safeParse({
      name: "Core",
      exercises: [{ exerciseId: "plank", sets: "3", reps: "", durationSeconds: "30", weightKg: "" }],
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.exercises[0]).toMatchObject({ sets: 3, reps: null, durationSeconds: 30, weightKg: null });
    const absent = createRoutineSchema.safeParse({ name: "Core", exercises: [{ exerciseId: "plank", sets: 3, durationSeconds: 30 }] });
    expect(absent.success).toBe(true);
    if (absent.success) expect(absent.data.exercises[0]).toMatchObject({ reps: null, weightKg: null });
  });

  it("exige reps o tiempo, con mensaje en español", () => {
    const r = createRoutineSchema.safeParse({
      name: "Core",
      exercises: [{ exerciseId: "plank", sets: 3, reps: null, durationSeconds: null }],
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toBe("Cada ejercicio necesita repeticiones o tiempo");
  });

  it("exige nombre y al menos un ejercicio", () => {
    const r = createRoutineSchema.safeParse({ name: "  ", exercises: [] });
    expect(r.success).toBe(false);
    if (!r.success) {
      const messages = r.error.issues.map((i) => i.message);
      expect(messages).toContain("Poné un nombre a la rutina");
      expect(messages).toContain("Agregá al menos un ejercicio");
    }
  });
});
