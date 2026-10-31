/**
 * Seed determinista de los E2E (W3 Task 1). Corre con tsx contra la DB de E2E (`E2E_DATABASE_URL`, ver
 * `e2e/env.ts`), DESPUÉS de `prisma migrate deploy` y del seed base (`npm run seed`).
 *
 *   DATABASE_URL=<db e2e> npx tsx e2e/fixtures/seed-e2e.ts
 *
 * - Usuarios con contraseñas de test generadas al azar en cada corrida, guardadas en
 *   `e2e/.auth/credentials.json` (ignorado por git). Cada spec usa sus propios usuarios para no
 *   pisarse con los demás.
 * - "Bravos E2E": grupo con una temporada activa (empezó el lunes de hace 2 semanas) y entrenamientos
 *   de Ana/Beto/Caro en las semanas pasadas, para que home, grupo, perfil y stats tengan datos.
 * - "Temporadas E2E": grupo sin temporadas ni entrenamientos (Sara admin, Nico miembro): el spec de
 *   temporadas crea la suya y verifica los puntos exactos.
 * - "Social E2E": grupo sin entrenamientos (para "fue el primero en arrancar la semana").
 * - Una rutina para Ana.
 */
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const TZ = "America/Argentina/Buenos_Aires";

export const E2E_USERS = {
  ana: "Ana E2E",
  beto: "Beto E2E",
  caro: "Caro E2E",
  lucas: "Lucas E2E",
  rita: "Rita E2E",
  sofi: "Sofi E2E",
  tomi: "Tomi E2E",
  olga: "Olga E2E",
  sara: "Sara E2E",
  nico: "Nico E2E",
  lock: "Lock E2E",
  pass: "Pass E2E",
} as const;
export type E2EUserKey = keyof typeof E2E_USERS;

export type E2ECredentials = {
  users: Record<E2EUserKey, { id: string; email: string; name: string; password: string }>;
  groups: {
    bravos: { id: string; seasonId: string };
    temporadas: { id: string };
    social: { id: string };
  };
  routines: { anaPush: string };
};

