/**
 * Prepara la DB de E2E desde cero en cada corrida: DROP + CREATE, migraciones, seed base (catálogo) y
 * `seed-e2e.ts` (usuarios/grupos/temporada con contraseñas nuevas). El server de Playwright lee la DB
 * en cada request, así que no importa si arrancó antes que este setup.
 */
import { execFileSync } from "node:child_process";
import mariadb from "mariadb";
import { E2E_DATABASE_URL } from "./env";

async function recreateDatabase(url: string) {
  const u = new URL(url);
  const db = decodeURIComponent(u.pathname.slice(1));
  if (!/^[A-Za-z0-9_]+_e2e$/.test(db)) throw new Error(`Nombre de DB de E2E inesperado: ${db}`);
  const conn = await mariadb.createConnection({
    host: u.hostname,
    port: Number(u.port || 3306),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
  });
  try {
    await conn.query(`DROP DATABASE IF EXISTS \`${db}\``);
    await conn.query(`CREATE DATABASE \`${db}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  } finally {
    await conn.end();
  }
}

export default async function globalSetup() {
  if (process.env.E2E_SKIP_SEED === "1") return;
  await recreateDatabase(E2E_DATABASE_URL);
  const env = { ...process.env, DATABASE_URL: E2E_DATABASE_URL };
  const run = (cmd: string, args: string[]) => execFileSync(cmd, args, { env, stdio: ["ignore", "ignore", "inherit"] });
  run("npx", ["prisma", "migrate", "deploy"]);
  run("npx", ["tsx", "prisma/seed/index.ts"]);
  execFileSync("npx", ["tsx", "e2e/fixtures/seed-e2e.ts"], { env, stdio: "inherit" });
}
