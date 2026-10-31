import { describe, it, expect } from "vitest";
import { formatKg, formatSeconds, formatVolume, nextKind, restLabel, setLabels, setText } from "./format";

describe("format", () => {
  it("numera solo las series normales y usa W/D/F para las especiales", () => {
    expect(setLabels([{ kind: "warmup" }, { kind: "normal" }, { kind: "normal" }, { kind: "drop" }, { kind: "failure" }])).toEqual(["W", "1", "2", "D", "F"]);
  });

  it("rota el tipo de serie", () => {
    expect(nextKind("normal")).toBe("warmup");
    expect(nextKind("failure")).toBe("normal");
  });

  it("formatea series anteriores de forma compacta", () => {
    expect(setText({ reps: 10, weightKg: 40, durationSeconds: null })).toBe("40×10");
    expect(setText({ reps: 8, weightKg: 42.5, durationSeconds: null })).toBe("42,5×8");
    expect(setText({ reps: 12, weightKg: null, durationSeconds: null })).toBe("×12");
    expect(setText({ reps: null, weightKg: null, durationSeconds: 45 })).toBe("45 s");
    expect(setText({ reps: null, weightKg: 10, durationSeconds: 90 })).toBe("10 kg · 1:30 min");
  });

  it("formatea segundos, volumen y descanso", () => {
    expect(formatSeconds(120)).toBe("2 min");
    expect(formatKg(40)).toBe("40");
    expect(formatVolume(12345.6)).toBe("12.346 kg");
    expect(restLabel(90)).toBe("Descanso: 1:30 min");
    expect(restLabel(0)).toBe("Sin descanso");
  });
});
