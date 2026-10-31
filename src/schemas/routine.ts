import { z } from "zod";

/** Número opcional: `""`, `null` o ausente → `null`. */
function optionalNumber<T extends z.ZodType<number>>(inner: T) {
  return z.preprocess((v) => (v === "" || v === undefined ? null : v), inner.nullable());
}

const routineExerciseSchema = z
  .object({
    exerciseId: z.string().min(1, "Elegí un ejercicio"),
    sets: z.coerce.number().int().min(1, "Mínimo 1 serie").max(50),
    reps: optionalNumber(z.coerce.number().int().min(1, "Mínimo 1 repetición").max(500)),
    durationSeconds: optionalNumber(z.coerce.number().int().min(1, "Mínimo 1 segundo").max(36000)),
    weightKg: optionalNumber(z.coerce.number().min(0, "El peso no puede ser negativo").max(1000)),
  })
  .refine((e) => e.reps !== null || e.durationSeconds !== null, {
    message: "Cada ejercicio necesita repeticiones o tiempo",
    path: ["reps"],
  });

export const createRoutineSchema = z.object({
  name: z.string().trim().min(1, "Poné un nombre a la rutina").max(100, "Nombre demasiado largo"),
  exercises: z.array(routineExerciseSchema).min(1, "Agregá al menos un ejercicio"),
});

export type CreateRoutineInput = z.infer<typeof createRoutineSchema>;
