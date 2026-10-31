/**
 * Seed grande para medir performance (W3 Task 3, ver docs/perf.md). Corre contra una DB *_perf:
 *
 *   DATABASE_URL=mysql://…/elbravo_w3_perf npx tsx scripts/perf/seed-perf.ts
 *
 * 1 grupo · 10 usuarios · 3 temporadas consecutivas de 10 semanas (las 2 primeras terminadas y
 * finalizadas, la última en curso) · 200 actividades por usuario y temporada (6.000 en total).
 * Un tercio de las actividades son de fuerza con 3 ejercicios × 3 series (para insignias/stats).
 * Usuarios `perf0@perf.test` … `perf9@perf.test`, contraseña `perf1234` (solo datos sintéticos).
 * Determinista (PRNG con semilla fija) e idempotente: borra y recrea todo lo de los usuarios perf.
 */
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

const USERS = 10;
const ACTIVITIES_PER_SEASON = 200;
const SEASON_WEEKS = 10;

function prng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

async function main() {
  const db = new URL(process.env.DATABASE_URL ?? "mysql://x/none").pathname.slice(1);
  if (!db.endsWith("_perf")) throw new Error(`seed-perf solo corre contra una DB *_perf (DATABASE_URL apunta a ${db})`);

  const { prisma } = await import("@/src/lib/db");
  const { hashPassword } = await import("@/src/server/account/passwords");
  const { recomputeSeason, finalizeSeason } = await import("@/src/server/scoring/recompute");
  const { recomputeUserBadges } = await import("@/src/server/badges");
  const { DEFAULT_TZ, addDays, addWeeks, localDateOf, localDateToDbDate, weekKeyOfLocalDate, zonedToUtc } = await import("@/src/lib/time");

  const rand = prng(42);
  const tz = DEFAULT_TZ;
  const today = localDateOf(new Date(), tz);
  // La 3ª temporada está en curso (empezó hace 5 semanas); las otras dos terminaron antes.
  const s3Start = addWeeks(weekKeyOfLocalDate(today), -5);
  const starts = [addWeeks(s3Start, -2 * SEASON_WEEKS), addWeeks(s3Start, -SEASON_WEEKS), s3Start];

  const hash = await hashPassword("perf1234");
  const old = await prisma.user.findMany({ where: { email: { endsWith: "@perf.test" } }, select: { id: true } });
  await prisma.group.deleteMany({ where: { createdBy: { in: old.map((u) => u.id) } } });
  await prisma.user.deleteMany({ where: { id: { in: old.map((u) => u.id) } } });

  const users = [];
  for (let i = 0; i < USERS; i++) {
    users.push(await prisma.user.create({ data: { email: `perf${i}@perf.test`, name: `Perf ${i}`, passwordHash: hash, timezone: tz }, select: { id: true } }));
  }
  const ids = users.map((u) => u.id);
  await prisma.follow.createMany({ data: ids.flatMap((a) => ids.filter((b) => b !== a).map((b) => ({ followerId: a, followingId: b }))) });

  const categories = await prisma.activityCategory.findMany({ where: { isActive: true }, select: { id: true, slug: true } });
  const strength = categories.find((c) => c.slug === "strength")!;
  const others = categories.filter((c) => c.slug !== "strength");
  const exercises = await prisma.exercise.findMany({ where: { createdByUserId: null, measureType: "reps" }, select: { id: true }, take: 30 });

  const group = await prisma.group.create({
    data: {
      name: "Perf",
      timezone: tz,
      createdBy: ids[0],
      members: { create: ids.map((userId, i) => ({ userId, role: i === 0 ? ("admin" as const) : ("member" as const), status: "accepted" as const, acceptedAt: new Date() })) },
    },
  });

  const seasons = [];
  for (const [n, start] of starts.entries()) {
    const end = addDays(start, SEASON_WEEKS * 7 - 1);
    const season = await prisma.season.create({
      data: {
        groupId: group.id,
        name: `Perf ${n + 1}`,
        startDate: localDateToDbDate(start),
        endDate: localDateToDbDate(end),
        createdBy: ids[0],
        categories: { create: categories.map((c) => ({ activityCategoryId: c.id, weight: 1 })) },
        awards: { create: [{ awardType: "most_days" }, { awardType: "best_streak", bonusPoints: 10 }, { awardType: "most_minutes" }] },
        members: { create: ids.map((userId) => ({ userId })) },
      },
    });
    seasons.push({ id: season.id, start, end });

    const lastDay = end < today ? end : today;
    const days = Math.max(1, Math.round((Date.parse(lastDay) - Date.parse(start)) / 86_400_000) + 1);
    for (const userId of ids) {
      const rows = [];
      for (let k = 0; k < ACTIVITIES_PER_SEASON; k++) {
        const date = addDays(start, Math.floor(rand() * days));
        const hh = String(6 + Math.floor(rand() * 15)).padStart(2, "0");
        const mm = String(Math.floor(rand() * 60)).padStart(2, "0");
        const isStrength = rand() < 0.33;
        rows.push({
          userId,
          activityCategoryId: isStrength ? strength.id : others[Math.floor(rand() * others.length)].id,
          startedAt: zonedToUtc(date, `${hh}:${mm}`, tz),
          durationMinutes: 15 + Math.floor(rand() * 106),
          clientRequestId: `perf-${n}-${userId}-${k}`,
        });
      }
      await prisma.activity.createMany({ data: rows });
    }
    // Ejercicios y series para las de fuerza de esta temporada.
    const strengthActs = await prisma.activity.findMany({
      where: { userId: { in: ids }, activityCategoryId: strength.id, clientRequestId: { startsWith: `perf-${n}-` } },
      select: { id: true },
    });
    for (const a of strengthActs) {
      for (let p = 0; p < 3; p++) {
        await prisma.activityExercise.create({
          data: {
            activityId: a.id,
            exerciseId: exercises[Math.floor(rand() * exercises.length)].id,
            position: p,
            sets: { create: [0, 1, 2].map((position) => ({ position, reps: 8 + Math.floor(rand() * 5), weightKg: 20 + Math.floor(rand() * 80) })) },
          },
        });
      }
    }
  }

  for (const s of seasons) {
    await recomputeSeason(s.id);
    if (s.end < today) await finalizeSeason(s.id, { publish: true });
  }
  for (const userId of ids) await recomputeUserBadges(userId);

  const activities = await prisma.activity.count({ where: { userId: { in: ids } } });
  console.log(`seed-perf OK: grupo ${group.id}, temporadas ${seasons.map((s) => s.id).join(", ")}, ${activities} actividades`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
