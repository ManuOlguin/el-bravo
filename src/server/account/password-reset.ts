import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/src/lib/db";

/**
 * Recuperar contraseña por email (portado de el-bravo-prod, abril 2026). Se guarda solo el sha256 del
 * token; vence a los 30 minutos, es de un solo uso y pedir uno nuevo invalida los anteriores.
 * Al usarlo se cambia la clave y se suben `tokenVersion`: se cierran todas las sesiones abiertas.
 */

export const RESET_TTL_MS = 30 * 60_000;

export const hashResetToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Crea un token para `email` (si la cuenta existe y está activa). Devuelve el token en claro para el link. */
export async function createPasswordReset(email: string, now = new Date()): Promise<{ email: string; token: string } | null> {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() }, select: { id: true, email: true, isActive: true } });
  if (!user || !user.isActive) return null;
  const token = randomBytes(32).toString("hex");
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
    prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hashResetToken(token), expiresAt: new Date(now.getTime() + RESET_TTL_MS) },
    }),
  ]);
  return { email: user.email, token };
}

export type ResetOutcome =
  | { ok: true; userId: string; email: string; tokenVersion: number }
  | { ok: false; reason: "invalid" | "used" | "expired" };

/** Usa el token: cambia la clave (ya hasheada) y cierra todas las sesiones. Seguro ante dos usos a la vez. */
export async function consumePasswordReset(token: string, passwordHash: string, now = new Date()): Promise<ResetOutcome> {
  if (!/^[0-9a-f]{64}$/.test(token)) return { ok: false, reason: "invalid" };
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(token) },
    select: { id: true, userId: true, expiresAt: true, usedAt: true, user: { select: { isActive: true } } },
  });
  if (!record || !record.user.isActive) return { ok: false, reason: "invalid" };
  if (record.usedAt) return { ok: false, reason: "used" };
  if (record.expiresAt <= now) return { ok: false, reason: "expired" };

  return prisma.$transaction(async (tx) => {
    // Marca usado solo si nadie lo usó en el medio (dos pestañas con el mismo link).
    const claimed = await tx.passwordResetToken.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: now } });
    if (claimed.count === 0) return { ok: false, reason: "used" } as const;
    const user = await tx.user.update({
      where: { id: record.userId },
      data: { passwordHash, tokenVersion: { increment: 1 } },
      select: { id: true, email: true, tokenVersion: true },
    });
    await tx.passwordResetToken.deleteMany({ where: { userId: record.userId, usedAt: null } });
    return { ok: true, userId: user.id, email: user.email, tokenVersion: user.tokenVersion } as const;
  });
}
