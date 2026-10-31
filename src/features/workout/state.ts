/**
 * Estado del editor de entrenamientos (W2-1 Task 1): un reducer puro compartido por los tres modos.
 * - `plan`: rutina (los valores son objetivos).
 * - `log`: registrar a posteriori (todas las series cuentan como hechas).
 * - `live`: en tiempo real (se tachan series; solo las completadas se guardan).
 * Sin dependencias de React ni del servidor: se testea con Vitest.
 */
import { localDateOf, localTimeOf } from "@/src/lib/time";
import type { ExerciseSummary } from "@/src/features/exercises/types";
import { activityInputSchema, type ActivityInput } from "@/src/schemas/workout";
import { routineInputSchema, type RoutineForEditor, type RoutineInput } from "@/src/schemas/routine";
import type { z } from "zod";

export type SetKind = "warmup" | "normal" | "drop" | "failure";

export type SetDraft = {
  key: string;
  kind: SetKind;
  reps: number | null;
  durationSeconds: number | null;
  weightKg: number | null;
  restSeconds: number | null;
  completed: boolean;
  completedAt: number | null;
};

export type ExerciseDraft = { key: string; exercise: ExerciseSummary; notes: string; restSeconds: number | null; sets: SetDraft[] };

export type WorkoutMode = "plan" | "log" | "live";

export type WorkoutDraft = {
  clientRequestId: string;
  mode: WorkoutMode;
  routineId: string | null;
  routineName: string;
  activityCategoryId: string | null;
  localDate: string;
  localTime: string;
  durationMinutes: number | null;
  notes: string;
  startedAtMs: number | null;
  exercises: ExerciseDraft[];
};

type FieldValues = {
  activityCategoryId: string | null;
  localDate: string;
  localTime: string;
  durationMinutes: number | null;
  notes: string;
  routineName: string;
};

export type WorkoutAction =
  | { type: "addExercises"; exercises: ExerciseSummary[]; defaultRest?: number }
  | { type: "removeExercise"; key: string }
  | { type: "moveExercise"; key: string; dir: -1 | 1 }
  | { type: "replaceExercise"; key: string; exercise: ExerciseSummary }
  | { type: "updateExercise"; key: string; patch: Partial<Pick<ExerciseDraft, "notes" | "restSeconds">> }
  | { type: "addSet"; exerciseKey: string }
  | { type: "removeSet"; exerciseKey: string; setKey: string }
  | { type: "updateSet"; exerciseKey: string; setKey: string; patch: Partial<Omit<SetDraft, "key">> }
  | { type: "toggleSetDone"; exerciseKey: string; setKey: string; nowMs: number }
  | { [F in keyof FieldValues]: { type: "setField"; field: F; value: FieldValues[F] } }[keyof FieldValues]
  | { type: "loadRoutine"; routine: RoutineForEditor; replace?: boolean }
  | { type: "finishLive"; nowMs: number; tz: string }
  | { type: "replace"; draft: WorkoutDraft };

export const DEFAULT_REST_SECONDS = 90;
export const DEFAULT_DURATION_SET_SECONDS = 60;

// --- ids (inyectables para tests) ---

let genId: () => string = () => globalThis.crypto.randomUUID();

/** Reemplaza el generador de claves/ids (solo tests). */
export function setIdGenerator(fn: () => string) {
  genId = fn;
}

// --- helpers ---

const emptySet = (exercise: ExerciseSummary, completed: boolean): SetDraft => ({
  key: genId(),
  kind: "normal",
  reps: null,
  durationSeconds: exercise.measureType === "duration" ? DEFAULT_DURATION_SET_SECONDS : null,
  weightKg: null,
  restSeconds: null,
  completed,
  completedAt: null,
});

const isBlank = (s: Pick<SetDraft, "reps" | "durationSeconds" | "weightKg">) =>
  s.reps === null && s.durationSeconds === null && s.weightKg === null;

/** En `log` todas las series cuentan como hechas; en `live` hay que tildarlas. */
const setsStartCompleted = (mode: WorkoutMode) => mode === "log";

function mapExercise(s: WorkoutDraft, key: string, fn: (e: ExerciseDraft) => ExerciseDraft): WorkoutDraft {
  let changed = false;
  const exercises = s.exercises.map((e) => {
    if (e.key !== key) return e;
    changed = true;
    return fn(e);
  });
  return changed ? { ...s, exercises } : s;
}

function mapSet(s: WorkoutDraft, exerciseKey: string, setKey: string, fn: (set: SetDraft, i: number, all: SetDraft[]) => SetDraft) {
  return mapExercise(s, exerciseKey, (e) => ({ ...e, sets: e.sets.map((set, i, all) => (set.key === setKey ? fn(set, i, all) : set)) }));
}

function exerciseFromRoutine(r: RoutineForEditor["exercises"][number], mode: WorkoutMode): ExerciseDraft {
  return {
    key: genId(),
    exercise: r.exercise,
    notes: r.notes ?? "",
    restSeconds: r.restSeconds,
    sets: r.sets.map((t) => ({
      key: genId(),
      kind: t.kind,
      reps: t.targetReps,
      durationSeconds: t.targetDurationSeconds,
      weightKg: r.exercise.tracksWeight ? t.targetWeightKg : null,
      restSeconds: t.restSeconds,
      completed: setsStartCompleted(mode),
      completedAt: null,
    })),
  };
}

