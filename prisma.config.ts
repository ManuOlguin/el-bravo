import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// .env.local (por worktree, lo escribe `npm run db:worktree`) tiene prioridad sobre .env
config({ path: ".env.local", quiet: true });
config({ quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env["DATABASE_URL"] },
});
