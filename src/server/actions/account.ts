"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/src/lib/db";
import { requireUser } from "@/src/server/auth/dal";
import { safeNextPath } from "@/src/server/auth/policies";
import { clearSessionCookie, setSessionCookie } from "@/src/server/auth/session";
import { fail, ok, parseInput, runAction, type ActionResult } from "@/src/server/http/result";
import { burnPasswordCheck, hashPassword, verifyPassword } from "@/src/server/account/passwords";
import { rateLimit, resetRateLimit, retryAfterMinutes } from "@/src/server/account/rate-limit";
import { consumePasswordReset, createPasswordReset } from "@/src/server/account/password-reset";
import { absoluteUrl, renderPasswordResetEmail } from "@/src/emails/render";
import { appUrl, getEmailSender } from "@/src/server/notifications/email";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  loginSchema,
  registerSchema,
  updateProfileSchema,
} from "@/src/server/account/schemas";
import { recomputeUserBadges } from "@/src/server/badges";
import { isAllowedPhotoUrl } from "@/src/server/media/service";

const LOGIN_LIMIT = { max: 5, windowMs: 15 * 60_000 }; // por IP + email
const LOGIN_EMAIL_LIMIT = { max: 20, windowMs: 15 * 60_000 }; // por email, desde cualquier IP (ataque distribuido)
const LOGIN_IP_LIMIT = { max: 50, windowMs: 15 * 60_000 }; // por IP, contra cualquier email (password spraying)
const REGISTER_IP_LIMIT = { max: 10, windowMs: 60 * 60_000 };
const RESET_EMAIL_LIMIT = { max: 3, windowMs: 60 * 60_000 }; // mails de recuperación por cuenta
const RESET_IP_LIMIT = { max: 10, windowMs: 60 * 60_000 }; // pedidos por IP (cualquier email)
const RESET_SENT = "Si hay una cuenta con ese email, te mandamos un link para elegir una contraseña nueva. Revisá también el spam.";
const BAD_CREDENTIALS = "Email o contraseña incorrectos.";
const PHOTO_URL_ERROR = "Subí la foto desde la app.";

function formValue(form: FormData, key: string): string | undefined {
  const v = form.get(key);
  return typeof v === "string" ? v : undefined;
}

/**
 * IP del cliente para el rate limit. Primero los headers que pone la plataforma (Vercel:
 * `x-vercel-forwarded-for` / `x-real-ip`); si no, la ÚLTIMA entrada de `x-forwarded-for` (la agrega el
 * proxy propio). La primera la escribe el cliente: usarla permitía saltear el límite rotando el header.
 */
async function clientIp(): Promise<string> {
  const h = await headers();
  const platform = h.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim();
  if (platform) return platform;
  const hops = h.get("x-forwarded-for")?.split(",").map((x) => x.trim()).filter(Boolean) ?? [];
  return hops.at(-1) || "local";
}

/** Primer límite agotado de la lista (registra el intento en los que todavía tienen lugar). */
function firstBlocked(checks: [key: string, opts: { max: number; windowMs: number }][]) {
  for (const [key, opts] of checks) {
    const r = rateLimit(key, opts);
    if (!r.ok) return r;
  }
  return null;
}

export async function loginAction(_prev: unknown, form: FormData): Promise<ActionResult<{ next: string }>> {
  return runAction(async () => {
    const parsed = parseInput(loginSchema, {
      email: formValue(form, "email") ?? "",
      password: formValue(form, "password") ?? "",
      next: formValue(form, "next"),
    });
    if (!parsed.ok) return parsed.result;
    const { email, password, next } = parsed.data;

    const ip = await clientIp();
    const key = `login:${ip}:${email}`;
    const blocked = firstBlocked([
      [key, LOGIN_LIMIT],
      [`login-email:${email}`, LOGIN_EMAIL_LIMIT],
      [`login-ip:${ip}`, LOGIN_IP_LIMIT],
    ]);
    if (blocked) return fail(`Demasiados intentos. Probá de nuevo en ${retryAfterMinutes(blocked.retryAfterS)} minutos.`);

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, passwordHash: true, isActive: true, tokenVersion: true },
    });
    if (!user) {
      await burnPasswordCheck(password);
      return fail(BAD_CREDENTIALS);
    }
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid || !user.isActive) return fail(BAD_CREDENTIALS);

    resetRateLimit(key);
    resetRateLimit(`login-email:${email}`);
    await setSessionCookie({ userId: user.id, email: user.email, ver: user.tokenVersion });
    return ok({ next: safeNextPath(next) });
  });
}

