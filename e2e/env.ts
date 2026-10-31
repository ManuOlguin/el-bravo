/**
 * Entorno de los E2E: una DB propia (`<db del worktree>_e2e`, p. ej. `elbravo_w3_e2e`) y un server en
 * un puerto propio. Lo usan `playwright.config.ts` (webServer), `global-setup.ts` y el seed.
 */
import { config } from "dotenv";
import path from "node:path";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

function e2eDatabaseUrl(): string {
  if (process.env.E2E_DATABASE_URL) return process.env.E2E_DATABASE_URL;
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error("Falta DATABASE_URL (corré `npm run db:worktree` primero)");
  const u = new URL(base);
  const db = u.pathname.replace(/^\//, "") || "elbravo";
  u.pathname = `/${db.endsWith("_e2e") ? db : `${db}_e2e`}`;
  return u.toString();
}

export const E2E_DATABASE_URL = e2eDatabaseUrl();
export const E2E_PORT = Number(process.env.E2E_PORT ?? 3031);
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;
export const CREDENTIALS_PATH = path.join(__dirname, ".auth", "credentials.json");
export const TZ = "America/Argentina/Buenos_Aires";
