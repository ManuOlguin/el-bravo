import { z } from "zod";
import { EQUIPMENT } from "@/src/features/exercises/types";

/** Input de `createExerciseAction` (W1-3). Mensajes en español: se muestran tal cual en la UI. */
export const createExerciseInputSchema = z
  .object({
    name: z
      .string({ error: "Escribí un nombre" })
      .trim()
      .min(2, "El nombre tiene que tener al menos 2 letras")
      .max(100, "El nombre es demasiado largo (máximo 100 letras)"),
    measureType: z.enum(["reps", "duration"], { error: "Elegí si se mide por repeticiones o por tiempo" }),
    equipment: z.enum(EQUIPMENT, { error: "Elegí el equipamiento" }),
    tracksWeight: z.boolean({ error: "Indicá si usa peso" }),
    muscles: z
      .array(
        z.object({
          muscleId: z.string({ error: "Elegí un músculo" }).min(1, "Elegí un músculo"),
          percentage: z
            .number({ error: "Poné un porcentaje" })
            .int("El porcentaje tiene que ser un número entero")
            .min(1, "Cada músculo tiene que tener al menos 1 %")
            .max(100, "Un músculo no puede tener más de 100 %"),
        })
      )
      .min(1, "Elegí al menos un músculo"),
  })
  .superRefine((v, ctx) => {
    const ids = v.muscles.map((m) => m.muscleId);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: "custom", path: ["muscles"], message: "No podés repetir músculos en el mismo ejercicio" });
    }
    const sum = v.muscles.reduce((s, m) => s + m.percentage, 0);
    if (v.muscles.length > 0 && sum !== 100) {
      ctx.addIssue({ code: "custom", path: ["muscles"], message: `Los porcentajes tienen que sumar 100 % (ahora suman ${sum} %)` });
    }
  });

export type CreateExerciseInput = z.infer<typeof createExerciseInputSchema>;
