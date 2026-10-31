import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { AuthError } from "@/src/server/auth/errors";
import { primaryGroupKeyOf, visibleTo } from "@/src/server/exercises/catalog";
import { slugify } from "@/prisma/seed/slugify";
import { normalize } from "@/src/features/exercises/search";
import { isPendingExerciseId, PENDING_PREFIX } from "@/src/features/routines-share/match";
import { GROUP_KEYS, type ExerciseSummary } from "@/src/features/exercises/types";
import { routineInputSchema, type RoutineForEditor, type RoutineInput } from "@/src/schemas/routine";
import type { ActivityInput } from "@/src/schemas/workout";

/**
 * Rutinas v2 (W2-1 Task 2): ejercicios ordenados con series objetivo individuales.
 * Solo el dueño las ve, edita o borra (`AuthError("NOT_FOUND")` para cualquier otro, sin filtrar existencia).
 * Las escrituras de ejercicios+series corren en UNA transacción: si algo falla, la rutina queda como estaba.
 */

type Tx = Prisma.TransactionClient;

/** Error de negocio con mensaje para el usuario (es-AR). */
export class RoutineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoutineError";
  }
}

const exerciseSummarySelect = {
  id: true,
  name: true,
  nameEn: true,
  measureType: true,
  equipment: true,
  tracksWeight: true,
  mediaUrl: true,
  muscles: { select: { percentage: true, muscle: { select: { groupKey: true } } } },
} as const;

type ExerciseRow = Prisma.ExerciseGetPayload<{ select: typeof exerciseSummarySelect }>;

export function toExerciseSummary(e: ExerciseRow): ExerciseSummary {
  return {
    id: e.id,
    name: e.name,
    nameEn: e.nameEn,
    measureType: e.measureType,
    equipment: e.equipment,
    tracksWeight: e.tracksWeight,
    primaryGroupKey: primaryGroupKeyOf(e.muscles.map((m) => ({ percentage: m.percentage, groupKey: m.muscle.groupKey }))),
    mediaUrl: e.mediaUrl,
  };
}

export { exerciseSummarySelect };

async function assertOwner(db: Tx | typeof prisma, userId: string, routineId: string) {
  const r = await db.routine.findUnique({ where: { id: routineId }, select: { userId: true } });
  if (!r || r.userId !== userId) throw new AuthError("NOT_FOUND");
}

/** Porcentajes renormalizados a enteros que suman 100 (la IA puede no sumar exacto); el resto va al primero. */
function normalizeShares(percentages: number[]): number[] {
  const total = percentages.reduce((s, p) => s + p, 0);
  if (total === 0) return [];
  const rest = percentages.slice(1).map((p) => Math.round((p * 100) / total));
  return [100 - rest.reduce((s, p) => s + p, 0), ...rest];
}

/**
 * Crea (o reusa, si ya hay uno visible con el mismo nombre normalizado) los ejercicios nuevos de la rutina
 * y reemplaza los ids `new:<tempId>`. Corre dentro de la transacción de la rutina.
 */
async function resolvePendingExercises(tx: Tx, userId: string, input: RoutineInput): Promise<RoutineInput> {
  const pending = input.exercises.filter((e) => isPendingExerciseId(e.exerciseId));
  if (pending.length === 0) return input;
  const defs = new Map((input.newExercises ?? []).map((n) => [n.tempId, n]));
  const visible = await tx.exercise.findMany({ where: visibleTo(userId), select: { id: true, name: true } });
  const byName = new Map(visible.map((v) => [normalize(v.name), v.id]));
  const muscleRows = await tx.muscle.findMany({ select: { id: true, slug: true } });
  const muscleId = new Map(muscleRows.map((m) => [m.slug, m.id]));
  const tempIdOf = (exerciseId: string) => exerciseId.slice(PENDING_PREFIX.length);
  const resolved = new Map<string, string>();
  for (const p of pending) {
    const tempId = tempIdOf(p.exerciseId);
    if (resolved.has(tempId)) continue;
    const def = defs.get(tempId);
    if (!def) throw new RoutineError("Falta la definición de un ejercicio nuevo. Volvé a importar la rutina.");
    const existing = byName.get(normalize(def.name));
    if (existing) {
      resolved.set(tempId, existing);
      continue;
    }
    // Los músculos que no existen en el catálogo se descartan en silencio.
    const muscles = def.muscles.filter((m) => muscleId.has(m.muscleSlug));
    const shares = normalizeShares(muscles.map((m) => m.percentage));
    const created = await tx.exercise.create({
      data: {
        slug: `${slugify(def.name).slice(0, 60) || "ejercicio"}-${Math.random().toString(36).slice(2, 8)}`,
        name: def.name.replace(/\s+/g, " "),
        nameEn: def.nameEn,
        measureType: def.measureType,
        equipment: def.equipment,
        tracksWeight: def.tracksWeight,
        createdByUserId: userId,
        // `def.source` todavía no se guarda: no hay columna hasta la fase 3.
        muscles: { create: muscles.map((m, i) => ({ muscleId: muscleId.get(m.muscleSlug)!, percentage: shares[i] })) },
      },
      select: { id: true },
    });
    resolved.set(tempId, created.id);
    byName.set(normalize(def.name), created.id);
  }
  return {
    ...input,
    newExercises: undefined,
    exercises: input.exercises.map((e) => (isPendingExerciseId(e.exerciseId) ? { ...e, exerciseId: resolved.get(tempIdOf(e.exerciseId))! } : e)),
  };
}

