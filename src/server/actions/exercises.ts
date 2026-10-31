"use server";
import { z } from "zod";
import { requireUser } from "@/src/server/auth/dal";
import { fail, ok, parseInput, runAction, type ActionResult } from "@/src/server/http/result";
import { getExerciseCatalog, getExerciseDetail } from "@/src/server/exercises/catalog";
import { createExercise } from "@/src/server/exercises/create";
import { createExerciseInputSchema } from "@/src/schemas/exercise";
import type { CatalogEntry, ExerciseDetail } from "@/src/features/exercises/types";

export async function getExerciseCatalogAction(): Promise<ActionResult<Awaited<ReturnType<typeof getExerciseCatalog>>>> {
  return runAction(async () => {
    const user = await requireUser();
    return ok(await getExerciseCatalog(user.id));
  });
}

export async function getExerciseDetailAction(exerciseId: string): Promise<ActionResult<ExerciseDetail>> {
  return runAction(async () => {
    const user = await requireUser();
    const id = z.string().min(1).max(64).safeParse(exerciseId);
    const detail = id.success ? await getExerciseDetail(id.data, user.id) : null;
    return detail ? ok(detail) : fail("No encontramos ese ejercicio.");
  });
}

/**
 * Igual que `ActionResult<{ exercise }>`, pero el error de nombre duplicado trae además `existing`
 * para que la UI ofrezca "Usar «<existente>»" (sigue siendo asignable a `ActionResult`).
 */
export type CreateExerciseActionResult =
  | ActionResult<{ exercise: CatalogEntry }>
  | { ok: false; error: string; fieldErrors?: Record<string, string[]>; existing: { id: string; name: string } };

export async function createExerciseAction(input: unknown): Promise<CreateExerciseActionResult> {
  return runAction<{ exercise: CatalogEntry }>(async () => {
    const user = await requireUser();
    const parsed = parseInput(createExerciseInputSchema, input);
    if (!parsed.ok) return parsed.result;
    const r = await createExercise(user.id, parsed.data);
    if (r.ok) return ok({ exercise: r.exercise }, `Creaste «${r.exercise.name}»`);
    switch (r.reason) {
      case "duplicate": {
        const error = `Ya existe un ejercicio con ese nombre: ${r.existing.name}`;
        return { ok: false, error, fieldErrors: { name: [error] }, existing: r.existing } as ActionResult<never>;
      }
      case "name_taken":
        return fail("Ya existe un ejercicio con ese nombre. Probá con otro.", { name: ["Ya existe un ejercicio con ese nombre"] });
      case "invalid_muscles":
        return fail("Hay músculos que no existen. Recargá la página y probá de nuevo.");
    }
  });
}
