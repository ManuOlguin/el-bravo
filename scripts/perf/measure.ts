/**
 * Mide los tiempos de docs/perf.md sobre la DB de `seed-perf.ts`.
 *
 *   DATABASE_URL=…/elbravo_w3_perf npx tsx scripts/perf/measure.ts                 # solo funciones
 *   DATABASE_URL=…/elbravo_w3_perf PERF_BASE_URL=http://localhost:3032 npx tsx scripts/perf/measure.ts
 *
 * - `recomputeSeason` de cada temporada y `recomputeUserBadges` (1 vuelta de calentamiento + N medidas).
 * - Con PERF_BASE_URL: tiempo de respuesta completo (render en el servidor, body leído entero) de las
 *   páginas principales con la sesión de `perf0@perf.test` (cookie firmada con JWT_SECRET).
 */
import { config } from "dotenv";
import { performance } from "node:perf_hooks";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

const RUNS = Number(process.env.PERF_RUNS ?? 10);

function stats(samples: number[]) {
  const s = [...samples].sort((a, b) => a - b);
  const pct = (p: number) => s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
  return { median: pct(50), p90: pct(90), max: s[s.length - 1] };
}

async function time(fn: () => Promise<unknown>, runs = RUNS) {
  await fn(); // calentamiento (conexiones, JIT, caches del motor)
  const samples: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    await fn();
    samples.push(performance.now() - t0);
  }
  return stats(samples);
}

const fmt = (r: { median: number; p90: number; max: number }) =>
  `mediana ${r.median.toFixed(0)} ms · p90 ${r.p90.toFixed(0)} ms · máx ${r.max.toFixed(0)} ms`;

async function main() {
  const db = new URL(process.env.DATABASE_URL ?? "mysql://x/none").pathname.slice(1);
  if (!db.endsWith("_perf")) throw new Error(`measure corre contra una DB *_perf (DATABASE_URL apunta a ${db})`);
  const { prisma } = await import("@/src/lib/db");
  const { recomputeSeason } = await import("@/src/server/scoring/recompute");
  const { recomputeUserBadges } = await import("@/src/server/badges");

  const users = await prisma.user.findMany({ where: { email: { endsWith: "@perf.test" } }, orderBy: { email: "asc" }, select: { id: true, email: true } });
  const group = await prisma.group.findFirstOrThrow({ where: { name: "Perf", createdBy: users[0].id }, select: { id: true } });
  const seasons = await prisma.season.findMany({ where: { groupId: group.id }, orderBy: { startDate: "asc" }, select: { id: true, name: true, finalizedAt: true } });
  const activities = await prisma.activity.count({ where: { userId: { in: users.map((u) => u.id) } } });
  console.log(`Datos: ${users.length} usuarios · ${seasons.length} temporadas · ${activities} actividades · DB ${db}\n`);

  for (const s of seasons) {
    const n = await prisma.scoreEntry.count({ where: { seasonId: s.id } });
    if (s.finalizedAt) {
      // Finalizada: el recálculo normal no hace nada (congelada). `force` es el camino de "reabrir" y
      // el peor caso: 10 semanas completas.
      console.log(`recomputeSeason(${s.name}, finalizada, no-op): ${fmt(await time(() => recomputeSeason(s.id)))}`);
      console.log(`recomputeSeason(${s.name}, force, ${n} ScoreEntry): ${fmt(await time(() => recomputeSeason(s.id, { force: true })))}`);
    } else {
      console.log(`recomputeSeason(${s.name}, en curso, ${n} ScoreEntry): ${fmt(await time(() => recomputeSeason(s.id)))}`);
    }
  }
  console.log(`recomputeUserBadges(perf0): ${fmt(await time(() => recomputeUserBadges(users[0].id)))}`);

  const base = process.env.PERF_BASE_URL;
  if (base) {
    const { SignJWT } = await import("jose");
    const token = await new SignJWT({ email: users[0].email, ver: 0 })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(users[0].id)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(process.env.JWT_SECRET!));
    const cookie = `${process.env.JWT_COOKIE_NAME || "elbravo_token"}=${token}`;
    const [s1, , s3] = seasons;
    const pages: [string, string][] = [
      ["página de grupo", `/group/${group.id}`],
      ["temporada en curso", `/group/${group.id}/season/${s3.id}`],
      ["temporada finalizada (resultados)", `/group/${group.id}/season/${s1.id}`],
      ["home", "/home"],
      ["perfil propio", "/profile"],
      ["perfil ajeno", `/u/${users[1].id}`],
      ["stats", "/stats"],
    ];
    console.log("");
    for (const [name, path] of pages) {
      const r = await time(async () => {
        const res = await fetch(`${base}${path}`, { headers: { cookie }, redirect: "manual" });
        if (res.status !== 200) throw new Error(`${path}: HTTP ${res.status}`);
        await res.text();
      });
      console.log(`GET ${name} (${path.replace(/[a-z0-9]{20,}/g, ":id")}): ${fmt(r)}`);
    }
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