/** Todos los ejercicios existen y el usuario puede verlos (oficiales o propios). */
async function assertExercisesVisible(tx: Tx, userId: string, input: RoutineInput) {
  const ids = [...new Set(input.exercises.map((e) => e.exerciseId))];
  const found = await tx.exercise.count({ where: { id: { in: ids }, ...visibleTo(userId) } });
  if (found !== ids.length) throw new RoutineError("Alguno de los ejercicios ya no existe. Recargá y probá de nuevo.");
}

async function writeExercises(tx: Tx, routineId: string, input: RoutineInput) {
  for (const [position, e] of input.exercises.entries()) {
    await tx.routineExercise.create({
      data: {
        routineId,
        exerciseId: e.exerciseId,
        position,
        restSeconds: e.restSeconds,
        notes: e.notes ?? null,
        sets: {
          create: e.sets.map((s, i) => ({
            position: i,
            kind: s.kind,
            targetReps: s.targetReps,
            targetDurationSeconds: s.targetDurationSeconds,
            targetWeightKg: s.targetWeightKg,
            restSeconds: s.restSeconds,
          })),
        },
      },
    });
  }
}

export async function createRoutine(userId: string, raw: RoutineInput): Promise<{ routineId: string }> {
  const parsed = routineInputSchema.parse(raw);
  const routineId = await prisma.$transaction(async (tx) => {
    const input = await resolvePendingExercises(tx, userId, parsed);
    await assertExercisesVisible(tx, userId, input);
    const r = await tx.routine.create({ data: { userId, name: input.name, notes: input.notes ?? null }, select: { id: true } });
    await writeExercises(tx, r.id, input);
    return r.id;
  });
  return { routineId };
}

/** Reemplaza nombre, notas, ejercicios y series en una transacción (borrar y recrear). */
export async function updateRoutine(userId: string, routineId: string, raw: RoutineInput): Promise<void> {
  const parsed = routineInputSchema.parse(raw);
  await prisma.$transaction(async (tx) => {
    await assertOwner(tx, userId, routineId);
    const input = await resolvePendingExercises(tx, userId, parsed);
    await assertExercisesVisible(tx, userId, input);
    await tx.routineExercise.deleteMany({ where: { routineId } });
    await tx.routine.update({ where: { id: routineId }, data: { name: input.name, notes: input.notes ?? null } });
    await writeExercises(tx, routineId, input);
  });
}

/** Los entrenamientos hechos con la rutina se conservan (`routineId` → null por `onDelete: SetNull`). */
export async function deleteRoutine(userId: string, routineId: string): Promise<void> {
  await assertOwner(prisma, userId, routineId);
  await prisma.routine.delete({ where: { id: routineId } });
}