// --- reducer ---

export function workoutReducer(s: WorkoutDraft, a: WorkoutAction): WorkoutDraft {
  switch (a.type) {
    case "addExercises": {
      const added = a.exercises.map<ExerciseDraft>((exercise) => ({
        key: genId(),
        exercise,
        notes: "",
        restSeconds: a.defaultRest ?? DEFAULT_REST_SECONDS,
        sets: Array.from({ length: exercise.measureType === "duration" ? 1 : 3 }, () => emptySet(exercise, setsStartCompleted(s.mode))),
      }));
      return added.length ? { ...s, exercises: [...s.exercises, ...added] } : s;
    }
    case "removeExercise":
      return { ...s, exercises: s.exercises.filter((e) => e.key !== a.key) };
    case "moveExercise": {
      const i = s.exercises.findIndex((e) => e.key === a.key);
      const j = i + a.dir;
      if (i < 0 || j < 0 || j >= s.exercises.length) return s;
      const exercises = [...s.exercises];
      [exercises[i], exercises[j]] = [exercises[j], exercises[i]];
      return { ...s, exercises };
    }
    case "replaceExercise":
      return mapExercise(s, a.key, (e) => {
        const toDuration = a.exercise.measureType === "duration" && e.exercise.measureType !== "duration";
        return {
          ...e,
          exercise: a.exercise,
          sets: e.sets.map((set) => ({
            ...set,
            weightKg: a.exercise.tracksWeight ? set.weightKg : null,
            durationSeconds: toDuration && set.durationSeconds === null ? DEFAULT_DURATION_SET_SECONDS : set.durationSeconds,
          })),
        };
      });
    case "updateExercise":
      return mapExercise(s, a.key, (e) => ({ ...e, ...a.patch }));
    case "addSet":
      return mapExercise(s, a.exerciseKey, (e) => {
        const last = e.sets.at(-1);
        const next: SetDraft = last
          ? { ...last, key: genId(), completed: setsStartCompleted(s.mode), completedAt: null }
          : emptySet(e.exercise, setsStartCompleted(s.mode));
        return { ...e, sets: [...e.sets, next] };
      });
    case "removeSet":
      return mapExercise(s, a.exerciseKey, (e) => ({ ...e, sets: e.sets.filter((set) => set.key !== a.setKey) }));
    case "updateSet":
      return mapSet(s, a.exerciseKey, a.setKey, (set) => ({ ...set, ...a.patch }));
    case "toggleSetDone":
      return mapSet(s, a.exerciseKey, a.setKey, (set, i, all) => {
        if (set.completed) return { ...set, completed: false, completedAt: null };
        // Serie vacía: toma los valores de la anterior (los "objetivos" que el usuario ve arriba).
        const prev = i > 0 ? all[i - 1] : null;
        const values =
          isBlank(set) && prev ? { reps: prev.reps, durationSeconds: prev.durationSeconds, weightKg: prev.weightKg } : {};
        return { ...set, ...values, completed: true, completedAt: a.nowMs };
      });
    case "setField":
      return { ...s, [a.field]: a.value };
    case "loadRoutine": {
      if (s.exercises.length > 0 && !a.replace) return s;
      return {
        ...s,
        routineId: a.routine.id,
        routineName: a.routine.name,
        exercises: a.routine.exercises.map((r) => exerciseFromRoutine(r, s.mode)),
      };
    }
    case "finishLive": {
      const start = s.startedAtMs ?? a.nowMs;
      const startDate = new Date(start);
      const exercises = s.exercises
        .map((e) => ({ ...e, sets: e.sets.filter((set) => set.completed) }))
        .filter((e) => e.sets.length > 0);
      return {
        ...s,
        durationMinutes: Math.max(1, Math.round((a.nowMs - start) / 60_000)),
        localDate: localDateOf(startDate, a.tz),
        localTime: localTimeOf(startDate, a.tz),
        exercises,
      };
    }
    case "replace":
      return a.draft;
  }
}

// --- constructores ---

export function newDraft(mode: WorkoutMode, now: { localDate: string; localTime: string; nowMs?: number }): WorkoutDraft {
  return {
    clientRequestId: genId(),
    mode,
    routineId: null,
    routineName: "",
    activityCategoryId: null,
    localDate: now.localDate,
    localTime: now.localTime,
    durationMinutes: null,
    notes: "",
    startedAtMs: mode === "live" ? (now.nowMs ?? null) : null,
    exercises: [],
  };
}

/** Rutina → borrador (para editarla en modo `plan` o entrenarla en `live`). */
export function draftFromRoutine(
  routine: RoutineForEditor,
  mode: WorkoutMode,
  now: { localDate: string; localTime: string; nowMs?: number }
): WorkoutDraft {
  return { ...workoutReducer(newDraft(mode, now), { type: "loadRoutine", routine }), notes: mode === "plan" ? (routine.notes ?? "") : "" };
}

