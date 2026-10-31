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
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
  updateProfileSchema,
} from "@/src/server/account/schemas";
import { recomputeUserBadges } from "@/src/server/badges";

const LOGIN_LIMIT = { max: 5, windowMs: 15 * 60_000 };
const BAD_CREDENTIALS = "Email o contraseña incorrectos.";

function formValue(form: FormData, key: string): string | undefined {
  const v = form.get(key);
  return typeof v === "string" ? v : undefined;
}

async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || h.get("x-real-ip")?.trim() || "local";
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

    const key = `login:${await clientIp()}:${email}`;
    const limit = rateLimit(key, LOGIN_LIMIT);
    if (!limit.ok) return fail(`Demasiados intentos. Probá de nuevo en ${retryAfterMinutes(limit.retryAfterS)} minutos.`);

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

    const before = await prisma.user.findUniqueOrThrow({ where: { id: me.id }, select: { weeklyGoal: true } });
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
