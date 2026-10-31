import { describe, it, expect, beforeEach } from "vitest";
import type { ExerciseSummary } from "@/src/features/exercises/types";
import type { RoutineForEditor } from "@/src/schemas/routine";
import {
  WorkoutDraftError,
  draftFromActivity,
  draftFromRoutine,
  draftSummary,
  defaultStart,
  inputSummary,
  newDraft,
  setIdGenerator,
  toActivityInput,
  toRoutineInput,
  workoutReducer,
  type WorkoutAction,
  type WorkoutDraft,
} from "./state";

const bench: ExerciseSummary = {
  id: "ex-bench", name: "Press banca", nameEn: "Bench press", measureType: "reps", equipment: "barbell",
  tracksWeight: true, primaryGroupKey: "chest", mediaUrl: null,
};
const plank: ExerciseSummary = {
  id: "ex-plank", name: "Plancha", nameEn: "Plank", measureType: "duration", equipment: "bodyweight",
  tracksWeight: false, primaryGroupKey: "core", mediaUrl: null,
};
const pullup: ExerciseSummary = { ...bench, id: "ex-pullup", name: "Dominadas", tracksWeight: false, equipment: "bodyweight" };

const NOW = { localDate: "2026-10-31", localTime: "18:00" };
const TZ = "America/Argentina/Buenos_Aires";

let seq = 0;
beforeEach(() => {
  seq = 0;
  setIdGenerator(() => `k${++seq}`);
});

const run = (s: WorkoutDraft, ...actions: WorkoutAction[]) => actions.reduce(workoutReducer, s);
const withBench = (mode: WorkoutDraft["mode"]) => run(newDraft(mode, NOW), { type: "addExercises", exercises: [bench] });

describe("newDraft", () => {
  it("arranca vacío con un clientRequestId y la fecha/hora dadas", () => {
    const d = newDraft("log", NOW);
    expect(d).toMatchObject({ mode: "log", localDate: "2026-10-31", localTime: "18:00", exercises: [], activityCategoryId: null, durationMinutes: null });
    expect(d.clientRequestId).toBe("k1");
  });

  it("en modo live registra el inicio", () => {
    expect(newDraft("live", { ...NOW, nowMs: 1000 }).startedAtMs).toBe(1000);
    expect(newDraft("log", { ...NOW, nowMs: 1000 }).startedAtMs).toBeNull();
  });
});

