/**
 * Herramienta de desarrollo (W1-2): carga o borra entrenamientos de un usuario por el camino real
 * (`createActivity` / `deleteActivity`), así se disparan los efectos (puntos, insignias, notificaciones).
 *
 *   npx tsx --conditions=react-server scripts/dev/create-workouts.ts <email> <n> [categorySlug]
 *   npx tsx --conditions=react-server scripts/dev/create-workouts.ts <email> --delete-last
 *
 * `--conditions=react-server` hace falta porque el servicio de actividades importa "server-only".
 * Crea `n` entrenamientos de 45 min a las 18:00 locales, uno por día hacia atrás desde hoy.
 */
import { config } from "dotenv";
import { randomUUID } from "node:crypto";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

async function main() {
  const [email, arg, categorySlug = "strength"] = process.argv.slice(2);
  if (!email || !arg) {
    console.error("Uso: npx tsx --conditions=react-server scripts/dev/create-workouts.ts <email> <n|--delete-last> [categorySlug]");
    process.exit(1);
  }

  // Imports dinámicos: `src/lib/db` lee DATABASE_URL al importarse, después de cargar el .env.
  const { prisma } = await import("@/src/lib/db");
  const { createActivity, deleteActivity } = await import("@/src/server/activities/service");
  const { addDays, localDateOf } = await import("@/src/lib/time");
  type BadgeChange = import("@/src/server/badges").BadgeChange;

  const printChanges = (badges: BadgeChange[]) => {
    for (const b of badges) {
      console.log(`  ${b.name}: nivel ${b.levelBefore}→${b.levelAfter}, progreso ${b.progressBefore}→${b.progressAfter}`);
    }
  };

  try {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, timezone: true } });
    if (!user) throw new Error(`No existe el usuario ${email}`);

    if (arg === "--delete-last") {
      const last = await prisma.activity.findFirst({ where: { userId: user.id }, orderBy: { startedAt: "desc" }, select: { id: true } });
      if (!last) throw new Error("El usuario no tiene actividades");
      const { effects } = await deleteActivity(user.id, last.id);
      console.log(`Borrada ${last.id}. Insignias que cambiaron:`);
      printChanges(effects.badges);
      return;
    }

    const n = Number(arg);
    if (!Number.isInteger(n) || n < 1 || n > 500) throw new Error("n tiene que ser un entero entre 1 y 500");
    const category = await prisma.activityCategory.findUnique({ where: { slug: categorySlug }, select: { id: true } });
    if (!category) throw new Error(`No existe la categoría ${categorySlug} (¿corriste npm run seed?)`);

    const today = localDateOf(new Date(), user.timezone);
    for (let i = 0; i < n; i++) {
      const { activityId, effects } = await createActivity(user.id, {
        clientRequestId: `dev-${randomUUID()}`,
        activityCategoryId: category.id,
        localDate: addDays(today, -(i + 1)),
        localTime: "18:00",
        durationMinutes: 45,
        exercises: [],
      });
      console.log(`Creada ${activityId}`);
      printChanges(effects.badges);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  if (e instanceof Error && e.message.includes("server-only")) {
    console.error("Falta el flag: npx tsx --conditions=react-server scripts/dev/create-workouts.ts …");
  }
  console.error(e);
  process.exit(1);
});
