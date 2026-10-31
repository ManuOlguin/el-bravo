import { prisma } from "./db";

type SeedCategory = { slug: string; name: string; sortOrder: number; usesExercises?: boolean };

// usesExercises: el formulario de entrenamiento muestra ejercicios y series.
const categories: SeedCategory[] = [
  { slug: "strength", name: "Fuerza", sortOrder: 1, usesExercises: true },
  { slug: "running", name: "Running", sortOrder: 2 },
  { slug: "trail_running", name: "Trail running", sortOrder: 3 },
  { slug: "cycling", name: "Ciclismo", sortOrder: 4 },
  { slug: "indoor_cycling", name: "Spinning", sortOrder: 5 },
  { slug: "swimming", name: "Natación", sortOrder: 6 },
  { slug: "walking_trekking", name: "Caminata / Trekking", sortOrder: 7 },
  { slug: "yoga_pilates", name: "Yoga / Pilates", sortOrder: 8 },
  { slug: "hiit_functional", name: "HIIT / Funcional", sortOrder: 9, usesExercises: true },
  { slug: "rowing", name: "Remo", sortOrder: 10 },
  { slug: "climbing", name: "Escalada", sortOrder: 11 },
  { slug: "martial_arts", name: "Artes marciales", sortOrder: 12 },
  { slug: "dance", name: "Danza", sortOrder: 13 },
  { slug: "elliptical", name: "Elíptico", sortOrder: 14 },
  { slug: "ski_snowboard", name: "Ski / Snowboard", sortOrder: 15 },
  { slug: "water_sports", name: "Deportes acuáticos", sortOrder: 16 },
  { slug: "calisthenics", name: "Calistenia", sortOrder: 17, usesExercises: true },
  { slug: "crossfit", name: "CrossFit", sortOrder: 18, usesExercises: true },
  { slug: "skating", name: "Patinaje", sortOrder: 19 },
];


export async function seedCategories(): Promise<number> {
  for (const c of categories) {
    const data = { name: c.name, sortOrder: c.sortOrder, isActive: true, usesExercises: c.usesExercises ?? false };
    await prisma.activityCategory.upsert({ where: { slug: c.slug }, update: data, create: { slug: c.slug, ...data } });
  }
  return categories.length;
}
