import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { zonedToUtc, localDateOf, localTimeOf } from "@/src/lib/time";
import { AuthError } from "@/src/server/auth/errors";
import { activityInputSchema, type ActivityInput } from "@/src/schemas/workout";
import { runActivityEffects, type ActivitySnapshot, type ActivityEffects } from "./effects";

/**
 * Único camino de escritura de actividades (§5.4). Valida con Zod, escribe en una transacción y,
 * DESPUÉS del commit, dispara `runActivityEffects` (puntos → insignias → notificaciones).
 * Errores: `AuthError("NOT_FOUND" | "FORBIDDEN")`, `ZodError` o errores de Prisma (FK inválida, etc.).
 */

type Tx = Prisma.TransactionClient;
const snapshotSelect = {
  id: true,
  userId: true,
  activityCategoryId: true,
  startedAt: true,
  durationMinutes: true,
} as const;

async function userTz(userId: string) {
  return (await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { timezone: true } })).timezone;
}

async function assertRoutineOwner(tx: Tx, userId: string, routineId: string | null | undefined) {
  if (!routineId) return;
  const r = await tx.routine.findUnique({ where: { id: routineId }, select: { userId: true } });
  if (!r) throw new AuthError("NOT_FOUND");
  if (r.userId !== userId) throw new AuthError("FORBIDDEN");
}

async function writeExercises(tx: Tx, activityId: string, exercises: ActivityInput["exercises"]) {
  for (const [position, ex] of exercises.entries()) {
    await tx.activityExercise.create({
      data: {
        activityId,
        exerciseId: ex.exerciseId,
        position,
        notes: ex.notes ?? null,
        sets: {
          create: ex.sets.map((s, i) => ({
            position: i,
            kind: s.kind,
            reps: s.reps,
            durationSeconds: s.durationSeconds,
            weightKg: s.weightKg,
            restSeconds: s.restSeconds,
            completed: s.completed,
          })),
        },
      },
    });
  }
}

async function findByRequestId(userId: string, clientRequestId: string) {
  const existing = await prisma.activity.findUnique({
    where: { clientRequestId },
    select: { id: true, userId: true },
  });
  if (existing && existing.userId !== userId) throw new AuthError("FORBIDDEN");
  return existing;
}

function isUniqueViolation(e: unknown) {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

export async function createActivity(
  userId: string,
  raw: ActivityInput
): Promise<{ activityId: string; effects: ActivityEffects }> {
  const input = activityInputSchema.parse(raw);
  // Idempotencia: un reintento con el mismo clientRequestId devuelve la actividad ya creada.
  const existing = await findByRequestId(userId, input.clientRequestId);
  if (existing) return { activityId: existing.id, effects: { scoring: [], badges: [] } };

  const startedAt = zonedToUtc(input.localDate, input.localTime, await userTz(userId));
  let after: ActivitySnapshot;
  try {
    after = await prisma.$transaction(async (tx) => {
      await assertRoutineOwner(tx, userId, input.routineId);
      const a = await tx.activity.create({
        data: {
          userId,
          activityCategoryId: input.activityCategoryId,
          routineId: input.routineId ?? null,
          startedAt,
          durationMinutes: input.durationMinutes,
          notes: input.notes ?? null,
          clientRequestId: input.clientRequestId,
        },
        select: snapshotSelect,
      });
      await writeExercises(tx, a.id, input.exercises);
      return a;
    });
  } catch (e) {
    // Doble envío concurrente: el otro request ganó la carrera por el clientRequestId.
    if (isUniqueViolation(e)) {
      const winner = await findByRequestId(userId, input.clientRequestId);
      if (winner) return { activityId: winner.id, effects: { scoring: [], badges: [] } };
    }
    throw e;
  }
  const effects = await runActivityEffects({ userId, before: null, after });
  return { activityId: after.id, effects };
}

async function loadOwned(userId: string, activityId: string): Promise<ActivitySnapshot> {
  const a = await prisma.activity.findUnique({ where: { id: activityId }, select: snapshotSelect });
  if (!a || a.userId !== userId) throw new AuthError("NOT_FOUND");
  return a;
}

/** Reemplaza todos los campos y los ejercicios/series. El clientRequestId original no cambia. */
export async function updateActivity(
  userId: string,
  activityId: string,
  raw: ActivityInput
): Promise<{ effects: ActivityEffects }> {
  const input = activityInputSchema.parse(raw);
  const before = await loadOwned(userId, activityId);
  const startedAt = zonedToUtc(input.localDate, input.localTime, await userTz(userId));
  const after = await prisma.$transaction(async (tx) => {
    await assertRoutineOwner(tx, userId, input.routineId);
    await tx.activityExercise.deleteMany({ where: { activityId } });
    const a = await tx.activity.update({
      where: { id: activityId },
      data: {
        activityCategoryId: input.activityCategoryId,
        routineId: input.routineId ?? null,
        startedAt,
        durationMinutes: input.durationMinutes,
        notes: input.notes ?? null,
      },
      select: snapshotSelect,
    });
    await writeExercises(tx, activityId, input.exercises);
    return a;
  });
  return { effects: await runActivityEffects({ userId, before, after }) };
}

/** Borrado duro (D7): los hijos (ejercicios, series, medios, puntos, reacciones) caen por cascade. */
export async function deleteActivity(userId: string, activityId: string): Promise<{ effects: ActivityEffects }> {
  const before = await loadOwned(userId, activityId);
  await (await import("@/src/server/media")).deleteActivityObjects(activityId); // W1-5: fotos del bucket
  await prisma.activity.delete({ where: { id: activityId } });
  return { effects: await runActivityEffects({ userId, before, after: null }) };
}

/** Datos para precargar el formulario de edición, con fecha y hora en la zona del usuario. */
export async function getActivityForEdit(userId: string, activityId: string): Promise<ActivityInput & { id: string }> {
  const a = await prisma.activity.findUnique({
    where: { id: activityId },
    include: { exercises: { orderBy: { position: "asc" }, include: { sets: { orderBy: { position: "asc" } } } } },
  });
  if (!a || a.userId !== userId) throw new AuthError("NOT_FOUND");
  const tz = await userTz(userId);
  return {
    id: a.id,
    clientRequestId: `edit-${a.id}`,
    activityCategoryId: a.activityCategoryId,
    routineId: a.routineId,
    localDate: localDateOf(a.startedAt, tz),
    localTime: localTimeOf(a.startedAt, tz),
    durationMinutes: a.durationMinutes,
    notes: a.notes,
    exercises: a.exercises.map((e) => ({
      exerciseId: e.exerciseId,
      notes: e.notes,
      sets: e.sets.map((s) => ({
        kind: s.kind,
        reps: s.reps,
        durationSeconds: s.durationSeconds,
        weightKg: s.weightKg,
        restSeconds: s.restSeconds,
        completed: s.completed,
      })),
    })),
  };
}
