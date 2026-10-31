import { describe, expect, it } from "vitest";
import { COOLDOWN_MS, endMsFor, isResumable, lastSetAt, liveStatus, needsEndConfirmation } from "./live-session";
import { newDraft, type SetDraft, type WorkoutDraft } from "./state";

const MIN = 60_000;
const START = Date.UTC(2026, 9, 31, 21, 0); // 18:00 en Buenos Aires

const set = (completedAt: number | null): SetDraft => ({
  key: `s${completedAt}`,
  kind: "normal",
  reps: 10,
  durationSeconds: null,
  weightKg: 50,
  restSeconds: null,
  completed: completedAt !== null,
  completedAt,
});

function live(setsAt: (number | null)[]): WorkoutDraft {
  const d = newDraft("live", { localDate: "2026-10-31", localTime: "18:00", nowMs: START });
  return {
    ...d,
    exercises: [{ key: "e", exercise: { id: "x", name: "Banca" } as WorkoutDraft["exercises"][number]["exercise"], notes: "", restSeconds: null, sets: setsAt.map(set) }],
  };
}

describe("liveStatus", () => {
  it("entrenamiento normal: ni olvidado ni largo", () => {
    const d = live([START + 10 * MIN, START + 40 * MIN, null]);
    const s = liveStatus(d, START + 50 * MIN);
    expect(lastSetAt(d)).toBe(START + 40 * MIN);
    expect(s).toMatchObject({ elapsedMs: 50 * MIN, idleMs: 10 * MIN, stale: false, long: false });
    expect(needsEndConfirmation(s)).toBe(false);
  });

  it("olvidado: más de 1 h sin tildar; sugiere la última serie + 5 min", () => {
    const d = live([START + 10 * MIN, START + 55 * MIN]);
    const s = liveStatus(d, START + 5 * 60 * MIN);
    expect(s.stale).toBe(true);
    expect(s.suggestedEndMs).toBe(START + 55 * MIN + COOLDOWN_MS);
    expect(needsEndConfirmation(s)).toBe(true);
  });

  it("largo pero activo (3 h 10 min tildando): pide confirmar igual", () => {
    const d = live([START + 180 * MIN, START + 188 * MIN]);
    const s = liveStatus(d, START + 190 * MIN);
    expect([s.stale, s.long]).toEqual([false, true]);
    expect(needsEndConfirmation(s)).toBe(true);
  });

  it("sin series tildadas: la inactividad se cuenta desde el inicio y la sugerencia es ahora", () => {
    const s = liveStatus(live([null, null]), START + 70 * MIN);
    expect(s).toMatchObject({ lastSetAtMs: null, idleMs: 70 * MIN, stale: true, suggestedEndMs: START + 70 * MIN });
  });

  it("la sugerencia nunca queda en el futuro", () => {
    const now = START + 42 * MIN;
    expect(liveStatus(live([START + 40 * MIN]), now).suggestedEndMs).toBe(now);
  });
});

describe("endMsFor", () => {
  const d = live([START + 30 * MIN]);
  const now = START + 4 * 60 * MIN;
  const s = liveStatus(d, now);

  it("sugerida, ahora o a mano (desde el inicio, mínimo 1 min, nunca después de ahora)", () => {
    expect(endMsFor({ kind: "suggested" }, s, now)).toBe(START + 35 * MIN);
    expect(endMsFor({ kind: "now" }, s, now)).toBe(now);
    expect(endMsFor({ kind: "custom", minutes: 75 }, s, now)).toBe(START + 75 * MIN);
    expect(endMsFor({ kind: "custom", minutes: 0 }, s, now)).toBe(START + MIN);
    expect(endMsFor({ kind: "custom", minutes: 999 }, s, now)).toBe(now);
  });
});

describe("isResumable", () => {
  it("con series tildadas siempre; sin tildar solo si lo empezó hace menos de 1 h", () => {
    expect(isResumable(live([START + MIN]), START + 10 * 60 * MIN, 1)).toBe(true);
    expect(isResumable(live([null]), START + 20 * MIN, 0)).toBe(true);
    expect(isResumable(live([null]), START + 90 * MIN, 0)).toBe(false);
    expect(isResumable({ ...live([]), mode: "log" }, START, 0)).toBe(false);
  });
});
