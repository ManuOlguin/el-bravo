/**
 * Seed idempotente (upsert por slug/code): `npm run seed`.
 * Orden: categorías → músculos → ejercicios (+ mapeo muscular) → insignias.
 */
import { prisma } from "./db";
import { seedCategories } from "./categories";
import { seedMuscles } from "./muscles";
import { seedExercises } from "./exercises";
import { seedBadges } from "./badges";

async function main() {
  const categories = await seedCategories();
  const muscles = await seedMuscles();
  const exercises = await seedExercises();
  const badges = await seedBadges();
  const [dbCategories, dbMuscles, dbExercises, dbBadges] = await Promise.all([
    prisma.activityCategory.count(),
    prisma.muscle.count(),
    prisma.exercise.count({ where: { createdByUserId: null } }),
    prisma.badge.count(),
  ]);
  console.log(
    `Seed OK — categorías ${categories} (DB ${dbCategories}) · músculos ${muscles} (DB ${dbMuscles}) · ` +
      `ejercicios ${exercises} (DB ${dbExercises}) · insignias ${badges} (DB ${dbBadges})`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