export async function registerAction(_prev: unknown, form: FormData): Promise<ActionResult<{ next: string }>> {
  return runAction(async () => {
    const parsed = parseInput(registerSchema, {
      name: formValue(form, "name") ?? "",
      email: formValue(form, "email") ?? "",
      password: formValue(form, "password") ?? "",
      next: formValue(form, "next"),
    });
    if (!parsed.ok) return parsed.result;
    const { name, email, password, next } = parsed.data;

    const limit = rateLimit(`register:${await clientIp()}`, REGISTER_IP_LIMIT);
    if (!limit.ok) return fail(`Demasiados registros desde esta conexión. Probá de nuevo en ${retryAfterMinutes(limit.retryAfterS)} minutos.`);

    const exists = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (exists) return fail("Ya hay una cuenta con ese email.", { email: ["Ya hay una cuenta con ese email."] });

    const passwordHash = await hashPassword(password);
    let user: { id: string; email: string; tokenVersion: number };
    try {
      user = await prisma.user.create({
        data: { email, passwordHash, name },
        select: { id: true, email: true, tokenVersion: true },
      });
    } catch (e) {
      // Carrera: dos registros simultáneos con el mismo email.
      if ((e as { code?: string })?.code === "P2002") {
        return fail("Ya hay una cuenta con ese email.", { email: ["Ya hay una cuenta con ese email."] });
      }
      throw e;
    }

    await setSessionCookie({ userId: user.id, email: user.email, ver: user.tokenVersion });
    return ok({ next: safeNextPath(next) });
  });
}

/**
 * "Olvidé mi contraseña": manda un link de un solo uso (30 min). La respuesta es la misma exista o no la
 * cuenta (no revela qué emails están registrados). Con límite por cuenta y por IP para que no se use
 * para mandar mails en masa.
 */
export async function requestPasswordResetAction(_prev: unknown, form: FormData): Promise<ActionResult<{ message: string }>> {
  return runAction(async () => {
    const parsed = parseInput(forgotPasswordSchema, { email: formValue(form, "email") ?? "" });
    if (!parsed.ok) return parsed.result;
    const { email } = parsed.data;

    const sender = getEmailSender();
    if (!sender) return fail("La recuperación por email todavía no está configurada. Pedile a un admin que te ayude.");

    const blocked = firstBlocked([
      [`reset-ip:${await clientIp()}`, RESET_IP_LIMIT],
      [`reset-email:${email}`, RESET_EMAIL_LIMIT],
    ]);
    if (blocked) return fail(`Pediste demasiados links. Probá de nuevo en ${retryAfterMinutes(blocked.retryAfterS)} minutos.`);

    const reset = await createPasswordReset(email);
    if (reset) {
      const base = appUrl();
      const link = absoluteUrl(base, `/reset-password?token=${reset.token}`);
      try {
        await sender({ to: reset.email, ...renderPasswordResetEmail(link, base) });
      } catch (e) {
        console.error("[password-reset] no se pudo mandar el email", e);
        return fail("No pudimos mandar el email. Probá de nuevo en unos minutos.");
      }
    }
    return ok({ message: RESET_SENT });
  });
}

