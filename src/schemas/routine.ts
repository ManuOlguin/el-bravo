import { z } from "zod";
import { setKindSchema } from "./workout";
import type { ExerciseSummary } from "@/src/features/exercises/types";

/** Número opcional: `""`, `null` o ausente → `null`. */
const emptyToNull = (v: unknown) => (v === "" || v === undefined ? null : v);
const optInt = (min: number, max: number, msg?: string) =>
  z.preprocess(emptyToNull, z.coerce.number().int().min(min, msg).max(max).nullable());
const optNum = (min: number, max: number, msg?: string) =>
  z.preprocess(emptyToNull, z.coerce.number().min(min, msg).max(max).nullable());

/** Serie objetivo de una rutina: todo opcional ("3 series" sin reps fijas también vale). */
export const routineSetInputSchema = z.object({
  kind: setKindSchema.default("normal"),
  targetReps: optInt(1, 1000, "Mínimo 1 repetición").default(null),
  targetDurationSeconds: optInt(1, 36000, "Mínimo 1 segundo").default(null),
  targetWeightKg: optNum(0, 1000, "El peso no puede ser negativo").default(null),
  restSeconds: optInt(0, 3600).default(null),
});

export const routineExerciseInputSchema = z.object({
  exerciseId: z.string().min(1, "Elegí un ejercicio"),
  restSeconds: optInt(0, 3600).default(null),
  notes: z.string().trim().max(500).optional().nullable(),
  sets: z.array(routineSetInputSchema).min(1, "Agregá al menos una serie").max(30, "Máximo 30 series por ejercicio"),
});

export const routineInputSchema = z.object({
  name: z.string().trim().min(1, "Poné un nombre a la rutina").max(100, "Nombre demasiado largo"),
  notes: z.string().trim().max(2000).optional().nullable(),
  exercises: z.array(routineExerciseInputSchema).min(1, "Agregá al menos un ejercicio").max(40, "Máximo 40 ejercicios"),
});

export type RoutineSetInput = z.infer<typeof routineSetInputSchema>;
export type RoutineExerciseInput = z.infer<typeof routineExerciseInputSchema>;
export type RoutineInput = z.infer<typeof routineInputSchema>;

/** Rutina lista para cargar en el editor (`WorkoutEditor` en modo plan o live). */
export type RoutineForEditor = {
  id: string;
  name: string;
  notes: string | null;
  exercises: {
    exercise: ExerciseSummary;
    restSeconds: number | null;
    notes: string | null;
    sets: {
      kind: z.infer<typeof setKindSchema>;
      targetReps: number | null;
      targetDurationSeconds: number | null;
      targetWeightKg: number | null;
      restSeconds: number | null;
    }[];
  }[];
};

// --- Formato viejo (plano). Lo usan solo app/api/routine/* hasta que se borren (W2-1 Task 2). ---

const legacyRoutineExerciseSchema = z
  .object({
    exerciseId: z.string().min(1, "Elegí un ejercicio"),
    sets: z.coerce.number().int().min(1, "Mínimo 1 serie").max(50),
    reps: z.preprocess(emptyToNull, z.coerce.number().int().min(1, "Mínimo 1 repetición").max(500).nullable()),
    durationSeconds: z.preprocess(emptyToNull, z.coerce.number().int().min(1, "Mínimo 1 segundo").max(36000).nullable()),
    weightKg: z.preprocess(emptyToNull, z.coerce.number().min(0, "El peso no puede ser negativo").max(1000).nullable()),
  })
  .refine((e) => e.reps !== null || e.durationSeconds !== null, {
    message: "Cada ejercicio necesita repeticiones o tiempo",
    path: ["reps"],
  });

export const createRoutineSchema = z.object({
  name: z.string().trim().min(1, "Poné un nombre a la rutina").max(100, "Nombre demasiado largo"),
  exercises: z.array(legacyRoutineExerciseSchema).min(1, "Agregá al menos un ejercicio"),
});

export type CreateRoutineInput = z.infer<typeof createRoutineSchema>;
