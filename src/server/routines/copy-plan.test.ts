import { describe, expect, it } from "vitest";
import { copyRoutineName, planExerciseCopies } from "./copy-plan";

const ex = (id: string, name: string, createdByUserId: string | null = null) => ({ id, name, createdByUserId });

describe("planExerciseCopies", () => {
  it("referencia los del catálogo y los propios del que copia", () => {
    const plan = planExerciseCopies([ex("bench", "Press banca"), ex("mine", "Mi remo", "me")], "me", [
      ex("bench", "Press banca"),
      ex("mine", "Mi remo", "me"),
    ]);
    expect(Object.fromEntries(plan)).toEqual({
      bench: { kind: "reference", exerciseId: "bench" },
      mine: { kind: "reference", exerciseId: "mine" },
    });
  });

  it("reusa uno visible del que copia con el mismo nombre normalizado", () => {
    const plan = planExerciseCopies([ex("h", "Remo Hammer", "author")], "me", [ex("my-h", "remo  hammer", "me")]);
    expect(plan.get("h")).toEqual({ kind: "reference", exerciseId: "my-h" });
  });

  it("ante un nombre repetido entre oficial y propio, reusa el oficial (misma regla que importar)", () => {
    const plan = planExerciseCopies([ex("h", "Remo Hammer", "author")], "me", [ex("mine", "remo hammer", "me"), ex("official", "Remo Hammer")]);
    expect(plan.get("h")).toEqual({ kind: "reference", exerciseId: "official" });
  });

  it("duplica los propios del autor que el que copia no tiene", () => {
    const plan = planExerciseCopies([ex("h", "Remo Hammer", "author")], "me", [ex("bench", "Press banca")]);
    expect(plan.get("h")).toEqual({ kind: "duplicate", sourceId: "h" });
  });

  it("dos del autor con el mismo nombre normalizado comparten duplicado; un ejercicio repetido se planea una vez", () => {
    const plan = planExerciseCopies([ex("a", "Remo-Hammer", "author"), ex("b", "remo hammer", "author"), ex("a", "Remo-Hammer", "author")], "me", []);
    expect(plan.size).toBe(2);
    expect(plan.get("a")).toEqual({ kind: "duplicate", sourceId: "a" });
    expect(plan.get("b")).toEqual({ kind: "duplicate", sourceId: "a" });
  });
});

describe("copyRoutineName", () => {
  it("la de otro conserva el nombre; la propia lleva (copia) sin pasarse de 100", () => {
    expect(copyRoutineName("Espalda", false)).toBe("Espalda");
    expect(copyRoutineName("Espalda", true)).toBe("Espalda (copia)");
    const long = copyRoutineName("x".repeat(100), true);
    expect(long).toHaveLength(100);
    expect(long.endsWith(" (copia)")).toBe(true);
  });
});
