import "server-only";
import { prisma } from "@/src/lib/db";
import { slugify } from "@/prisma/seed/slugify";
import { normalize } from "@/src/features/exercises/search";
import type { CatalogEntry } from "@/src/features/exercises/types";
import type { CreateExerciseInput } from "@/src/schemas/exercise";
import { catalogSelect, toCatalogEntry, visibleTo } from "./catalog";

export type CreateExerciseResult =
  | { ok: true; exercise: CatalogEntry }
  /** Ya hay uno visible (oficial o propio) con el mismo nombre normalizado: la UI ofrece usarlo. */
  | { ok: false; reason: "duplicate"; existing: { id: string; name: string } }
  /**
   * `Exercise.name` es único en toda la tabla (schema W0-C): el nombre lo usa un ejercicio privado de otro usuario.
   * No se revela cuál; hace falta otro nombre.
   */
  | { ok: false; reason: "name_taken" }
  | { ok: false; reason: "invalid_muscles" };

const isUniqueViolation = (e: unknown) => (e as { code?: unknown } | null)?.code === "P2002";

async function findVisibleDuplicate(userId: string, name: string) {
  const target = normalize(name);
  const rows = await prisma.exercise.findMany({ where: visibleTo(userId), select: { id: true, name: true } });
  return rows.find((r) => normalize(r.name) === target) ?? null;
}

async function uniqueSlug(name: string) {
  const base = slugify(name).slice(0, 70).replace(/-$/, "") || "ejercicio";
  const taken = new Set(
    (await prisma.exercise.findMany({ where: { slug: { startsWith: base } }, select: { slug: true } })).map((r) => r.slug)
  );
  for (let i = 1; ; i++) {
    const slug = i === 1 ? base : `${base}-${i}`;
    if (!taken.has(slug)) return slug;
  }
}

/** Crea un ejercicio propio. El input ya viene validado con `createExerciseInputSchema`. */
export async function createExercise(userId: string, input: CreateExerciseInput): Promise<CreateExerciseResult> {
  const name = input.name.trim().replace(/\s+/g, " ");
  const dup = await findVisibleDuplicate(userId, name);
  if (dup) return { ok: false, reason: "duplicate", existing: dup };

  const muscleIds = input.muscles.map((m) => m.muscleId);
  if ((await prisma.muscle.count({ where: { id: { in: muscleIds } } })) !== new Set(muscleIds).size) {
    return { ok: false, reason: "invalid_muscles" };
  }

  // Reintenta si otro request tomó el mismo slug entre la lectura y el insert.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const row = await prisma.exercise.create({
        data: {
          slug: await uniqueSlug(name),
          name,
          measureType: input.measureType,
          equipment: input.equipment,
          tracksWeight: input.tracksWeight,
          createdByUserId: userId,
          muscles: { create: input.muscles.map((m) => ({ muscleId: m.muscleId, percentage: m.percentage })) },
        },
        select: catalogSelect,
      });
      return { ok: true, exercise: toCatalogEntry(row, userId) };
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
      const raced = await findVisibleDuplicate(userId, name);
      if (raced) return { ok: false, reason: "duplicate", existing: raced };
      // La colación de MySQL compara sin mayúsculas ni acentos, igual que `normalize()`.
      if (await prisma.exercise.findFirst({ where: { name }, select: { id: true } })) return { ok: false, reason: "name_taken" };
    }
  }
  throw new Error("No se pudo generar un slug único para el ejercicio");
}
