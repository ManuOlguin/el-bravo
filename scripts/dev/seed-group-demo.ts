/**
 * Herramienta de desarrollo (W2-2): arma un grupo de demo para probar la página de grupo y las temporadas.
 *
 *   npx tsx scripts/dev/seed-group-demo.ts [--reveal manual] [--ended]
 *
 * - 3 usuarios (contraseña `demo1234`): ana@demo.test (admin), beto@demo.test, caro@demo.test. Se siguen entre sí.
 * - 1 grupo "Bravos Demo" con una temporada activa que empezó el lunes de hace 2 semanas (4 semanas de largo).
 * - 3 semanas de entrenamientos variados (hasta hoy), cargados directo en la DB y recalculados con `recomputeSeason`.
 * - `--ended`: corre la temporada para que haya terminado ayer (prueba del final de temporada).
 * - `--reveal manual`: la temporada publica resultados a mano.
 * Es idempotente: borra y vuelve a crear todo lo de los usuarios demo.
 */
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

const PASSWORD = "demo1234";
const USERS = [
  { email: "ana@demo.test", name: "Ana Demo" },
  { email: "beto@demo.test", name: "Beto Demo" },
  { email: "caro@demo.test", name: "Caro Demo" },
] as const;

/** Entrenamientos por usuario: [semana (0..2), día (0 = lunes), hora, minutos, slug de categoría]. */
type Plan = [week: number, day: number, time: string, minutes: number, slug: string][];
const PLANS: Record<(typeof USERS)[number]["email"], Plan> = {
  // Constante: 3 días por semana (45 min fuerza, 1 h running, 30 min fuerza).
  "ana@demo.test": [0, 1, 2].flatMap((w): Plan => [
    [w, 0, "07:30", 45, "strength"],
    [w, 2, "19:00", 60, "running"],
    [w, 4, "07:30", 30, "strength"],
  ]),
  // Pocos días pero largos: 2 h de bici y un sábado con fuerza + running el mismo día (se suman).
  "beto@demo.test": [0, 1, 2].flatMap((w): Plan => [
    [w, 1, "18:00", 120, "cycling"],
    [w, 5, "10:00", 90, "strength"],
    [w, 5, "12:00", 30, "running"],
  ]),
  // Irregular: semana 1 a full, semana 2 floja (un día corto que no llega al mínimo), semana 3 repunta.
  "caro@demo.test": [
    [0, 0, "08:00", 30, "yoga_pilates"],
    [0, 1, "08:00", 30, "yoga_pilates"],
    [0, 3, "08:00", 30, "hiit_functional"],
    [0, 6, "11:00", 45, "swimming"],
    [1, 2, "20:00", 15, "hiit_functional"],
    [2, 0, "08:00", 45, "hiit_functional"],
    [2, 2, "08:00", 45, "yoga_pilates"],
    [2, 4, "08:00", 45, "swimming"],
  ],
};

/**
 * Rutinas de fuerza que se alternan en los entrenamientos de "strength" (para que /stats tenga
 * minutos por músculo y récords): [slug del ejercicio, series, reps, kg inicial]. El peso sube 2,5 kg por semana.
 */
const STRENGTH_ROUTINES: [slug: string, sets: number, reps: number, kg: number][][] = [
  [
    ["press-de-banca", 4, 8, 50],
    ["sentadillas", 4, 8, 70],
    ["remo-con-barra", 3, 10, 45],
  ],
  [
    ["press-militar", 3, 8, 30],
    ["peso-muerto", 3, 5, 90],
    ["dominadas", 3, 8, 0],
    ["plancha", 3, 1, 0],
  ],
];