describe("addExercises", () => {
  it("un ejercicio por reps crea 3 series vacías con descanso 90 s", () => {
    const d = withBench("log");
    const ex = d.exercises[0];
    expect(ex.exercise.id).toBe("ex-bench");
    expect(ex.restSeconds).toBe(90);
    expect(ex.sets).toHaveLength(3);
    expect(ex.sets.every((s) => s.reps === null && s.weightKg === null && s.durationSeconds === null && s.kind === "normal")).toBe(true);
  });

  it("un ejercicio por tiempo crea 1 serie de 60 s sin peso", () => {
    const d = run(newDraft("log", NOW), { type: "addExercises", exercises: [plank], defaultRest: 45 });
    const ex = d.exercises[0];
    expect(ex.restSeconds).toBe(45);
    expect(ex.sets).toHaveLength(1);
    expect(ex.sets[0]).toMatchObject({ durationSeconds: 60, reps: null, weightKg: null });
  });

  it("agrega varios en orden y con claves únicas", () => {
    const d = run(newDraft("plan", NOW), { type: "addExercises", exercises: [bench, plank] });
    expect(d.exercises.map((e) => e.exercise.id)).toEqual(["ex-bench", "ex-plank"]);
    const keys = [...d.exercises.map((e) => e.key), ...d.exercises.flatMap((e) => e.sets.map((s) => s.key))];
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("las series nuevas nacen completadas en log y sin completar en live", () => {
    expect(withBench("log").exercises[0].sets.every((s) => s.completed)).toBe(true);
    expect(withBench("live").exercises[0].sets.every((s) => !s.completed)).toBe(true);
  });
});

describe("addSet", () => {
  it("copia los valores de la última serie (como Strong)", () => {
    let d = withBench("log");
    const ex = d.exercises[0];
    d = run(d, { type: "updateSet", exerciseKey: ex.key, setKey: ex.sets[2].key, patch: { reps: 8, weightKg: 50, kind: "drop" } });
    d = run(d, { type: "addSet", exerciseKey: ex.key });
    const last = d.exercises[0].sets[3];
    expect(last).toMatchObject({ reps: 8, weightKg: 50, kind: "drop", completed: true, completedAt: null });
    expect(last.key).not.toBe(ex.sets[2].key);
  });

  it("en modo live la serie copiada no está completada", () => {
    let d = withBench("live");
    const ex = d.exercises[0];
    d = run(d, { type: "toggleSetDone", exerciseKey: ex.key, setKey: ex.sets[2].key, nowMs: 5 });
    d = run(d, { type: "addSet", exerciseKey: ex.key });
    expect(d.exercises[0].sets[3]).toMatchObject({ completed: false, completedAt: null });
  });

  it("si el ejercicio no tiene series, crea una vacía según el tipo de medida", () => {
    let d = run(newDraft("log", NOW), { type: "addExercises", exercises: [plank] });
    const ex = d.exercises[0];
    d = run(d, { type: "removeSet", exerciseKey: ex.key, setKey: ex.sets[0].key }, { type: "addSet", exerciseKey: ex.key });
    expect(d.exercises[0].sets).toHaveLength(1);
    expect(d.exercises[0].sets[0].durationSeconds).toBe(60);
  });
});

describe("removeExercise / moveExercise / replaceExercise / removeSet", () => {
  it("mueve, reemplaza y quita", () => {
    let d = run(newDraft("log", NOW), { type: "addExercises", exercises: [bench, plank] });
    const [a, b] = d.exercises;
    d = run(d, { type: "moveExercise", key: b.key, dir: -1 });
    expect(d.exercises.map((e) => e.key)).toEqual([b.key, a.key]);
    // mover fuera de rango no hace nada
    expect(run(d, { type: "moveExercise", key: b.key, dir: -1 }).exercises.map((e) => e.key)).toEqual([b.key, a.key]);
    d = run(d, { type: "replaceExercise", key: a.key, exercise: pullup });
    expect(d.exercises[1].exercise.id).toBe("ex-pullup");
    expect(d.exercises[1].sets).toHaveLength(3);
    d = run(d, { type: "removeExercise", key: b.key });
    expect(d.exercises.map((e) => e.exercise.id)).toEqual(["ex-pullup"]);
    d = run(d, { type: "removeSet", exerciseKey: a.key, setKey: d.exercises[0].sets[0].key });
    expect(d.exercises[0].sets).toHaveLength(2);
  });

  it("reemplazar por un ejercicio sin peso borra los kg", () => {
    let d = withBench("log");
    const ex = d.exercises[0];
    d = run(d, { type: "updateSet", exerciseKey: ex.key, setKey: ex.sets[0].key, patch: { reps: 10, weightKg: 40 } });
    d = run(d, { type: "replaceExercise", key: ex.key, exercise: pullup });
    expect(d.exercises[0].sets[0]).toMatchObject({ reps: 10, weightKg: null });
  });
});

describe("toggleSetDone", () => {
  it("marca completedAt y al destildar lo limpia", () => {
    let d = withBench("live");
    const ex = d.exercises[0];
    d = run(d, { type: "updateSet", exerciseKey: ex.key, setKey: ex.sets[0].key, patch: { reps: 10, weightKg: 40 } });
    d = run(d, { type: "toggleSetDone", exerciseKey: ex.key, setKey: ex.sets[0].key, nowMs: 1234 });
    expect(d.exercises[0].sets[0]).toMatchObject({ completed: true, completedAt: 1234, reps: 10 });
    d = run(d, { type: "toggleSetDone", exerciseKey: ex.key, setKey: ex.sets[0].key, nowMs: 2000 });
    expect(d.exercises[0].sets[0]).toMatchObject({ completed: false, completedAt: null });
  });

  it("si la serie está vacía copia los valores de la anterior", () => {
    let d = withBench("live");
    const ex = d.exercises[0];
    d = run(d, { type: "updateSet", exerciseKey: ex.key, setKey: ex.sets[0].key, patch: { reps: 12, weightKg: 42.5 } });
    d = run(d, { type: "toggleSetDone", exerciseKey: ex.key, setKey: ex.sets[1].key, nowMs: 10 });
    expect(d.exercises[0].sets[1]).toMatchObject({ reps: 12, weightKg: 42.5, completed: true });
  });
});

describe("loadRoutine", () => {
  const routine: RoutineForEditor = {
    id: "r1", name: "Pecho", notes: null,
    exercises: [
      { exercise: plank, restSeconds: 30, notes: null, sets: [{ kind: "normal", targetReps: null, targetDurationSeconds: 45, targetWeightKg: null, restSeconds: null }] },
      {
        exercise: bench, restSeconds: 120, notes: "codos a 45°",
        sets: [40, 45, 50].map((w) => ({ kind: "normal" as const, targetReps: 10, targetDurationSeconds: null, targetWeightKg: w, restSeconds: null })),
      },
    ],
  };

  it("carga los ejercicios y series con los objetivos si el borrador está vacío", () => {
    const d = run(newDraft("live", NOW), { type: "loadRoutine", routine });
    expect(d.routineId).toBe("r1");
    expect(d.routineName).toBe("Pecho");
    expect(d.exercises.map((e) => e.exercise.id)).toEqual(["ex-plank", "ex-bench"]);
    expect(d.exercises[1].sets.map((s) => s.weightKg)).toEqual([40, 45, 50]);
    expect(d.exercises[1]).toMatchObject({ restSeconds: 120, notes: "codos a 45°" });
    expect(d.exercises[0].sets[0].durationSeconds).toBe(45);
    expect(d.exercises[1].sets.every((s) => !s.completed)).toBe(true);
  });

  it("no pisa ejercicios existentes salvo que se pida reemplazar", () => {
    const base = withBench("log");
    expect(run(base, { type: "loadRoutine", routine })).toBe(base);
    const replaced = run(base, { type: "loadRoutine", routine, replace: true });
    expect(replaced.exercises.map((e) => e.exercise.id)).toEqual(["ex-plank", "ex-bench"]);
    expect(replaced.exercises[1].sets.every((s) => s.completed)).toBe(true); // modo log
  });

  it("draftFromRoutine arma un borrador de plan editable", () => {
    const d = draftFromRoutine(routine, "plan", NOW);
    expect(d).toMatchObject({ mode: "plan", routineId: "r1", routineName: "Pecho" });
    expect(toRoutineInput(d).exercises[1].sets.map((s) => s.targetWeightKg)).toEqual([40, 45, 50]);
  });
});

describe("finishLive", () => {
  it("calcula duración (mín. 1), fecha/hora de inicio local y descarta lo no completado", () => {
    const start = Date.parse("2026-10-31T21:30:00Z"); // 18:30 en Buenos Aires
    let d = run(newDraft("live", { ...NOW, nowMs: start }), { type: "addExercises", exercises: [bench, plank] });
    const [b] = d.exercises;
    d = run(d,
      { type: "updateSet", exerciseKey: b.key, setKey: b.sets[0].key, patch: { reps: 10, weightKg: 40 } },
      { type: "toggleSetDone", exerciseKey: b.key, setKey: b.sets[0].key, nowMs: start + 60_000 },
      { type: "finishLive", nowMs: start + 47.6 * 60_000, tz: TZ },
    );
    expect(d.durationMinutes).toBe(48);
    expect(d.localDate).toBe("2026-10-31");
    expect(d.localTime).toBe("18:30");
    expect(d.exercises).toHaveLength(1);
    expect(d.exercises[0].sets).toHaveLength(1);

    const quick = run(newDraft("live", { ...NOW, nowMs: start }), { type: "finishLive", nowMs: start + 5_000, tz: TZ });
    expect(quick.durationMinutes).toBe(1);
  });
});

describe("toActivityInput", () => {
  const filled = () => {
    let d = run(newDraft("log", NOW), { type: "addExercises", exercises: [bench] });
    const ex = d.exercises[0];
    d = run(d,
      { type: "setField", field: "activityCategoryId", value: "cat-1" },
      { type: "setField", field: "durationMinutes", value: 60 },
      { type: "updateSet", exerciseKey: ex.key, setKey: ex.sets[0].key, patch: { reps: 10, weightKg: 40 } },
      { type: "updateSet", exerciseKey: ex.key, setKey: ex.sets[1].key, patch: { reps: 8, weightKg: 45 } },
      { type: "updateSet", exerciseKey: ex.key, setKey: ex.sets[2].key, patch: { reps: 12, weightKg: null } },
    );
    return d;
  };

  it("convierte el borrador al input del servicio (descanso heredado del ejercicio, peso vacío = null)", () => {
    const input = toActivityInput(filled());
    expect(input).toMatchObject({ clientRequestId: "k1", activityCategoryId: "cat-1", localDate: "2026-10-31", localTime: "18:00", durationMinutes: 60 });
    expect(input.exercises[0].exerciseId).toBe("ex-bench");
    expect(input.exercises[0].sets.map((s) => [s.reps, s.weightKg, s.restSeconds])).toEqual([[10, 40, 90], [8, 45, 90], [12, null, 90]]);
  });

  it("exige categoría y duración con errores en español", () => {
    const d = newDraft("log", NOW);
    try {
      toActivityInput(d);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(WorkoutDraftError);
      const fe = (e as WorkoutDraftError).fieldErrors;
      expect(fe.activityCategoryId?.[0]).toBe("Elegí qué hiciste");
      expect(fe.durationMinutes?.[0]).toBe("Indicá cuánto duró");
    }
  });

  it("descarta las series vacías y los ejercicios que quedan sin series", () => {
    let d = run(filled(), { type: "addExercises", exercises: [pullup] });
    expect(toActivityInput(d).exercises).toHaveLength(1);
    const ex = d.exercises[0];
    d = run(d, { type: "addSet", exerciseKey: ex.key });
    d = run(d, { type: "updateSet", exerciseKey: ex.key, setKey: d.exercises[0].sets[3].key, patch: { reps: null, weightKg: null } });
    expect(d.exercises[0].sets).toHaveLength(4);
    expect(toActivityInput(d).exercises[0].sets).toHaveLength(3);
  });

  it("en live solo manda las series completadas", () => {
    let d = run(newDraft("live", { ...NOW, nowMs: 0 }), { type: "addExercises", exercises: [bench] });
    const ex = d.exercises[0];
    d = run(d,
      { type: "setField", field: "activityCategoryId", value: "cat-1" },
      { type: "setField", field: "durationMinutes", value: 30 },
      { type: "updateSet", exerciseKey: ex.key, setKey: ex.sets[0].key, patch: { reps: 10, weightKg: 40 } },
      { type: "updateSet", exerciseKey: ex.key, setKey: ex.sets[1].key, patch: { reps: 10, weightKg: 40 } },
      { type: "toggleSetDone", exerciseKey: ex.key, setKey: ex.sets[0].key, nowMs: 1 },
    );
    expect(toActivityInput(d).exercises[0].sets).toHaveLength(1);
  });

  it("valida con el schema (serie solo con peso → error en español)", () => {
    let d = filled();
    const ex = d.exercises[0];
    d = run(d, { type: "updateSet", exerciseKey: ex.key, setKey: ex.sets[0].key, patch: { reps: null } });
    expect(() => toActivityInput(d)).toThrow("Cada serie necesita repeticiones o tiempo");
  });
});

describe("toRoutineInput", () => {
  it("usa los valores como objetivos y exige nombre", () => {
    let d = run(newDraft("plan", NOW), { type: "addExercises", exercises: [plank, bench] });
    const b = d.exercises[1];
    d = run(d, { type: "updateSet", exerciseKey: b.key, setKey: b.sets[0].key, patch: { reps: 10, weightKg: 40 } });
    expect(() => toRoutineInput(d)).toThrow(WorkoutDraftError);
    d = run(d, { type: "setField", field: "routineName", value: "Pecho" });
    const r = toRoutineInput(d);
    expect(r.name).toBe("Pecho");
    expect(r.exercises[0]).toMatchObject({ exerciseId: "ex-plank", restSeconds: 90 });
    expect(r.exercises[0].sets[0].targetDurationSeconds).toBe(60);
    expect(r.exercises[1].sets[0]).toMatchObject({ targetReps: 10, targetWeightKg: 40 });
    expect(r.exercises[1].sets).toHaveLength(3);
  });
});

describe("draftSummary", () => {
  it("cuenta ejercicios, series y volumen (reps × kg de las completadas)", () => {
    let d = withBench("live");
    const ex = d.exercises[0];
    d = run(d,
      { type: "updateSet", exerciseKey: ex.key, setKey: ex.sets[0].key, patch: { reps: 10, weightKg: 40 } },
      { type: "updateSet", exerciseKey: ex.key, setKey: ex.sets[1].key, patch: { reps: 8, weightKg: 50 } },
      { type: "toggleSetDone", exerciseKey: ex.key, setKey: ex.sets[0].key, nowMs: 1 },
      { type: "toggleSetDone", exerciseKey: ex.key, setKey: ex.sets[1].key, nowMs: 2 },
    );
    expect(draftSummary(d)).toEqual({ exercises: 1, setsDone: 2, setsTotal: 3, volumeKg: 800 });
  });
});

describe("inputSummary / defaultStart", () => {
  it("resume lo enviado", () => {
    expect(
      inputSummary({
        clientRequestId: "x", activityCategoryId: "c", localDate: "2026-10-31", localTime: "18:00", durationMinutes: 50,
        exercises: [{ exerciseId: "e", notes: null, sets: [
          { kind: "normal", reps: 10, weightKg: 40, durationSeconds: null, restSeconds: null, completed: true },
          { kind: "normal", reps: null, weightKg: null, durationSeconds: 60, restSeconds: null, completed: true },
        ] }],
      })
    ).toEqual({ durationMinutes: 50, exercises: 1, sets: 2, volumeKg: 400 });
  });

  it("la hora por defecto es ahora menos la duración (puede caer el día anterior)", () => {
    const now = Date.parse("2026-10-31T03:20:00Z"); // 00:20 en Buenos Aires
    expect(defaultStart(now, null, TZ)).toEqual({ localDate: "2026-10-31", localTime: "00:20" });
    expect(defaultStart(now, 45, TZ)).toEqual({ localDate: "2026-10-30", localTime: "23:35" });
  });
});

describe("draftFromActivity", () => {
  it("rehidrata un entrenamiento guardado para editarlo", () => {
    const d = draftFromActivity(
      {
        id: "a1", clientRequestId: "edit-a1", activityCategoryId: "cat", localDate: "2026-10-30", localTime: "07:15", durationMinutes: 50,
        notes: "bien", routineId: null,
        exercises: [{ exerciseId: "ex-bench", notes: null, sets: [{ kind: "normal", reps: 10, durationSeconds: null, weightKg: 40, restSeconds: 60, completed: true }] }],
      },
      new Map([["ex-bench", bench]])
    );
    expect(d).toMatchObject({ mode: "log", activityCategoryId: "cat", localTime: "07:15", durationMinutes: 50, notes: "bien" });
    expect(d.exercises[0].restSeconds).toBe(60);
    expect(d.exercises[0].sets[0]).toMatchObject({ reps: 10, weightKg: 40, completed: true });
  });
});