async function main() {
  const { prisma } = await import("@/src/lib/db");
  const { hashPassword } = await import("@/src/server/account/passwords");
  const { recomputeSeason } = await import("@/src/server/scoring/recompute");
  const { recomputeUserBadges } = await import("@/src/server/badges");
  const { addDays, addWeeks, localDateOf, localDateToDbDate, weekKeyOfLocalDate, zonedToUtc } = await import("@/src/lib/time");

  const dbName = new URL(process.env.DATABASE_URL ?? "mysql://x/none").pathname.slice(1);
  if (!dbName.endsWith("_e2e")) throw new Error(`seed-e2e solo corre contra una DB *_e2e (DATABASE_URL apunta a ${dbName})`);

  const users = {} as E2ECredentials["users"];
  for (const [key, name] of Object.entries(E2E_USERS) as [E2EUserKey, string][]) {
    const password = `e2e-${randomBytes(9).toString("base64url")}`;
    const email = `${key}@e2e.test`;
    const u = await prisma.user.create({
      data: { email, name, passwordHash: await hashPassword(password), timezone: TZ, weeklyGoal: 3 },
      select: { id: true },
    });
    users[key] = { id: u.id, email, name, password };
  }

  const categories = await prisma.activityCategory.findMany({ where: { isActive: true }, select: { id: true, slug: true } });
  const cat = (slug: string) => {
    const c = categories.find((x) => x.slug === slug);
    if (!c) throw new Error(`Falta la categoría ${slug} (¿corriste npm run seed?)`);
    return c.id;
  };

  const today = localDateOf(new Date(), TZ);
  const thisWeek = weekKeyOfLocalDate(today);
  const seasonStart = addWeeks(thisWeek, -2);

  const member = (userId: string, role: "admin" | "member") => ({ userId, role, status: "accepted" as const, acceptedAt: new Date() });

  // --- Bravos E2E: temporada activa con datos ---
  const bravos = await prisma.group.create({
    data: {
      name: "Bravos E2E",
      description: "Grupo de los E2E.",
      timezone: TZ,
      createdBy: users.ana.id,
      members: {
        create: [member(users.ana.id, "admin"), member(users.beto.id, "member"), member(users.caro.id, "member"), member(users.lucas.id, "member")],
      },
    },
  });
  const season = await prisma.season.create({
    data: {
      groupId: bravos.id,
      name: "Temporada E2E",
      startDate: localDateToDbDate(seasonStart),
      endDate: localDateToDbDate(addDays(seasonStart, 55)),
      weeklyGoal: 3,
      resultsReveal: "auto",
      createdBy: users.ana.id,
      categories: { create: categories.map((c) => ({ activityCategoryId: c.id, weight: 1 })) },
      awards: { create: [{ awardType: "most_days", bonusPoints: 0 }, { awardType: "best_streak", bonusPoints: 10 }] },
      members: { create: [users.ana.id, users.beto.id, users.caro.id, users.lucas.id].map((userId) => ({ userId })) },
    },
  });

  // Entrenamientos solo en las 2 semanas pasadas (la semana en curso queda libre para los specs).
  const plan: [user: E2EUserKey, week: number, day: number, time: string, minutes: number, slug: string][] = [
    ["ana", 0, 0, "07:30", 45, "strength"],
    ["ana", 0, 2, "19:00", 60, "running"],
    ["ana", 0, 4, "07:30", 30, "strength"],
    ["ana", 1, 0, "07:30", 45, "strength"],
    ["ana", 1, 3, "19:00", 40, "running"],
    ["beto", 0, 1, "18:00", 120, "cycling"],
    ["beto", 1, 5, "10:00", 90, "strength"],
    ["caro", 0, 0, "08:00", 30, "yoga_pilates"],
    ["caro", 1, 2, "08:00", 45, "hiit_functional"],
  ];
  for (const [u, w, d, time, minutes, slug] of plan) {
    await prisma.activity.create({
      data: {
        userId: users[u].id,
        activityCategoryId: cat(slug),
        startedAt: zonedToUtc(addDays(addWeeks(seasonStart, w), d), time, TZ),
        durationMinutes: minutes,
      },
    });
  }
  await recomputeSeason(season.id);
  for (const u of ["ana", "beto", "caro"] as const) await recomputeUserBadges(users[u].id);

  // Ana y Beto se siguen (amigos).
  await prisma.follow.createMany({
    data: [
      { followerId: users.ana.id, followingId: users.beto.id },
      { followerId: users.beto.id, followingId: users.ana.id },
    ],
  });

  // --- Temporadas E2E: sin temporadas ---
  const temporadas = await prisma.group.create({
    data: {
      name: "Temporadas E2E",
      timezone: TZ,
      createdBy: users.sara.id,
      members: { create: [member(users.sara.id, "admin"), member(users.nico.id, "member")] },
    },
  });

  // --- Social E2E: sin entrenamientos ---
  const social = await prisma.group.create({
    data: {
      name: "Social E2E",
      timezone: TZ,
      createdBy: users.sofi.id,
      members: { create: [member(users.sofi.id, "admin"), member(users.tomi.id, "member")] },
    },
  });

  // --- Rutina de Ana ---
  const bench = await prisma.exercise.findFirstOrThrow({ where: { name: "Press de Banca" }, select: { id: true } });
  const squat = await prisma.exercise.findFirstOrThrow({ where: { name: "Sentadillas" }, select: { id: true } });
  const routine = await prisma.routine.create({
    data: {
      name: "Empuje E2E",
      userId: users.ana.id,
      exercises: {
        create: [
          {
            exerciseId: bench.id,
            position: 0,
            restSeconds: 90,
            sets: { create: [0, 1, 2].map((position) => ({ position, targetReps: 8, targetWeightKg: 60 })) },
          },
          {
            exerciseId: squat.id,
            position: 1,
            restSeconds: 120,
            sets: { create: [0, 1].map((position) => ({ position, targetReps: 10, targetWeightKg: 80 })) },
          },
        ],
      },
    },
  });

  const creds: E2ECredentials = {
    users,
    groups: { bravos: { id: bravos.id, seasonId: season.id }, temporadas: { id: temporadas.id }, social: { id: social.id } },
    routines: { anaPush: routine.id },
  };
  const out = path.join(__dirname, "..", ".auth", "credentials.json");
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(creds, null, 2) + "\n", { mode: 0o600 });
  console.log(`seed-e2e OK: ${Object.keys(users).length} usuarios, 3 grupos, temporada ${season.id} → ${out}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
