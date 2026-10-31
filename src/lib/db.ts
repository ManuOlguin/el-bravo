import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { mariadbConfig } from "./db-config";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Missing DATABASE_URL in .env");

  // Prisma 7 requiere adapter o accelerateUrl. La URL se traduce a config (TLS para bases en la nube).
  const adapter = new PrismaMariaDb(mariadbConfig(url));

  return new PrismaClient({ adapter });
}

function client(): PrismaClient {
  const c = globalForPrisma.prisma ?? createPrismaClient();
  // En dev se reusa entre recargas en caliente; en producción, uno por instancia (se cachea igual).
  globalForPrisma.prisma = c;
  return c;
}

/**
 * Cliente perezoso: se crea en el primer uso, no al importar el módulo. Así `next build` (que carga los
 * módulos para recolectar datos de las páginas) no necesita `DATABASE_URL` ni conectarse a la base.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const c = client();
    const value = Reflect.get(c, prop, c);
    return typeof value === "function" ? value.bind(c) : value;
  },
});
