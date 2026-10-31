import { z } from "zod";
import { setKindSchema } from "./workout";
import { EQUIPMENT, type ExerciseSummary } from "@/src/features/exercises/types";

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

/** Ejercicio que todavía no existe: el servidor lo crea (privado del usuario) al guardar la rutina. Misma forma que `NewExerciseDraft`. */
export const newExerciseInputSchema = z.object({
  tempId: z.string().regex(/^[a-z0-9]{1,20}$/i),
  name: z.string().trim().min(2, "El nombre del ejercicio nuevo es muy corto").max(100),
  nameEn: z.string().trim().max(100).nullable().default(null),
  measureType: z.enum(["reps", "duration"]),
  equipment: z.enum(EQUIPMENT),
  tracksWeight: z.boolean(),
  muscles: z.array(z.object({ muscleSlug: z.string().min(1).max(60), percentage: z.number().int().min(1).max(100) })).max(8).default([]),
  source: z.enum(["user", "ai"]).default("user"),
});
export type NewExerciseInput = z.infer<typeof newExerciseInputSchema>;

/** Nombre a mostrar (y a guardar en "Basada en la rutina de…") cuando el autor no tiene nombre. */
export const FALLBACK_AUTHOR_NAME = "Usuario de El Bravo";

export const ROUTINE_VISIBILITIES = ["private", "public"] as const;
export const routineVisibilitySchema = z.enum(ROUTINE_VISIBILITIES);
export type RoutineVisibility = z.infer<typeof routineVisibilitySchema>;

export const routineInputSchema = z.object({
  name: z.string().trim().min(1, "Poné un nombre a la rutina").max(100, "Nombre demasiado largo"),
  notes: z.string().trim().max(2000).optional().nullable(),
  /** Opcional: si no viene, `updateRoutine` conserva la actual y `createRoutine` usa "private". */
  visibility: routineVisibilitySchema.optional(),
  exercises: z.array(routineExerciseInputSchema).min(1, "Agregá al menos un ejercicio").max(40, "Máximo 40 ejercicios"),
  /** Definiciones de los ejercicios con id `new:<tempId>` de `exercises`. */
  newExercises: z.array(newExerciseInputSchema).max(40).optional(),
});

export type RoutineSetInput = z.infer<typeof routineSetInputSchema>;
export type RoutineExerciseInput = z.infer<typeof routineExerciseInputSchema>;
export type RoutineInput = z.infer<typeof routineInputSchema>;

/** Rutina lista para cargar en el editor (`WorkoutEditor` en modo plan o live). */
export type RoutineForEditor = {
  id: string;
  name: string;
  notes: string | null;
  /** Solo los llena el server (`getRoutineForEditor`/`getPublicRoutine`); los borradores (importar) no los tienen. */
  visibility?: RoutineVisibility;
  copiedFromUserName?: string | null;
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

/** `/routines/[id]`: rutina en modo lectura (propia, o pública de otro). Nunca incluye el email del autor. */
export type RoutineView = RoutineForEditor & {
  visibility: RoutineVisibility;
  copiedFromUserName: string | null;
  owner: { id: string; name: string | null; photoUrl: string | null };
  isOwner: boolean;
};
