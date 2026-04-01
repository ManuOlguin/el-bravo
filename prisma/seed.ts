import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("Missing DATABASE_URL in environment variables");
}

const adapter = new PrismaMariaDb(databaseUrl);
const prisma = new PrismaClient({ adapter });

type SeedMuscle = {
  name: string;
  slug: string;
  groupKey: string;
};

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

const exerciseMappings: Record<
  string,
  { muscleSlug: string; percentage: number }[]
> = {
  Abdominales: [
    { muscleSlug: "abdominales", percentage: 80 },
    { muscleSlug: "oblicuos", percentage: 20 },
  ],
  "Curl de Bíceps": [
    { muscleSlug: "biceps", percentage: 85 },
    { muscleSlug: "antebrazo", percentage: 15 },
  ],
  "Curl Inverso": [
    { muscleSlug: "antebrazo", percentage: 70 },
    { muscleSlug: "biceps", percentage: 30 },
  ],
  Lagartijas: [
    { muscleSlug: "pecho", percentage: 55 },
    { muscleSlug: "triceps", percentage: 25 },
    { muscleSlug: "hombros", percentage: 20 },
  ],
  "Press de Banca": [
    { muscleSlug: "pecho", percentage: 70 },
    { muscleSlug: "triceps", percentage: 20 },
    { muscleSlug: "hombros", percentage: 10 },
  ],
  Sentadillas: [
    { muscleSlug: "cuadriceps", percentage: 45 },
    { muscleSlug: "gluteos", percentage: 25 },
    { muscleSlug: "isquiotibiales", percentage: 15 },
    { muscleSlug: "aductores", percentage: 10 },
    { muscleSlug: "abdominales", percentage: 5 },
  ],
};

async function upsertMuscles() {
  for (const muscle of muscles) {
    await prisma.muscle.upsert({
      where: { slug: muscle.slug },
      update: {
        name: muscle.name,
        slug: muscle.slug,
        groupKey: muscle.groupKey,
      },
      create: {
        name: muscle.name,
        slug: muscle.slug,
        groupKey: muscle.groupKey,
      },
    });
  }
}

async function syncExerciseMuscles() {
  const allMuscles = await prisma.muscle.findMany();

  const muscleBySlug = new Map(
    allMuscles.map((m) => [m.slug, m])
  );

  for (const [exerciseName, mapping] of Object.entries(exerciseMappings)) {
    const exercise = await prisma.exercise.findUnique({
      where: { name: exerciseName },
    });

    if (!exercise) {
      console.warn(`⚠️ Ejercicio no encontrado: ${exerciseName}`);
      continue;
    }

    const total = mapping.reduce((sum, item) => sum + item.percentage, 0);

    if (total !== 100) {
      throw new Error(
        `El ejercicio "${exerciseName}" no suma 100. Total actual: ${total}`
      );
    }

    await prisma.exerciseMuscle.deleteMany({
      where: { exerciseId: exercise.id },
    });

    for (const item of mapping) {
      const muscle = muscleBySlug.get(item.muscleSlug);

      if (!muscle) {
        throw new Error(
          `No existe el músculo con slug "${item.muscleSlug}" para el ejercicio "${exerciseName}"`
        );
      }

      await prisma.exerciseMuscle.create({
        data: {
          exerciseId: exercise.id,
          muscleId: muscle.id,
          percentage: item.percentage,
        },
      });
    }
  }
}

async function main() {
  console.log("🌱 Seeding muscles...");
  await upsertMuscles();

  console.log("🌱 Seeding exercise-muscle mappings...");
  await syncExerciseMuscles();

  console.log("✅ Seed completado");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });