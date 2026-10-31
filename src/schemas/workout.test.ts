import { describe, it, expect } from "vitest";
import { activityInputSchema } from "./workout";

const base = {
  clientRequestId: "req-1", activityCategoryId: "cat1", localDate: "2026-10-30", localTime: "18:00",
  durationMinutes: 70, exercises: [],
};

describe("activityInputSchema", () => {
  it("acepta una actividad sin ejercicios (running, yoga)", () => {
    expect(activityInputSchema.safeParse(base).success).toBe(true);
  });
  it("acepta series por repeticiones con peso y por tiempo", () => {
    const r = activityInputSchema.safeParse({ ...base, exercises: [
      { exerciseId: "e1", sets: [{ kind: "normal", reps: 10, weightKg: 40, completed: true }, { kind: "normal", reps: 8, weightKg: 45, completed: true }] },
      { exerciseId: "e2", sets: [{ kind: "normal", durationSeconds: 60, completed: true }] },
    ] });
    expect(r.success).toBe(true);
  });
  it("rechaza una serie sin reps ni tiempo, con mensaje en español", () => {
    const r = activityInputSchema.safeParse({ ...base, exercises: [{ exerciseId: "e1", sets: [{ kind: "normal", completed: true }] }] });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toBe("Cada serie necesita repeticiones o tiempo");
  });
  it("rechaza duración fuera de rango y fecha mal formada", () => {
    expect(activityInputSchema.safeParse({ ...base, durationMinutes: 0 }).success).toBe(false);
    expect(activityInputSchema.safeParse({ ...base, durationMinutes: 1441 }).success).toBe(false);
    expect(activityInputSchema.safeParse({ ...base, localDate: "30/10/2026" }).success).toBe(false);
  });
  it("coacciona strings numéricos y trata '' como null", () => {
    const r = activityInputSchema.parse({ ...base, durationMinutes: "45", exercises: [{ exerciseId: "e1", sets: [{ kind: "normal", reps: "10", weightKg: "", completed: true }] }] });
    expect(r.durationMinutes).toBe(45);
    expect(r.exercises[0].sets[0]).toMatchObject({ reps: 10, weightKg: null });
  });
});
