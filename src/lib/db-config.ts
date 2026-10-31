import type { PoolConfig } from "mariadb";

/**
 * `DATABASE_URL` (mysql://usuario:clave@host:puerto/base?params) → config del driver mariadb.
 * - TLS: las bases en la nube (TiDB Cloud, Aiven…) lo exigen. Se activa con `sslaccept=strict` (el mismo
 *   parámetro que entiende `prisma migrate`), `ssl=true` o `sslmode=require|verify-*`. Valida el certificado
 *   con las CAs del sistema; `sslaccept=accept_invalid_certs` no lo valida (solo para pruebas).
 * - `connection_limit`: conexiones por instancia (en serverless conviene pocas). Por defecto 5.
 * - `connect_timeout` (segundos): el driver corta a 1 s por defecto, poco para un TLS en frío. Por defecto 10.
 */
export function mariadbConfig(url: string): PoolConfig {
  const u = new URL(url);
  if (u.protocol !== "mysql:" && u.protocol !== "mariadb:") throw new Error("DATABASE_URL tiene que empezar con mysql://");
  const p = u.searchParams;
  const sslaccept = p.get("sslaccept");
  const sslmode = p.get("sslmode")?.toLowerCase();
  const ssl =
    sslaccept === "accept_invalid_certs"
      ? { rejectUnauthorized: false }
      : sslaccept === "strict" || p.get("ssl") === "true" || p.get("ssl") === "1" || (sslmode !== undefined && sslmode !== "disable" && sslmode !== "disabled")
        ? { rejectUnauthorized: true, minVersion: "TLSv1.2" as const }
        : undefined;
  const limit = Number(p.get("connection_limit"));
  const timeoutS = Number(p.get("connect_timeout"));
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: decodeURIComponent(u.pathname.replace(/^\//, "")),
    connectionLimit: Number.isInteger(limit) && limit > 0 ? limit : 5,
    connectTimeout: (timeoutS > 0 ? timeoutS : 10) * 1000,
    ...(ssl ? { ssl } : {}),
  };
}
