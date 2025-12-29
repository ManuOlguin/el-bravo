import { z } from "zod"

export const createRoutineSchema = z.object({
  name: z
    .string()
    .min(1, "Routine name is required")
    .max(100, "Routine name is too long"),

  exercises: z
    .array(
      z.object({
        exerciseId: z.string().cuid("Invalid exerciseId"),
        sets: z.number().int().min(1, "Sets must be at least 1"),
        reps: z.number().int().min(1, "Reps must be at least 1")
      })
    )
    .min(1, "Routine must have at least one exercise")
})