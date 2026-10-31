"use server";
/** Server Actions de rutinas (W2-1 Task 2, roadmap D10). Solo el dueño puede ver, editar o borrar. */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/src/server/auth/dal";
import { fail, ok, parseInput, runAction, type ActionResult } from "@/src/server/http/result";
import { routineInputSchema, type RoutineForEditor, type RoutineInput } from "@/src/schemas/routine";
import { activityInputSchema, type ActivityInput } from "@/src/schemas/workout";
import {
  RoutineError,
  copyRoutine,
  createRoutine,
  deleteRoutine,
  getRoutineForEditor,
  updateRoutine,
  updateRoutineFromWorkout,
} from "@/src/server/routines/service";

const idSchema = z.string().min(1).max(64);
const NOT_FOUND = "No encontramos esa rutina.";

function revalidateRoutines(routineId?: string) {
  revalidatePath("/routines");
  revalidatePath("/home");
  revalidatePath("/profile");
  if (routineId) {
    revalidatePath(`/routines/${routineId}`);
    revalidatePath(`/routines/${routineId}/edit`);
  }
}

/** Traduce `RoutineError` (regla de negocio) a `fail(message)`; el resto lo maneja `runAction`. */
async function guard<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  return runAction(async () => {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof RoutineError) return fail(e.message);
      throw e;
    }
  });
}

export async function createRoutineAction(input: RoutineInput): Promise<ActionResult<{ routineId: string }>> {
  return guard(async () => {
    const user = await requireUser();
    const parsed = parseInput(routineInputSchema, input);
    if (!parsed.ok) return parsed.result;
    const { routineId } = await createRoutine(user.id, parsed.data);
    revalidateRoutines();
    return ok({ routineId }, "Rutina creada");
  });
}

export async function updateRoutineAction(routineId: string, input: RoutineInput): Promise<ActionResult<void>> {
  return guard(async () => {
    const user = await requireUser();
    const id = idSchema.safeParse(routineId);
    if (!id.success) return fail(NOT_FOUND);
    const parsed = parseInput(routineInputSchema, input);
    if (!parsed.ok) return parsed.result;
    await updateRoutine(user.id, id.data, parsed.data);
    revalidateRoutines(id.data);
    return ok(undefined, "Rutina actualizada");
  });
}

export async function deleteRoutineAction(routineId: string): Promise<ActionResult<void>> {
  return guard(async () => {
    const user = await requireUser();
    const id = idSchema.safeParse(routineId);
    if (!id.success) return fail(NOT_FOUND);
    await deleteRoutine(user.id, id.data);
    revalidateRoutines(id.data);
    return ok(undefined, "Rutina borrada");
  });
}

/** "Actualizar la rutina con estos valores": las series del entrenamiento pasan a ser los objetivos. */
export async function updateRoutineFromWorkoutAction(routineId: string, input: ActivityInput): Promise<ActionResult<void>> {
  return guard(async () => {
    const user = await requireUser();
    const id = idSchema.safeParse(routineId);
    if (!id.success) return fail(NOT_FOUND);
    const parsed = parseInput(activityInputSchema, input);
    if (!parsed.ok) return parsed.result;
    await updateRoutineFromWorkout(user.id, id.data, parsed.data);
    revalidateRoutines(id.data);
    return ok(undefined, "Rutina actualizada con estos valores");
  });
}

/** "Copiar a mis rutinas" (pública de otro) o "Duplicar" (propia). La privada de otro → "No encontramos…". */
export async function copyRoutineAction(routineId: string): Promise<ActionResult<{ routineId: string }>> {
  return guard(async () => {
    const user = await requireUser();
    const id = idSchema.safeParse(routineId);
    if (!id.success) return fail(NOT_FOUND);
    const { routineId: copyId, own } = await copyRoutine(user.id, id.data);
    revalidateRoutines();
    return ok({ routineId: copyId }, own ? "Rutina duplicada" : "Listo: la rutina ya está en tus rutinas");
  });
}

/** Para el atajo "Desde una rutina" de /workout/new (carga la rutina en el editor). */
export async function getRoutineForEditorAction(routineId: string): Promise<ActionResult<RoutineForEditor>> {
  return guard(async () => {
    const user = await requireUser();
    const id = idSchema.safeParse(routineId);
    if (!id.success) return fail(NOT_FOUND);
    return ok(await getRoutineForEditor(user.id, id.data));
  });
}
