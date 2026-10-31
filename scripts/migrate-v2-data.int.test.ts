/**
 * Prueba de punta a punta de la migración v1 → v2 con el fixture `scripts/fixtures/v1-sample.sql`:
 * 1. DB descartable (`<db de test>_v2mig_test`, para no pisar la DB de test que usan los otros archivos).
 * 2. Migraciones v1 (hasta `sync_schema_drift`) con `prisma migrate deploy` sobre una copia de esas carpetas.
 * 3. Fixture v1.
 * 4. `prisma migrate deploy` con las migraciones reales (aplica `v2_core`).
 * 5. `scripts/migrate-v2-data.ts`.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import mariadb from "mariadb";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const ROOT = path.resolve(__dirname, "..");
const MIGRATIONS = path.join(ROOT, "prisma/migrations");
const LAST_V1 = "20261031050136_sync_schema_drift";

const testUrl = new URL(process.env.DATABASE_URL_TEST!);
const testDb = testUrl.pathname.slice(1);
const migDb = `${testDb.replace(/_test$/, "")}_v2mig_test`;
const migUrl = new URL(testUrl.toString());
migUrl.pathname = `/${migDb}`;
const MIG_URL = migUrl.toString();

function connect(database?: string) {
  return mariadb.createConnection({
    host: testUrl.hostname,
    port: Number(testUrl.port || 3306),
    user: decodeURIComponent(testUrl.username),
    password: decodeURIComponent(testUrl.password),
    database,
    multipleStatements: true,
  });
}

function run(cmd: string, extraEnv: Record<string, string> = {}) {
  return execSync(cmd, {
    cwd: ROOT,
    env: { ...process.env, DATABASE_URL: MIG_URL, ...extraEnv },
    stdio: ["ignore", "pipe", "pipe"],
  }).toString();
}

let prisma: PrismaClient;
let tmpDir: string;

beforeAll(async () => {
  if (!migDb.endsWith("_test")) throw new Error(`DB de migración inválida: ${migDb}`);
  const admin = await connect();
  await admin.query(`DROP DATABASE IF EXISTS \`${migDb}\``);
  await admin.query(`CREATE DATABASE \`${migDb}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await admin.end();

  // Migraciones v1 en un directorio aparte + config de Prisma que apunta ahí.
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "elbravo-v1mig-"));
  const v1Dir = path.join(tmpDir, "migrations");
  fs.mkdirSync(v1Dir);
  fs.copyFileSync(path.join(MIGRATIONS, "migration_lock.toml"), path.join(v1Dir, "migration_lock.toml"));
  for (const name of fs.readdirSync(MIGRATIONS).sort()) {
    if (!/^\d{14}_/.test(name) || name > LAST_V1) continue;
    fs.cpSync(path.join(MIGRATIONS, name), path.join(v1Dir, name), { recursive: true });
  }
  const v1Config = path.join(tmpDir, "prisma.config.mjs");
  fs.writeFileSync(
    v1Config,
    `export default ${JSON.stringify({
      schema: path.join(ROOT, "prisma/schema.prisma"),
      migrations: { path: v1Dir },
      datasource: { url: MIG_URL },
    })};\n`
  );
  run(`npx prisma migrate deploy --config ${JSON.stringify(v1Config)}`);

  const db = await connect(migDb);
  await db.query(fs.readFileSync(path.join(ROOT, "scripts/fixtures/v1-sample.sql"), "utf8"));
  await db.end();

  run("npx prisma migrate deploy");
  run("npx tsx scripts/migrate-v2-data.ts");

  prisma = new PrismaClient({ adapter: new PrismaMariaDb(MIG_URL) });
}, 180_000);

afterAll(async () => {
  await prisma?.$disconnect();
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  const admin = await connect();
  await admin.query(`DROP DATABASE IF EXISTS \`${migDb}\``);
  await admin.end();
});

describe("migración v1 → v2", () => {
  it("borra en duro las actividades marcadas como borradas", async () => {
    expect(await prisma.activity.count()).toBe(2);
    expect(await prisma.activity.findUnique({ where: { id: "a3" } })).toBeNull();
  });

  it("expande las series de actividades y rutinas", async () => {
    expect(await prisma.activitySet.count()).toBe(3); // 3 series de 10x40 (las de la borrada no)
    const sets = await prisma.activitySet.findMany({ orderBy: { position: "asc" } });
    expect(sets.map((s) => s.position)).toEqual([0, 1, 2]);
    expect(sets.every((s) => s.reps === 10 && s.weightKg === 40 && s.kind === "normal" && s.completed)).toBe(true);
    expect((await prisma.activitySet.findFirst())?.weightKg).toBe(40);
    expect(await prisma.routineSet.count()).toBe(4);
    expect((await prisma.routineSet.findFirst())?.targetWeightKg).toBe(50);
    expect((await prisma.activityExercise.findUniqueOrThrow({ where: { id: "ae1" } })).position).toBe(0);
    expect((await prisma.routineExercise.findUniqueOrThrow({ where: { id: "re1" } })).position).toBe(0);
  });

  it("completa categoría y duración desde los campos legacy", async () => {
    const a2 = await prisma.activity.findUniqueOrThrow({ where: { id: "a2" }, include: { activityCategory: true } });
    expect(a2.activityCategory.slug).toBe("running");
    expect(a2.durationMinutes).toBe(45);
    const a1 = await prisma.activity.findUniqueOrThrow({ where: { id: "a1" } });
    expect(a1.startedAt.toISOString()).toBe("2026-10-05T21:00:00.000Z");
    expect(a1.durationMinutes).toBe(70);
    expect(a1.routineId).toBe("r1");
  });

  it("convierte las fechas de temporada a fechas locales y migra las categorías", async () => {
    const s = await prisma.season.findFirstOrThrow();
    expect(s.startDate.toISOString().slice(0, 10)).toBe("2026-10-01");
    expect(s.endDate.toISOString().slice(0, 10)).toBe("2026-10-31");
    expect(s.weeklyGoal).toBe(3);
    expect(s.finalizedAt).toBeNull();
    const cats = await prisma.seasonCategory.findMany({ where: { seasonId: s.id } });
    expect(cats).toHaveLength(1);
    expect(cats[0]).toMatchObject({ activityCategoryId: "cat_strength" });
    expect(Number(cats[0].weight)).toBe(1);
  });

  it("deja slugs definitivos, timezone por defecto y marca las categorías con ejercicios", async () => {
    const exercises = await prisma.exercise.findMany({ orderBy: { id: "asc" } });
    expect(exercises.every((e) => !e.slug.startsWith("tmp-"))).toBe(true);
    expect(exercises.map((e) => e.slug)).toEqual(["press-de-banca", "plancha-abdominal"]);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: "u1" } })).timezone).toBe("America/Argentina/Buenos_Aires");
    expect((await prisma.activityCategory.findUniqueOrThrow({ where: { slug: "strength" } })).usesExercises).toBe(true);
    expect((await prisma.activityCategory.findUniqueOrThrow({ where: { slug: "running" } })).usesExercises).toBe(false);
  });

  it("el script es idempotente y el schema queda igual al de Prisma", async () => {
    run("npx tsx scripts/migrate-v2-data.ts");
    expect((await prisma.exercise.findMany({ orderBy: { id: "asc" } })).map((e) => e.slug)).toEqual([
      "press-de-banca",
      "plancha-abdominal",
    ]);
    const diff = run("npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script");
    expect(diff.trim()).toBe("-- This is an empty migration.");
  });
});
