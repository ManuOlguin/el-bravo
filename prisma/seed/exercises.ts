// W1-3 es dueño de este archivo y de prisma/seed/data/** (catálogo completo con equipamiento, alias, etc.).
//
// Fuente de verdad: prisma/seed/data/exercises.json (validado con Zod en src/features/exercises/catalog-schema.ts).
// Decisión W1-3 (31-oct-2026): `description` e `instructions` se cargan SIEMPRE, aunque `reviewed` sea false;
// la UI muestra "Texto en revisión" en ese caso. Como no se cambia el schema, `reviewed` viaja dentro de la
// columna Json `instructions` con la forma `{ steps: string[], reviewed: boolean }`.
import { readFileSync } from "node:fs";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { catalogItemSchema, mediaUrlFor, type CatalogItem } from "../../src/features/exercises/catalog-schema";
import { normalize } from "../../src/features/exercises/search";

const DATA_PATH = path.join(process.cwd(), "prisma/seed/data/exercises.json");

export function loadCatalog(): CatalogItem[] {
  const raw = JSON.parse(readFileSync(DATA_PATH, "utf8")) as unknown[];
  return raw.map((x, i) => {
    const r = catalogItemSchema.safeParse(x);
    if (!r.success) throw new Error(`exercises.json #${i}: ${r.error.issues.map((is) => `${is.path.join(".")} ${is.message}`).join("; ")}`);
    return r.data;
  });
}

/** Upsert por slug. Si la fila existe con el slug temporal de la migración (`tmp-<id>`), la encuentra por nombre. */
export async function seedExercises(): Promise<number> {
  const catalog = loadCatalog();
  const muscleBySlug = new Map((await prisma.muscle.findMany()).map((m) => [m.slug, m]));
  const slugs = new Set<string>();

  for (const e of catalog) {
    if (slugs.has(e.slug)) throw new Error(`Slug de ejercicio duplicado: ${e.slug}`);
    slugs.add(e.slug);

    const data = {
      slug: e.slug,
      name: e.name,
      nameEn: e.nameEn,
      equipment: e.equipment,
      measureType: e.measureType,
      tracksWeight: e.tracksWeight,
      description: e.description.trim() || null,
      instructions: e.instructions.length ? { steps: e.instructions, reviewed: e.reviewed } : Prisma.DbNull,
      mediaUrl: mediaUrlFor(e.media),
    };

    const existing = await prisma.exercise.findFirst({
      where: { OR: [{ slug: e.slug }, { name: e.name, createdByUserId: null }] },
      select: { id: true },
    });
    const exercise = existing
      ? await prisma.exercise.update({ where: { id: existing.id }, data, select: { id: true } })
      : await prisma.exercise.create({ data, select: { id: true } });

    const aliases = [...new Map(e.aliases.map((a) => [normalize(a.alias), a.locale])).entries()]
      .filter(([alias]) => alias && alias !== normalize(e.name))
      .map(([alias, locale]) => ({ exerciseId: exercise.id, alias: alias.slice(0, 100), locale }));

    const muscles = e.muscles.map((m) => {
      const muscle = muscleBySlug.get(m.slug);
      if (!muscle) throw new Error(`No existe el músculo "${m.slug}" para el ejercicio "${e.name}"`);
      return { exerciseId: exercise.id, muscleId: muscle.id, percentage: m.percentage };
    });

    await prisma.$transaction([
      prisma.exerciseAlias.deleteMany({ where: { exerciseId: exercise.id } }),
      prisma.exerciseAlias.createMany({ data: aliases }),
      prisma.exerciseMuscle.deleteMany({ where: { exerciseId: exercise.id } }),
      prisma.exerciseMuscle.createMany({ data: muscles }),
    ]);
  }
  return catalog.length;
}
