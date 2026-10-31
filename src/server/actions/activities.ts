"use server";
/**
 * Server Actions de entrenamientos (W2-1 Task 2, roadmap D10).
 * Toda escritura pasa por `src/server/activities/service.ts`, que dispara puntos → insignias → notificaciones.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import { requireUser } from "@/src/server/auth/dal";
import { fail, ok, parseInput, runAction, type ActionResult } from "@/src/server/http/result";
import { activityInputSchema, type ActivityInput } from "@/src/schemas/workout";
import { createActivity, deleteActivity, updateActivity } from "@/src/server/activities/service";
import type { ActivityEffects } from "@/src/server/activities/effects";
import {
  currentScoringEffects,
  getLastPerformance,
  listActivityCategoriesForUser,
  sharedDaySeasonIds,
  type CategoryOption,
  type PreviousSet,
} from "@/src/features/workout/server/queries";

const idSchema = z.string().min(1).max(64);

function revalidateAfter(effects: ActivityEffects, activityId?: string) {
  revalidatePath("/home");
  revalidatePath("/profile");
  revalidatePath("/routines");
  revalidatePath("/stats");
  if (activityId) revalidatePath(`/workout/${activityId}`);
  for (const groupId of new Set(effects.scoring.map((s) => s.groupId))) revalidatePath(`/group/${groupId}`);
}

/** Prisma P2003: la categoría o algún ejercicio ya no existe. */
function isForeignKeyError(e: unknown) {
  return (e as { code?: unknown } | null)?.code === "P2003";
}
const STALE_DATA = "Algún dato del entrenamiento ya no existe (tipo de actividad o ejercicio). Recargá y probá de nuevo.";

/**
 * Crea un entrenamiento. Idempotente por `clientRequestId`: un reintento devuelve el mismo `activityId`
 * (`replayed: true`) con los puntos actuales de esa actividad.
 */
export async function createActivityAction(
  input: ActivityInput
): Promise<ActionResult<{ activityId: string; effects: ActivityEffects; replayed: boolean; sharedDaySeasonIds: string[] }>> {
  return runAction(async () => {
    const user = await requireUser();
    const parsed = parseInput(activityInputSchema, input);
    if (!parsed.ok) return parsed.result;
    const existed = await prisma.activity.findUnique({ where: { clientRequestId: parsed.data.clientRequestId }, select: { userId: true } });
    try {
      const { activityId, effects } = await createActivity(user.id, parsed.data);
      const replayed = !!existed;
      const finalEffects = replayed ? { scoring: await currentScoringEffects(user.id, activityId), badges: [] } : effects;
      revalidateAfter(finalEffects, activityId);
      const shared = finalEffects.scoring.length ? await sharedDaySeasonIds(activityId) : [];
      return ok(
        { activityId, effects: finalEffects, replayed, sharedDaySeasonIds: shared },
        replayed ? "Ya estaba guardado" : "Entrenamiento guardado"
      );
    } catch (e) {
      if (isForeignKeyError(e)) return fail(STALE_DATA);
      throw e;
    }
  });
}

export async function updateActivityAction(
  activityId: string,
  input: ActivityInput
): Promise<ActionResult<{ effects: ActivityEffects; sharedDaySeasonIds: string[] }>> {
  return runAction(async () => {
    const user = await requireUser();
    const id = idSchema.safeParse(activityId);
    if (!id.success) return fail("No encontramos ese entrenamiento.");
    const parsed = parseInput(activityInputSchema, input);
    if (!parsed.ok) return parsed.result;
    try {
      const { effects } = await updateActivity(user.id, id.data, parsed.data);
      revalidateAfter(effects, id.data);
      const shared = effects.scoring.length ? await sharedDaySeasonIds(id.data) : [];
      return ok({ effects, sharedDaySeasonIds: shared }, "Entrenamiento actualizado");
    } catch (e) {
      if (isForeignKeyError(e)) return fail(STALE_DATA);
      throw e;
    }
  });
}

export async function deleteActivityAction(activityId: string): Promise<ActionResult<{ effects: ActivityEffects }>> {
  return runAction(async () => {
    const user = await requireUser();
    const id = idSchema.safeParse(activityId);
    if (!id.success) return fail("No encontramos ese entrenamiento.");
    const { effects } = await deleteActivity(user.id, id.data);
    revalidateAfter(effects, id.data);
    return ok({ effects }, "Entrenamiento borrado");
  });
}

export async function listActivityCategoriesAction(): Promise<ActionResult<CategoryOption[]>> {
  return runAction(async () => {
    const user = await requireUser();
    return ok(await listActivityCategoriesForUser(user.id));
  });
}

/** Columna "Anterior": series de la última vez que el usuario hizo cada ejercicio. */
export async function getLastPerformanceAction(
  exerciseIds: string[],
  excludeActivityId?: string | null
): Promise<ActionResult<Record<string, PreviousSet[]>>> {
  return runAction(async () => {
    const user = await requireUser();
    const ids = z.array(idSchema).max(40).safeParse(exerciseIds);
    if (!ids.success) return fail("Datos inválidos");
    const exclude = excludeActivityId ? idSchema.safeParse(excludeActivityId) : null;
    return ok(await getLastPerformance(user.id, ids.data, exclude?.success ? exclude.data : null));
  });
}
