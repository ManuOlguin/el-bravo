// setupFiles del proyecto `integration`: corre antes de importar cada archivo de test,
// así `src/lib/db` crea el cliente de Prisma apuntando a la DB de test.
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
config({ quiet: true });
if (!process.env.DATABASE_URL_TEST) {
  throw new Error("Falta DATABASE_URL_TEST (.env.local). Corré `npm run db:worktree -- <id> <port>`.");
}
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
