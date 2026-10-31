import "server-only";
import { prisma } from "@/src/lib/db";
import type { CatalogEntry, Equipment, ExerciseDetail } from "@/src/features/exercises/types";
import { parseInstructions } from "./instructions";

export type CatalogMuscle = { id: string; slug: string; name: string; groupKey: string };

/** Ejercicios oficiales (`createdByUserId = null`) o del usuario. Los privados de otros nunca se ven. */
export const visibleTo = (userId: string) => ({ OR: [{ createdByUserId: null }, { createdByUserId: userId }] });

export const catalogSelect = {
  id: true,
  name: true,
  nameEn: true,
  measureType: true,
  equipment: true,
  tracksWeight: true,
  mediaUrl: true,
  createdByUserId: true,
  aliases: { select: { alias: true } },
  muscles: { select: { percentage: true, muscle: { select: { groupKey: true } } } },
} as const;

type CatalogRow = {
  id: string;
  name: string;
  nameEn: string | null;
  measureType: "reps" | "duration";
  equipment: Equipment;
  tracksWeight: boolean;
  mediaUrl: string | null;
  createdByUserId: string | null;
  aliases: { alias: string }[];
  muscles: { percentage: number; muscle: { groupKey: string } }[];
};

/** `groupKey` del músculo con mayor porcentaje (empate: el primero alfabéticamente, para que sea estable). */
export function primaryGroupKeyOf(muscles: { percentage: number; groupKey: string }[]): string | null {
  const top = [...muscles].sort((a, b) => b.percentage - a.percentage || a.groupKey.localeCompare(b.groupKey))[0];
  return top?.groupKey ?? null;
}

export function toCatalogEntry(row: CatalogRow, userId: string): CatalogEntry {
  const muscles = row.muscles.map((m) => ({ percentage: m.percentage, groupKey: m.muscle.groupKey }));
  return {
    id: row.id,
    name: row.name,
    nameEn: row.nameEn,
    measureType: row.measureType,
    equipment: row.equipment,
    tracksWeight: row.tracksWeight,
    primaryGroupKey: primaryGroupKeyOf(muscles),
    mediaUrl: row.mediaUrl,
    aliases: row.aliases.map((a) => a.alias),
    groupKeys: [...new Set(muscles.map((m) => m.groupKey))],
    isMine: row.createdByUserId === userId,
  };
}

/** Catálogo completo para el cliente (~100 ítems): la búsqueda corre en el cliente sin round-trips. */
export async function getExerciseCatalog(userId: string): Promise<{ exercises: CatalogEntry[]; muscles: CatalogMuscle[] }> {
  const [rows, muscles] = await Promise.all([
    prisma.exercise.findMany({ where: visibleTo(userId), select: catalogSelect, orderBy: { name: "asc" } }),
    prisma.muscle.findMany({ select: { id: true, slug: true, name: true, groupKey: true }, orderBy: { name: "asc" } }),
  ]);
  return { exercises: rows.map((r) => toCatalogEntry(r, userId)), muscles };
}

/**
 * Detalle para el botón "?". Si se pasa `viewerId`, solo devuelve ejercicios visibles para ese usuario.
 * `reviewed: false` = texto en borrador (la UI muestra "Texto en revisión").
 */
export async function getExerciseDetail(exerciseId: string, viewerId?: string): Promise<ExerciseDetail | null> {
  const row = await prisma.exercise.findFirst({
    where: viewerId ? { id: exerciseId, ...visibleTo(viewerId) } : { id: exerciseId },
    select: {
      id: true,
      name: true,
      nameEn: true,
      description: true,
      instructions: true,
      mediaUrl: true,
      equipment: true,
      muscles: { select: { percentage: true, muscle: { select: { name: true, groupKey: true } } } },
    },
  });
  if (!row) return null;
  const muscles = row.muscles
    .map((m) => ({ name: m.muscle.name, groupKey: m.muscle.groupKey, percentage: m.percentage }))
    .sort((a, b) => b.percentage - a.percentage || a.name.localeCompare(b.name, "es"));
  const { steps, reviewed } = parseInstructions(row.instructions);
  return {
    id: row.id,
    name: row.name,
    nameEn: row.nameEn,
    description: row.description,
    instructions: steps,
    reviewed,
    mediaUrl: row.mediaUrl,
    equipment: row.equipment,
    primaryGroupKey: primaryGroupKeyOf(muscles),
    muscles,
  };
}
