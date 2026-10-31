import { prisma } from "./db";

type SeedMuscle = { name: string; slug: string; groupKey: string };

const muscles: SeedMuscle[] = [
  { name: "Abdominales", slug: "abdominales", groupKey: "core" },
  { name: "Oblicuos", slug: "oblicuos", groupKey: "core" },
  { name: "Lumbar", slug: "lumbar", groupKey: "core" },

  { name: "Cuádriceps", slug: "cuadriceps", groupKey: "legs" },
  { name: "Isquiotibiales", slug: "isquiotibiales", groupKey: "legs" },
  { name: "Glúteos", slug: "gluteos", groupKey: "legs" },
  { name: "Aductores", slug: "aductores", groupKey: "legs" },
  { name: "Gemelos", slug: "gemelos", groupKey: "legs" },

  { name: "Pecho", slug: "pecho", groupKey: "chest" },
  { name: "Hombros", slug: "hombros", groupKey: "shoulders" },
  { name: "Tríceps", slug: "triceps", groupKey: "arms" },
  { name: "Bíceps", slug: "biceps", groupKey: "arms" },
  { name: "Antebrazo", slug: "antebrazo", groupKey: "arms" },

  { name: "Espalda", slug: "espalda", groupKey: "back" },
  { name: "Trapecio", slug: "trapecio", groupKey: "back" },
];

export async function seedMuscles(): Promise<number> {
  for (const m of muscles) {
    await prisma.muscle.upsert({
      where: { slug: m.slug },
      update: { name: m.name, groupKey: m.groupKey },
      create: { name: m.name, slug: m.slug, groupKey: m.groupKey },
    });
  }
  return muscles.length;
}
