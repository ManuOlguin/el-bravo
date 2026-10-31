/**
 * Completa la migración v1 → v2 en lo que el SQL de `v2_core` no puede hacer y recalcula todo.
 * Idempotente: se puede correr varias veces.
 *
 *   npx prisma migrate deploy && npx tsx scripts/migrate-v2-data.ts
 *
 * 1) Slugs definitivos para los ejercicios que quedaron con el temporal `tmp-<id>`.
 * 2) Recálculo total de temporadas e insignias (en la Ola 0 son stubs; W3 lo vuelve a correr
 *    cuando W1-1/W1-2 existen).
 */
import { config } from "dotenv";
import { slugify } from "../prisma/seed/slugify";

// .env.local (por worktree) tiene prioridad sobre .env; ninguno pisa variables ya definidas.
config({ path: ".env.local", quiet: true });
config({ quiet: true });

async function main() {
  // Imports dinámicos: `src/lib/db` lee DATABASE_URL al importarse, después de cargar el .env.
  const { prisma } = await import("@/src/lib/db");
  const { recomputeSeason } = await import("@/src/server/scoring");
  const { recomputeUserBadges } = await import("@/src/server/badges");
  try {
    // 1) slugs de ejercicios (únicos)
    const exercises = await prisma.exercise.findMany({ select: { id: true, name: true, slug: true }, orderBy: { name: "asc" } });
    const used = new Set(exercises.map((e) => e.slug).filter((s) => !s.startsWith("tmp-")));
    let fixed = 0;
    for (const e of exercises) {
      if (!e.slug.startsWith("tmp-")) continue;
      const base = slugify(e.name) || "ejercicio";
      let s = base;
      for (let i = 2; used.has(s); i++) s = `${base}-${i}`;
      used.add(s);
      await prisma.exercise.update({ where: { id: e.id }, data: { slug: s } });
      fixed++;
    }

    // 2) recálculo total
    const seasons = await prisma.season.findMany({ select: { id: true } });
    for (const { id } of seasons) await recomputeSeason(id);
    const users = await prisma.user.findMany({ select: { id: true } });
    for (const { id } of users) await recomputeUserBadges(id);

    console.log(`migrate-v2-data OK: ${fixed} slugs, ${seasons.length} temporadas, ${users.length} usuarios recalculados`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