const RESET_ERRORS = {
  invalid: "El link no es válido. Pedí uno nuevo.",
  used: "Este link ya se usó. Si necesitás, pedí uno nuevo.",
  expired: "El link venció (dura 30 minutos). Pedí uno nuevo.",
} as const;

/** Elige la contraseña nueva con el token del email, cierra las otras sesiones y deja logueado. */
export async function resetPasswordAction(_prev: unknown, form: FormData): Promise<ActionResult<{ next: string }>> {
  return runAction(async () => {
    const parsed = parseInput(resetPasswordSchema, {
      token: formValue(form, "token") ?? "",
      newPassword: formValue(form, "newPassword") ?? "",
      confirmPassword: formValue(form, "confirmPassword") ?? "",
    });
    if (!parsed.ok) return parsed.result;
    const outcome = await consumePasswordReset(parsed.data.token, await hashPassword(parsed.data.newPassword));
    if (!outcome.ok) return fail(RESET_ERRORS[outcome.reason]);
    resetRateLimit(`reset-email:${outcome.email}`);
    await setSessionCookie({ userId: outcome.userId, email: outcome.email, ver: outcome.tokenVersion });
    return ok({ next: "/home" }, "Listo: contraseña nueva. Cerramos tus otras sesiones.");
  });
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}

export async function changePasswordAction(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<ActionResult<void>> {
  return runAction(async () => {
    const me = await requireUser();
    const parsed = parseInput(changePasswordSchema, input);
    if (!parsed.ok) return parsed.result;
    const { currentPassword, newPassword } = parsed.data;

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: me.id },
      select: { id: true, email: true, passwordHash: true },
    });
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      return fail("La contraseña actual no es correcta.", { currentPassword: ["La contraseña actual no es correcta."] });
    }
    if (currentPassword === newPassword) {
      return fail("La contraseña nueva tiene que ser distinta de la actual.", {
        newPassword: ["La contraseña nueva tiene que ser distinta de la actual."],
      });
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(newPassword), tokenVersion: { increment: 1 } },
      select: { tokenVersion: true },
    });
    // Esta sesión sigue con la versión nueva; todas las demás quedan inválidas.
    await setSessionCookie({ userId: user.id, email: user.email, ver: updated.tokenVersion });
    return ok(undefined, "Contraseña actualizada. Cerramos tus otras sesiones.");
  });
}

export async function logoutEverywhereAction(): Promise<ActionResult<void>> {
  return runAction(async () => {
    const me = await requireUser();
    await prisma.user.update({ where: { id: me.id }, data: { tokenVersion: { increment: 1 } } });
    await clearSessionCookie();
    return ok(undefined, "Cerramos tu sesión en todos los dispositivos.");
  });
}

export async function updateProfileAction(input: {
  name: string;
  bio?: string | null;
  weeklyGoal: number;
  timezone: string;
  photoUrl?: string | null;
}): Promise<ActionResult<void>> {
  return runAction(async () => {
    const me = await requireUser();
    const parsed = parseInput(updateProfileSchema, input);
    if (!parsed.ok) return parsed.result;
    const data = parsed.data;

    const before = await prisma.user.findUniqueOrThrow({ where: { id: me.id }, select: { weeklyGoal: true, photoUrl: true } });
    if (!isAllowedPhotoUrl(data.photoUrl, before.photoUrl, { kind: "avatar", userId: me.id })) {
      return fail(PHOTO_URL_ERROR, { photoUrl: [PHOTO_URL_ERROR] });
    }
    await prisma.user.update({
      where: { id: me.id },
      data: { name: data.name, bio: data.bio, weeklyGoal: data.weeklyGoal, timezone: data.timezone, photoUrl: data.photoUrl },
    });
    // IMPARABLE depende del objetivo semanal personal.
    if (before.weeklyGoal !== data.weeklyGoal) await recomputeUserBadges(me.id);

    revalidatePath("/", "layout");
    return ok(undefined, "Perfil actualizado.");
  });
}