export async function getRoutineForEditor(userId: string, routineId: string): Promise<RoutineForEditor> {
  const r = await prisma.routine.findUnique({
    where: { id: routineId },
    include: {
      exercises: {
        orderBy: { position: "asc" },
        include: { exercise: { select: exerciseSummarySelect }, sets: { orderBy: { position: "asc" } } },
      },
    },
  });
  if (!r || r.userId !== userId) throw new AuthError("NOT_FOUND");
  return {
    id: r.id,
    name: r.name,
    notes: r.notes,
    exercises: r.exercises.map((re) => ({
      exercise: toExerciseSummary(re.exercise),
      restSeconds: re.restSeconds,
      notes: re.notes,
      sets: re.sets.map((s) => ({
        kind: s.kind,
        targetReps: s.targetReps,
        targetDurationSeconds: s.targetDurationSeconds,
        targetWeightKg: s.targetWeightKg,
        restSeconds: s.restSeconds,
      })),
    })),
  };
}

export type RoutineListItem = {
  id: string;
  name: string;
  exerciseCount: number;
  setCount: number;
  groupKeys: string[];
  lastUsedAt: Date | null;
};

/** Rutinas del usuario, las usadas más recientemente primero (después las nuevas). */
export async function listRoutines(userId: string): Promise<RoutineListItem[]> {
  const routines = await prisma.routine.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      createdAt: true,
      exercises: {
        select: {
          _count: { select: { sets: true } },
          exercise: { select: { muscles: { select: { percentage: true, muscle: { select: { groupKey: true } } } } } },
        },
      },
    },
  });
  if (routines.length === 0) return [];
  const used = await prisma.activity.groupBy({
    by: ["routineId"],
    where: { userId, routineId: { in: routines.map((r) => r.id) } },
    _max: { startedAt: true },
  });
  const lastUsed = new Map(used.map((u) => [u.routineId, u._max.startedAt]));
  const order = (k: string) => {
    const i = (GROUP_KEYS as readonly string[]).indexOf(k);
    return i < 0 ? GROUP_KEYS.length : i;
  };
  return routines
    .map((r) => {
      const keys = new Set<string>();
      for (const e of r.exercises) {
        const k = primaryGroupKeyOf(e.exercise.muscles.map((m) => ({ percentage: m.percentage, groupKey: m.muscle.groupKey })));
        if (k) keys.add(k);
      }
      return {
        id: r.id,
        name: r.name,
        exerciseCount: r.exercises.length,
        setCount: r.exercises.reduce((n, e) => n + e._count.sets, 0),
        groupKeys: [...keys].sort((a, b) => order(a) - order(b) || a.localeCompare(b)),
        lastUsedAt: lastUsed.get(r.id) ?? null,
        createdAt: r.createdAt,
      };
    })
    .sort((a, b) => (b.lastUsedAt?.getTime() ?? 0) - (a.lastUsedAt?.getTime() ?? 0) || b.createdAt.getTime() - a.createdAt.getTime())
    .map((r) => ({ id: r.id, name: r.name, exerciseCount: r.exerciseCount, setCount: r.setCount, groupKeys: r.groupKeys, lastUsedAt: r.lastUsedAt }));
}

/**
 * "Actualizar la rutina con estos valores": las series hechas pasan a ser los objetivos.
 * Conserva nombre y notas de la rutina; si todas las series de un ejercicio tienen el mismo descanso,
 * queda como descanso del ejercicio.
 */
export async function updateRoutineFromWorkout(userId: string, routineId: string, activity: ActivityInput): Promise<void> {
  const current = await prisma.routine.findUnique({ where: { id: routineId }, select: { userId: true, name: true, notes: true } });
  if (!current || current.userId !== userId) throw new AuthError("NOT_FOUND");
  const exercises = activity.exercises.filter((e) => e.sets.length > 0);
  if (exercises.length === 0) throw new RoutineError("El entrenamiento no tiene series para copiar a la rutina.");
  const input: RoutineInput = {
    name: current.name,
    notes: current.notes,
    exercises: exercises.map((e) => {
      const rests = e.sets.map((s) => s.restSeconds ?? null);
      const shared = rests.every((r) => r === rests[0]);
      return {
        exerciseId: e.exerciseId,
        notes: e.notes ?? null,
        restSeconds: shared ? rests[0] : null,
        sets: e.sets.map((s) => ({
          kind: s.kind,
          targetReps: s.reps,
          targetDurationSeconds: s.durationSeconds,
          targetWeightKg: s.weightKg,
          restSeconds: shared ? null : (s.restSeconds ?? null),
        })),
      };
    }),
  };
  await updateRoutine(userId, routineId, input);
}
