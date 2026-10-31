import { createHash, timingSafeEqual } from "node:crypto";

/**
 * `Authorization: Bearer $CRON_SECRET` (lo manda Vercel Cron). Sin `CRON_SECRET` definido, nadie pasa.
 * Comparación en tiempo constante (sobre hashes, así no depende del largo).
 */
export function isAuthorizedCron(authorization: string | null, secret = process.env.CRON_SECRET): boolean {
  if (!secret || !authorization) return false;
  const digest = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(digest(authorization), digest(`Bearer ${secret}`));
}
