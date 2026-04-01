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

const awardDefinitions = [
  // =========================
  // EL PERSISTENTE
  // Racha de semanas consecutivas con al menos 1 gym
  // =========================
  {
    code: "EL_PERSISTENTE_L1",
    name: "El Persistente I",
    description: "Metiste al menos 1 entrenamiento de gym por semana durante 3 semanas consecutivas.",
    scope: "profile",
    pointsBonus: 0,
    iconKey: "el-persistente",
    category: "consistency",
    level: 1,
    criteria: {
      kind: "activity_type_week_streak",
      activityType: "gym",
      minPerWeek: 1,
      target: 3,
    },
  },
  {
    code: "EL_PERSISTENTE_L2",
    name: "El Persistente II",
    description: "Metiste al menos 1 entrenamiento de gym por semana durante 5 semanas consecutivas.",
    scope: "profile",
    pointsBonus: 0,
    iconKey: "el-persistente",
    category: "consistency",
    level: 2,
    criteria: {
      kind: "activity_type_week_streak",
      activityType: "gym",
      minPerWeek: 1,
      target: 5,
    },
  },
  {
    code: "EL_PERSISTENTE_L3",
    name: "El Persistente III",
    description: "Metiste al menos 1 entrenamiento de gym por semana durante 8 semanas consecutivas.",
    scope: "profile",
    pointsBonus: 0,
    iconKey: "el-persistente",
    category: "consistency",
    level: 3,
    criteria: {
      kind: "activity_type_week_streak",
      activityType: "gym",
      minPerWeek: 1,
      target: 8,
    },
  },

  // =========================
  // GYM RAT
  // Racha de semanas perfectas
  // =========================
  {
    code: "GYM_RAT_L1",
    name: "Gym Rat I",
    description: "Lograste una racha de 3 semanas perfectas consecutivas.",
    scope: "profile",
    pointsBonus: 0,
    iconKey: "gym-rat",
    category: "consistency",
    level: 1,
    criteria: {
      kind: "perfect_week_streak",
      target: 3,
    },
  },
  {
    code: "GYM_RAT_L2",
    name: "Gym Rat II",
    description: "Lograste una racha de 5 semanas perfectas consecutivas.",
    scope: "profile",
    pointsBonus: 0,
    iconKey: "gym-rat",
    category: "consistency",
    level: 2,
    criteria: {
      kind: "perfect_week_streak",
      target: 5,
    },
  },
  {
    code: "GYM_RAT_L3",
    name: "Gym Rat III",
    description: "Lograste una racha de 8 semanas perfectas consecutivas.",
    scope: "profile",
    pointsBonus: 0,
    iconKey: "gym-rat",
    category: "consistency",
    level: 3,
    criteria: {
      kind: "perfect_week_streak",
      target: 8,
    },
  },

  // =========================
  // IMPARABLE
  // 3 fines de semana seguidos entrenando
  // =========================
  {
    code: "IMPARABLE_L1",
    name: "Imparable",
    description: "Entrenaste durante 3 fines de semana consecutivos.",
    scope: "profile",
    pointsBonus: 0,
    iconKey: "imparable",
    category: "consistency",
    level: 1,
    criteria: {
      kind: "weekend_activity_streak",
      target: 3,
    },
  },

  // =========================
  // CORRE FORREST
  // Semanas consecutivas con al menos un run
  // =========================
  {
    code: "CORRE_FORREST_L1",
    name: "Corre Forrest I",
    description: "Metiste al menos un entrenamiento de running por semana durante 3 semanas consecutivas.",
    scope: "profile",
    pointsBonus: 0,
    iconKey: "corre-forrest",
    category: "running",
    level: 1,
    criteria: {
      kind: "activity_type_week_streak",
      activityType: "run",
      minPerWeek: 1,
      target: 3,
    },
  },
  {
    code: "CORRE_FORREST_L2",
    name: "Corre Forrest II",
    description: "Metiste al menos un entrenamiento de running por semana durante 5 semanas consecutivas.",
    scope: "profile",
    pointsBonus: 0,
    iconKey: "corre-forrest",
    category: "running",
    level: 2,
    criteria: {
      kind: "activity_type_week_streak",
      activityType: "run",
      minPerWeek: 1,
      target: 5,
    },
  },
  {
    code: "CORRE_FORREST_L3",
    name: "Corre Forrest III",
    description: "Metiste al menos un entrenamiento de running por semana durante 8 semanas consecutivas.",
    scope: "profile",
    pointsBonus: 0,
    iconKey: "corre-forrest",
    category: "running",
    level: 3,
    criteria: {
      kind: "activity_type_week_streak",
      activityType: "run",
      minPerWeek: 1,
      target: 8,
    },
  },

  // =========================
  // EL PIERNAS
  // 8 entrenamientos con piernas en 30 días
  // =========================
  {
    code: "EL_PIERNAS_L1",
    name: "El Piernas",
    description: "Hiciste al menos 8 entrenamientos con piernas involucradas en una ventana de 30 días.",
    scope: "profile",
    pointsBonus: 0,
    iconKey: "el-piernas",
    category: "muscle",
    level: 1,
    criteria: {
      kind: "muscle_group_activities_rolling_days",
      muscleGroup: "legs",
      target: 8,
      daysWindow: 30,
    },
  },

  // =========================
  // SIX PACK
  // 8 entrenamientos con core en 30 días
  // =========================
  {
    code: "SIX_PACK_L1",
    name: "Six Pack",
    description: "Hiciste al menos 8 entrenamientos con abdominales o core involucrado en una ventana de 30 días.",
    scope: "profile",
    pointsBonus: 0,
    iconKey: "six-pack",
    category: "muscle",
    level: 1,
    criteria: {
      kind: "muscle_group_activities_rolling_days",
      muscleGroup: "core",
      target: 8,
      daysWindow: 30,
    },
  },

  // =========================
  // TODOTERRENO
  // 4 tipos distintos de actividad en una temporada
  // =========================
  {
    code: "TODOTERRENO_L1",
    name: "Todoterreno",
    description: "Entrenaste 4 tipos distintos de actividad a lo largo de una misma temporada.",
    scope: "season",
    pointsBonus: 0,
    iconKey: "todoterreno",
    category: "variety",
    level: 1,
    criteria: {
      kind: "distinct_activity_types_in_season",
      target: 4,
      allowedTypes: ["gym", "run", "sport", "mobility", "other"],
    },
  },
] as const;

async function upsertAwardDefinitions() {
  for (const award of awardDefinitions) {
    await prisma.awardDefinition.upsert({
      where: { code: award.code },
      update: {
        name: award.name,
        description: award.description,
        scope: award.scope,
        pointsBonus: award.pointsBonus,
        iconKey: award.iconKey,
        category: award.category,
        level: award.level,
        criteria: award.criteria,
        isActive: true,
      },
      create: {
        code: award.code,
        name: award.name,
        description: award.description,
        scope: award.scope,
        pointsBonus: award.pointsBonus,
        iconKey: award.iconKey,
        category: award.category,
        level: award.level,
        criteria: award.criteria,
        isActive: true,
      },
    });
  }
}

async function main() {
  console.log("🌱 Seeding muscles...");
  await upsertMuscles();

  console.log("🌱 Seeding exercise-muscle mappings...");
  await syncExerciseMuscles();

  console.log("✅ Seed completado");
  await upsertAwardDefinitions();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });