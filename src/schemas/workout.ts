import { z } from "zod";

const emptyToNull = (v: unknown) => (v === "" || v === undefined ? null : v);
const optInt = (min: number, max: number) => z.preprocess(emptyToNull, z.coerce.number().int().min(min).max(max).nullable());
const optNum = (min: number, max: number) => z.preprocess(emptyToNull, z.coerce.number().min(min).max(max).nullable());

export const setKindSchema = z.enum(["warmup", "normal", "drop", "failure"]);

export const setInputSchema = z
  .object({
    kind: setKindSchema.default("normal"),
    reps: optInt(1, 1000).default(null),
    durationSeconds: optInt(1, 36000).default(null),
    weightKg: optNum(0, 1000).default(null),
    restSeconds: optInt(0, 3600).default(null),
    completed: z.boolean().default(true),
  })
  .refine((s) => s.reps !== null || s.durationSeconds !== null, { message: "Cada serie necesita repeticiones o tiempo", path: ["reps"] });

export const exerciseEntryInputSchema = z.object({
  exerciseId: z.string().min(1, "Elegí un ejercicio"),
  notes: z.string().trim().max(500).optional().nullable(),
  sets: z.array(setInputSchema).min(1, "Agregá al menos una serie").max(30),
});

export const activityInputSchema = z.object({
  clientRequestId: z.string().min(1).max(64),
  activityCategoryId: z.string().min(1, "Elegí el tipo de actividad"),
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  localTime: z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida"),
  durationMinutes: z.coerce.number().int().min(1, "La duración mínima es 1 minuto").max(1440, "Máximo 24 horas"),
  notes: z.string().trim().max(2000).optional().nullable(),
  routineId: z.string().optional().nullable(),
  exercises: z.array(exerciseEntryInputSchema).max(40).default([]),
});

export type SetInput = z.infer<typeof setInputSchema>;
export type ExerciseEntryInput = z.infer<typeof exerciseEntryInputSchema>;
export type ActivityInput = z.infer<typeof activityInputSchema>;