/** Entrenamiento guardado (`getActivityForEdit`) → borrador en modo `log`. */
export function draftFromActivity(input: ActivityInput & { id: string }, exercises: Map<string, ExerciseSummary>): WorkoutDraft {
  return {
    clientRequestId: input.clientRequestId,
    mode: "log",
    routineId: input.routineId ?? null,
    routineName: "",
    activityCategoryId: input.activityCategoryId,
    localDate: input.localDate,
    localTime: input.localTime,
    durationMinutes: input.durationMinutes,
    notes: input.notes ?? "",
    startedAtMs: null,
    exercises: input.exercises.flatMap((e) => {
      const exercise = exercises.get(e.exerciseId);
      if (!exercise) return [];
      const rests = e.sets.map((s) => s.restSeconds);
      const shared = rests.every((r) => r === rests[0]) ? (rests[0] ?? null) : null;
      return [
        {
          key: genId(),
          exercise,
          notes: e.notes ?? "",
          restSeconds: shared,
          sets: e.sets.map((s) => ({
            key: genId(),
            kind: s.kind,
            reps: s.reps,
            durationSeconds: s.durationSeconds,
            weightKg: s.weightKg,
            restSeconds: shared === null ? s.restSeconds : null,
            completed: true,
            completedAt: null,
          })),
        },
      ];
    }),
  };
}

// --- conversiones a inputs del servidor ---

/** Error de validación del borrador, con mensajes en español por campo (`fieldErrors["exercises.0.sets.1.reps"]`). */
export class WorkoutDraftError extends Error {
  constructor(public fieldErrors: Record<string, string[]>) {
    super(Object.values(fieldErrors)[0]?.[0] ?? "Revisá los datos del entrenamiento");
    this.name = "WorkoutDraftError";
  }
}

function zodToFieldErrors(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) (out[issue.path.map(String).join(".") || "_"] ??= []).push(issue.message);
  return out;
}

const restOf = (e: ExerciseDraft, s: SetDraft) => s.restSeconds ?? e.restSeconds;

export function toActivityInput(d: WorkoutDraft): ActivityInput {
  const missing: Record<string, string[]> = {};
  if (!d.activityCategoryId) missing.activityCategoryId = ["Elegí qué hiciste"];
  if (d.durationMinutes === null || !Number.isFinite(d.durationMinutes) || d.durationMinutes < 1) {
    missing.durationMinutes = ["Indicá cuánto duró"];
  }
  if (Object.keys(missing).length) throw new WorkoutDraftError(missing);

  const exercises = d.exercises
    .map((e) => ({
      exerciseId: e.exercise.id,
      notes: e.notes.trim() || null,
      sets: e.sets
        .filter((s) => (d.mode === "live" ? s.completed : true) && !isBlank(s))
        .map((s) => ({
          kind: s.kind,
          reps: s.reps,
          durationSeconds: s.durationSeconds,
          weightKg: e.exercise.tracksWeight && s.weightKg !== null && Number.isFinite(s.weightKg) ? s.weightKg : null,
          restSeconds: restOf(e, s),
          completed: true,
        })),
    }))
    .filter((e) => e.sets.length > 0);

  const parsed = activityInputSchema.safeParse({
    clientRequestId: d.clientRequestId,
    activityCategoryId: d.activityCategoryId,
    localDate: d.localDate,
    localTime: d.localTime,
    durationMinutes: d.durationMinutes,
    notes: d.notes.trim() || null,
    routineId: d.routineId,
    exercises,
  });
  if (!parsed.success) throw new WorkoutDraftError(zodToFieldErrors(parsed.error));
  return parsed.data;
}

export function toRoutineInput(d: WorkoutDraft): RoutineInput {
  const parsed = routineInputSchema.safeParse({
    name: d.routineName,
    notes: d.notes.trim() || null,
    exercises: d.exercises.map((e) => ({
      exerciseId: e.exercise.id,
      restSeconds: e.restSeconds,
      notes: e.notes.trim() || null,
      sets: e.sets.map((s) => ({
        kind: s.kind,
        targetReps: s.reps,
        targetDurationSeconds: s.durationSeconds,
        targetWeightKg: e.exercise.tracksWeight ? s.weightKg : null,
        restSeconds: s.restSeconds,
      })),
    })),
  });
  if (!parsed.success) throw new WorkoutDraftError(zodToFieldErrors(parsed.error));
  return parsed.data;
}

export function draftSummary(d: WorkoutDraft): { exercises: number; setsDone: number; setsTotal: number; volumeKg: number } {
  let setsDone = 0;
  let setsTotal = 0;
  let volumeKg = 0;
  for (const e of d.exercises) {
    for (const s of e.sets) {
      setsTotal++;
      if (!s.completed) continue;
      setsDone++;
      if (s.reps !== null && s.weightKg !== null) volumeKg += s.reps * s.weightKg;
    }
  }
  return { exercises: d.exercises.length, setsDone, setsTotal, volumeKg: Math.round(volumeKg * 10) / 10 };
}
