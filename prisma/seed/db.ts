import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

// .env.local (por worktree) tiene prioridad sobre .env; ninguno pisa variables ya definidas.
config({ path: ".env.local", quiet: true });
config({ quiet: true });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("Missing DATABASE_URL in environment variables");

/** Cliente propio del seed (corre con tsx, fuera de Next). */
export const prisma = new PrismaClient({ adapter: new PrismaMariaDb(databaseUrl) });
