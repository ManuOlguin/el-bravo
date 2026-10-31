// La URL de test la fija `tests/setup/env.ts` (setupFiles), que corre antes de este import.
import { prisma } from "@/src/lib/db";

export async function resetDb() {
  const [{ db }] = await prisma.$queryRawUnsafe<{ db: string }[]>("SELECT DATABASE() AS db");
  if (!db.endsWith("_test")) throw new Error(`resetDb() se niega a truncar "${db}": no es una DB de test.`);
  const rows = await prisma.$queryRawUnsafe<{ t: string }[]>(
    "SELECT table_name AS t FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name <> '_prisma_migrations'"
  );
  // FOREIGN_KEY_CHECKS es por sesión: todo tiene que correr en la misma conexión del pool.
  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 0");
      try {
        for (const { t } of rows) await tx.$executeRawUnsafe(`TRUNCATE TABLE \`${t}\``);
      } finally {
        await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 1");
      }
    },
    { timeout: 30000 }
  );
}

export { prisma };