async function main() {
  const args = process.argv.slice(2);
  const ended = args.includes("--ended");
  const manual = args.includes("--reveal") && args[args.indexOf("--reveal") + 1] === "manual";

  const { prisma } = await import("@/src/lib/db");
  const { hashPassword } = await import("@/src/server/account/passwords");
  const { recomputeSeason } = await import("@/src/server/scoring/recompute");
  const { getSeasonStandings } = await import("@/src/server/scoring/queries");
  const { DEFAULT_TZ, addDays, addWeeks, localDateOf, localDateToDbDate, weekKeyOfLocalDate, zonedToUtc } = await import("@/src/lib/time");

  const tz = DEFAULT_TZ;
  const today = localDateOf(new Date(), tz);
  // Activa: empezó el lunes de hace 2 semanas. Terminada: las 3 semanas quedan atrás y terminó ayer.
  const start = ended ? addWeeks(weekKeyOfLocalDate(addDays(today, -1)), -2) : addWeeks(weekKeyOfLocalDate(today), -2);
  const end = ended ? addDays(today, -1) : addDays(start, 27);
  const lastDay = ended ? end : today;

  const hash = await hashPassword(PASSWORD);
  const users = [];
  for (const u of USERS) {
    users.push(
      await prisma.user.upsert({
        where: { email: u.email },
        update: { name: u.name, passwordHash: hash, isActive: true, timezone: tz },
        create: { email: u.email, name: u.name, passwordHash: hash, timezone: tz },
      })
    );
  }
  const ids = users.map((u) => u.id);

  // Limpieza idempotente.
  await prisma.activity.deleteMany({ where: { userId: { in: ids } } });
  await prisma.routine.deleteMany({ where: { userId: { in: ids } } });
  await prisma.group.deleteMany({ where: { createdBy: { in: ids } } });
  await prisma.follow.deleteMany({ where: { followerId: { in: ids } } });
  await prisma.follow.createMany({
    data: ids.flatMap((a) => ids.filter((b) => b !== a).map((b) => ({ followerId: a, followingId: b }))),
  });

  const categories = await prisma.activityCategory.findMany({ where: { isActive: true }, select: { id: true, slug: true } });
  const bySlug = new Map(categories.map((c) => [c.slug, c.id]));
  const exerciseSlugs = [...new Set(STRENGTH_ROUTINES.flat().map(([slug]) => slug))];
  const exercises = await prisma.exercise.findMany({ where: { slug: { in: exerciseSlugs } }, select: { id: true, slug: true } });
  const exerciseBySlug = new Map(exercises.map((e) => [e.slug, e.id]));

  const [ana] = users;
  const group = await prisma.group.create({
    data: {
      name: "Bravos Demo",
      description: "Grupo de prueba (scripts/dev/seed-group-demo.ts).",
      timezone: tz,
      createdBy: ana.id,
      members: {
        create: users.map((u, i) => ({ userId: u.id, role: i === 0 ? ("admin" as const) : ("member" as const), status: "accepted" as const, acceptedAt: new Date() })),
      },
    },
  });
  const season = await prisma.season.create({
    data: {
      groupId: group.id,
      name: ended ? "Temporada demo (terminada)" : "Temporada demo",
      startDate: localDateToDbDate(start),
      endDate: localDateToDbDate(end),
      weeklyGoal: 3,
      resultsReveal: manual ? "manual" : "auto",
      createdBy: ana.id,
      categories: { create: categories.map((c) => ({ activityCategoryId: c.id, weight: 1 })) },
      awards: { create: [{ awardType: "most_days", bonusPoints: 0 }, { awardType: "best_streak", bonusPoints: 10 }, { awardType: "longest_session", bonusPoints: 0 }] },
      members: { create: ids.map((userId) => ({ userId })) },
    },
  });

  // Ana tiene las dos rutinas de fuerza guardadas, para probar "Desde una rutina" y el modo en vivo.
  const routineNames = ["Pecho, piernas y espalda", "Hombros y peso muerto"];
  for (const [i, routine] of STRENGTH_ROUTINES.entries()) {
    await prisma.routine.create({
      data: {
        userId: ana.id,
        name: routineNames[i],
        exercises: {
          create: routine
            .filter(([exSlug]) => exerciseBySlug.has(exSlug))
            .map(([exSlug, sets, reps, kg], position) => ({
              exerciseId: exerciseBySlug.get(exSlug)!,
              position,
              restSeconds: 90,
              sets: {
                create: Array.from({ length: sets }, (_, j) =>
                  exSlug === "plancha"
                    ? { position: j, targetDurationSeconds: 60 }
                    : { position: j, targetReps: reps, targetWeightKg: kg > 0 ? kg + 5 : null }
                ),
              },
            })),
        },
      },
    });
  }

  let created = 0;
  for (const u of users) {
    let strengthCount = 0;
    for (const [w, d, time, minutes, slug] of PLANS[u.email as keyof typeof PLANS]) {
      const date = addDays(addWeeks(start, w), d);
      if (date > lastDay) continue;
      const categoryId = bySlug.get(slug);
      if (!categoryId) throw new Error(`Falta la categoría ${slug} (¿corriste el seed?)`);
      const routine = slug === "strength" ? STRENGTH_ROUTINES[strengthCount++ % STRENGTH_ROUTINES.length] : [];
      await prisma.activity.create({
        data: {
          userId: u.id,
          activityCategoryId: categoryId,
          startedAt: zonedToUtc(date, time, tz),
          durationMinutes: minutes,
          notes: "demo",
          exercises: {
            create: routine
              .filter(([exSlug]) => exerciseBySlug.has(exSlug))
              .map(([exSlug, sets, reps, kg], position) => ({
                exerciseId: exerciseBySlug.get(exSlug)!,
                position,
                sets: {
                  create: Array.from({ length: sets }, (_, i) =>
                    exSlug === "plancha"
                      ? { position: i, durationSeconds: 45 + 15 * w, completed: true }
                      : { position: i, reps, weightKg: kg > 0 ? kg + 2.5 * w : null, completed: true }
                  ),
                },
              })),
          },
        },
      });
      created++;
    }
  }
  await recomputeSeason(season.id);

  console.log(`Grupo ${group.id} · temporada ${season.id} (${start} → ${end}, ${manual ? "manual" : "auto"}) · ${created} entrenamientos`);
  for (const s of await getSeasonStandings(season.id)) {
    console.log(`  ${s.rank}. ${s.name}: ${s.points} pts · ${s.daysTrained} días · ${s.weeksGoalMet} semanas · racha ${s.currentStreak}`);
  }
  console.log(`Entrá con ana@demo.test / ${PASSWORD} → /group/${group.id}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
