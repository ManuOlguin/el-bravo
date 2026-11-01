import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { AuthError } from "@/src/server/auth/errors";
import { primaryGroupKeyOf, visibleTo } from "@/src/server/exercises/catalog";
import { copyRoutineName, planExerciseCopies } from "./copy-plan";
import { buildVisibleNameIndex } from "@/src/server/exercises/name-index";
import { slugify } from "@/prisma/seed/slugify";
import { normalize } from "@/src/features/exercises/search";
import { isPendingExerciseId, PENDING_PREFIX } from "@/src/features/routines-share/match";
import { GROUP_KEYS, type ExerciseSummary } from "@/src/features/exercises/types";
import {
  FALLBACK_AUTHOR_NAME,
  routineInputSchema,
  type RoutineForEditor,
  type RoutineInput,
  type RoutineView,
  type RoutineVisibility,
} from "@/src/schemas/routine";
import type { ActivityInput } from "@/src/schemas/workout";

/**
 * Rutinas v2 (W2-1 Task 2): ejercicios ordenados con series objetivo individuales.
 * Solo el dueño las edita o borra; las públicas (fase 2) las lee otro usuario vía `getPublicRoutine`. Todo lo demás
 * es `AuthError("NOT_FOUND")` para cualquier otro, sin filtrar existencia.
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

/** Slug de un ejercicio propio: base legible + sufijo aleatorio (el slug es único global; `name` es único por dueño). */
function privateSlug(name: string): string {
  return `${slugify(name).slice(0, 60) || "ejercicio"}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Crea (o reusa, si ya hay uno visible con el mismo nombre normalizado) los ejercicios nuevos de la rutina
 * y reemplaza los ids `new:<tempId>`. Corre dentro de la transacción de la rutina.
 */
async function resolvePendingExercises(tx: Tx, userId: string, input: RoutineInput): Promise<RoutineInput> {
  const pending = input.exercises.filter((e) => isPendingExerciseId(e.exerciseId));
  if (pending.length === 0) return input;
  const defs = new Map((input.newExercises ?? []).map((n) => [n.tempId, n]));
  const visible = await tx.exercise.findMany({
    where: visibleTo(userId),
    orderBy: { id: "asc" },
    select: { id: true, name: true, createdByUserId: true },
  });
  const byName = buildVisibleNameIndex(visible);
  const muscleRows = await tx.muscle.findMany({ select: { id: true, slug: true } });
  const muscleId = new Map(muscleRows.map((m) => [m.slug, m.id]));
  const tempIdOf = (exerciseId: string) => exerciseId.slice(PENDING_PREFIX.length);
  const resolved = new Map<string, string>();
  for (const p of pending) {
    const tempId = tempIdOf(p.exerciseId);
    if (resolved.has(tempId)) continue;
    const def = defs.get(tempId);
    if (!def) throw new RoutineError("Falta la definición de un ejercicio nuevo. Volvé a importar la rutina.");
    const name = def.name.replace(/\s+/g, " ");
    // Un nombre que normaliza a "" (solo emoji o escritura no latina) no se busca por clave ni se agrega al mapa: cada
    // ejercicio nuevo es distinto. Solo se reusa uno propio con ese mismo nombre, porque (dueño, nombre) es único.
    const key = normalize(def.name);
    const existing = key
      ? byName.get(key)
      : (await tx.exercise.findFirst({ where: { createdByUserId: userId, name }, select: { id: true } }))?.id;
    if (existing) {
      resolved.set(tempId, existing);
      continue;
    }
    // Los músculos que no existen en el catálogo se descartan en silencio.
    const muscles = def.muscles.filter((m) => muscleId.has(m.muscleSlug));
    const shares = normalizeShares(muscles.map((m) => m.percentage));
    const created = await tx.exercise.create({
      data: {
        slug: privateSlug(def.name),
        name,
        nameEn: def.nameEn,
        measureType: def.measureType,
        equipment: def.equipment,
        tracksWeight: def.tracksWeight,
        createdByUserId: userId,
        source: def.source,
        muscles: { create: muscles.map((m, i) => ({ muscleId: muscleId.get(m.muscleSlug)!, percentage: shares[i] })) },
      },
      select: { id: true },
    });
    resolved.set(tempId, created.id);
    if (key) byName.set(key, created.id);
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
    const r = await tx.routine.create({
      data: { userId, name: input.name, notes: input.notes ?? null, visibility: input.visibility ?? "private" },
      select: { id: true },
    });
    await writeExercises(tx, r.id, input);
    return r.id;
  });
  return { routineId };
}

/** Reemplaza nombre, notas, ejercicios y series en una transacción (borrar y recrear). `visibility` solo si viene. */
export async function updateRoutine(userId: string, routineId: string, raw: RoutineInput): Promise<void> {
  const parsed = routineInputSchema.parse(raw);
  await prisma.$transaction(async (tx) => {
    await assertOwner(tx, userId, routineId);
    const input = await resolvePendingExercises(tx, userId, parsed);
    await assertExercisesVisible(tx, userId, input);
    await tx.routineExercise.deleteMany({ where: { routineId } });
    await tx.routine.update({
      where: { id: routineId },
      data: { name: input.name, notes: input.notes ?? null, ...(input.visibility ? { visibility: input.visibility } : {}) },
    });
    await writeExercises(tx, routineId, input);
  });
}

const copySourceInclude = {
  user: { select: { name: true, isActive: true } },
  exercises: {
    orderBy: { position: "asc" },
    include: {
      sets: { orderBy: { position: "asc" } },
      exercise: {
        select: {
          id: true, name: true, nameEn: true, description: true, instructions: true, mediaUrl: true,
          equipment: true, measureType: true, tracksWeight: true, createdByUserId: true,
          muscles: { select: { muscleId: true, percentage: true } },
          aliases: { select: { alias: true, locale: true } },
        },
      },
    },
  },
} as const;

type CopySourceRow = Prisma.RoutineGetPayload<{ include: typeof copySourceInclude }>;
type CopySourceExerciseRow = CopySourceRow["exercises"][number]["exercise"];

/** Duplica un ejercicio propio del autor como privado de `userId` (músculos, equipamiento, tipo, textos y alias). */
async function duplicateExercise(tx: Tx, userId: string, e: CopySourceExerciseRow): Promise<string> {
  // (dueño, nombre) es único: si ya tiene uno con ese mismo nombre (p. ej. nombres solo-emoji, que no se reusan por clave), se usa ese.
  const same = await tx.exercise.findFirst({ where: { createdByUserId: userId, name: e.name }, select: { id: true } });
  if (same) return same.id;
  const row = await tx.exercise.create({
    data: {
      slug: privateSlug(e.name),
      name: e.name,
      nameEn: e.nameEn,
      description: e.description,
      instructions: (e.instructions ?? undefined) as Prisma.InputJsonValue | undefined,
      mediaUrl: e.mediaUrl,
      equipment: e.equipment,
      measureType: e.measureType,
      tracksWeight: e.tracksWeight,
      createdByUserId: userId,
      muscles: { create: e.muscles.map((m) => ({ muscleId: m.muscleId, percentage: m.percentage })) },
      aliases: { create: e.aliases.map((a) => ({ alias: a.alias, locale: a.locale })) },
    },
    select: { id: true },
  });
  return row.id;
}

/**
 * "Copiar a mis rutinas" (pública de otro) o "Duplicar" (propia): rutina nueva PRIVADA de `userId` con los mismos
 * ejercicios y series, en una transacción. Ver `planExerciseCopies` para qué se referencia, reusa o duplica.
 * La privada de otro, una inexistente o la de un autor desactivado → `NOT_FOUND`. `own` = era una rutina del propio usuario.
 */
export async function copyRoutine(userId: string, routineId: string): Promise<{ routineId: string; own: boolean }> {
  const result = await prisma.$transaction(
    async (tx) => {
      const src = await tx.routine.findUnique({ where: { id: routineId }, include: copySourceInclude });
      const own = src?.userId === userId;
      if (!src || (!own && (src.visibility !== "public" || !src.user.isActive))) throw new AuthError("NOT_FOUND");

      const visible = await tx.exercise.findMany({
        where: visibleTo(userId),
        orderBy: { id: "asc" },
        select: { id: true, name: true, createdByUserId: true },
      });
      const plan = planExerciseCopies(src.exercises.map((e) => e.exercise), userId, visible);
      const byId = new Map(src.exercises.map((e) => [e.exercise.id, e.exercise]));
      const duplicates = new Map<string, string>(); // sourceId → id del duplicado
      const idFor = new Map<string, string>();
      for (const [exerciseId, d] of plan) {
        if (d.kind === "reference") {
          idFor.set(exerciseId, d.exerciseId);
          continue;
        }
        let dupId = duplicates.get(d.sourceId);
        if (!dupId) {
          dupId = await duplicateExercise(tx, userId, byId.get(d.sourceId)!);
          duplicates.set(d.sourceId, dupId);
        }
        idFor.set(exerciseId, dupId);
      }

      const r = await tx.routine.create({
        data: {
          userId,
          name: copyRoutineName(src.name, own),
          notes: src.notes,
          visibility: "private",
          // Duplicar una propia conserva la atribución del original; copiar de otro apunta a esa rutina y su autor.
          copiedFromRoutineId: own ? src.copiedFromRoutineId : src.id,
          copiedFromUserName: own ? src.copiedFromUserName : (src.user.name ?? FALLBACK_AUTHOR_NAME).slice(0, 80),
        },
        select: { id: true },
      });
      await writeExercises(tx, r.id, {
        name: src.name,
        notes: src.notes,
        exercises: src.exercises.map((e) => ({
          exerciseId: idFor.get(e.exercise.id)!,
          restSeconds: e.restSeconds,
          notes: e.notes,
          sets: e.sets.map((s) => ({
            kind: s.kind,
            targetReps: s.targetReps,
            targetDurationSeconds: s.targetDurationSeconds,
            targetWeightKg: s.targetWeightKg,
            restSeconds: s.restSeconds,
          })),
        })),
      });
      return { routineId: r.id, own };
    },
    // Hasta 40 ejercicios (+ duplicados) contra TiDB: el default de 5 s de Prisma queda justo.
    { timeout: 20_000, maxWait: 5_000 }
  );
  return result;
}

/** Los entrenamientos hechos con la rutina se conservan (`routineId` → null por `onDelete: SetNull`). */
export async function deleteRoutine(userId: string, routineId: string): Promise<void> {
  await assertOwner(prisma, userId, routineId);
  await prisma.routine.delete({ where: { id: routineId } });
}

const routineEditorInclude = {
  exercises: {
    orderBy: { position: "asc" },
    include: { exercise: { select: exerciseSummarySelect }, sets: { orderBy: { position: "asc" } } },
  },
} as const;

type RoutineEditorRow = Prisma.RoutineGetPayload<{ include: typeof routineEditorInclude }>;

function toRoutineForEditor(r: RoutineEditorRow): RoutineForEditor {
  return {
    id: r.id,
    name: r.name,
    notes: r.notes,
    visibility: r.visibility,
    copiedFromUserName: r.copiedFromUserName,
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

/** Solo el dueño (editor, en vivo, "Compartir" desde la tarjeta). */
export async function getRoutineForEditor(userId: string, routineId: string): Promise<RoutineForEditor> {
  const r = await prisma.routine.findUnique({ where: { id: routineId }, include: routineEditorInclude });
  if (!r || r.userId !== userId) throw new AuthError("NOT_FOUND");
  return toRoutineForEditor(r);
}

/**
 * `/routines/[id]` (fase 2): el dueño ve la suya (pública o privada); cualquier otro usuario logueado, solo si es
 * pública y el autor está activo. Si no, `NOT_FOUND` (nunca `FORBIDDEN`: no se revela que existe).
 */
export async function getPublicRoutine(viewerId: string, routineId: string): Promise<RoutineView> {
  const r = await prisma.routine.findUnique({
    where: { id: routineId },
    include: { ...routineEditorInclude, user: { select: { id: true, name: true, photoUrl: true, isActive: true } } },
  });
  const isOwner = r?.userId === viewerId;
  if (!r || (!isOwner && (r.visibility !== "public" || !r.user.isActive))) throw new AuthError("NOT_FOUND");
  return {
    ...toRoutineForEditor(r),
    visibility: r.visibility,
    copiedFromUserName: r.copiedFromUserName,
    owner: { id: r.user.id, name: r.user.name, photoUrl: r.user.photoUrl },
    isOwner,
  };
}

const routineSummarySelect = {
  id: true,
  name: true,
  createdAt: true,
  visibility: true,
  copiedFromUserName: true,
  exercises: {
    select: {
      _count: { select: { sets: true } },
      exercise: { select: { muscles: { select: { percentage: true, muscle: { select: { groupKey: true } } } } } },
    },
  },
} as const;

type RoutineSummaryRow = Prisma.RoutineGetPayload<{ select: typeof routineSummarySelect }>;

export type RoutineSummary = {
  id: string;
  name: string;
  exerciseCount: number;
  setCount: number;
  groupKeys: string[];
  visibility: RoutineVisibility;
  copiedFromUserName: string | null;
};

export type RoutineListItem = RoutineSummary & { lastUsedAt: Date | null };

const groupOrder = (k: string) => {
  const i = (GROUP_KEYS as readonly string[]).indexOf(k);
  return i < 0 ? GROUP_KEYS.length : i;
};

function toRoutineSummary(r: RoutineSummaryRow): RoutineSummary {
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
    groupKeys: [...keys].sort((a, b) => groupOrder(a) - groupOrder(b) || a.localeCompare(b)),
    visibility: r.visibility,
    copiedFromUserName: r.copiedFromUserName,
  };
}

/** Rutinas del usuario, las usadas más recientemente primero (después las nuevas). */
export async function listRoutines(userId: string): Promise<RoutineListItem[]> {
  const routines = await prisma.routine.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, select: routineSummarySelect });
  if (routines.length === 0) return [];
  const used = await prisma.activity.groupBy({
    by: ["routineId"],
    where: { userId, routineId: { in: routines.map((r) => r.id) } },
    _max: { startedAt: true },
  });
  const lastUsed = new Map(used.map((u) => [u.routineId, u._max.startedAt]));
  return routines
    .map((r) => ({ item: { ...toRoutineSummary(r), lastUsedAt: lastUsed.get(r.id) ?? null }, createdAt: r.createdAt }))
    .sort(
      (a, b) =>
        (b.item.lastUsedAt?.getTime() ?? 0) - (a.item.lastUsedAt?.getTime() ?? 0) || b.createdAt.getTime() - a.createdAt.getTime()
    )
    .map((x) => x.item);
}

/** Sección "Rutinas" de un perfil ajeno: solo las públicas (y nada si el autor está desactivado). Sin último uso. */
export async function listPublicRoutines(ownerId: string): Promise<RoutineSummary[]> {
  const rows = await prisma.routine.findMany({
    where: { userId: ownerId, visibility: "public", user: { isActive: true } },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: routineSummarySelect,
  });
  return rows.map(toRoutineSummary);
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
