import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetDb, prisma } from "@/tests/setup/db";
import { cookieJar, requestHeaders, resetNextMocks } from "@/src/server/account/testing/next-mocks";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", async () => (await import("@/src/server/account/testing/next-mocks")).nextHeadersMock);
vi.mock("next/navigation", async () => ({
  redirect: vi.fn((await import("@/src/server/account/testing/next-mocks")).redirectMock),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/src/server/badges", async (orig) => ({
  ...(await orig<typeof import("@/src/server/badges")>()),
  recomputeUserBadges: vi.fn(async () => []),
}));

import {
  loginAction,
  registerAction,
  logoutAction,
  changePasswordAction,
  logoutEverywhereAction,
  updateProfileAction,
} from "./account";
import { getSession } from "@/src/server/auth/dal";
import { SESSION_COOKIE } from "@/src/server/auth/session";
import { hashPassword } from "@/src/server/account/passwords";
import { __clearRateLimits } from "@/src/server/account/rate-limit";
import { recomputeUserBadges } from "@/src/server/badges";

function form(data: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(data)) f.set(k, v);
  return f;
}

let passwordHash: string;
async function makeUser(email = "ana@test.com", extra: Partial<{ isActive: boolean; weeklyGoal: number }> = {}) {
  passwordHash ??= await hashPassword("password123");
  return prisma.user.create({ data: { email, passwordHash, name: "Ana", ...extra } });
}

describe("account actions", () => {
  beforeEach(async () => {
    await resetDb();
    resetNextMocks();
    __clearRateLimits();
    requestHeaders.set("x-forwarded-for", "10.0.0.1, 172.16.0.1");
    vi.mocked(recomputeUserBadges).mockClear();
  });

  describe("registerAction", () => {
    it("valida email, nombre y contraseña con errores por campo", async () => {
      const r = await registerAction(null, form({ name: "A", email: "no-es-email", password: "corta" }));
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.fieldErrors?.name).toBeDefined();
      expect(r.fieldErrors?.email).toBeDefined();
      expect(r.fieldErrors?.password).toBeDefined();
      expect(await prisma.user.count()).toBe(0);
    });

    it("normaliza el email, crea el usuario e inicia sesión", async () => {
      const r = await registerAction(null, form({ name: "  Ana  ", email: "  Ana@Test.COM ", password: "password123", next: "/u/x" }));
      expect(r).toEqual({ ok: true, data: { next: "/u/x" } });
      const u = await prisma.user.findUniqueOrThrow({ where: { email: "ana@test.com" } });
      expect(u.name).toBe("Ana");
      expect(u.passwordHash).not.toBe("password123");
      expect(cookieJar.get(SESSION_COOKIE)).toBeTruthy();
      expect((await getSession())?.id).toBe(u.id);
    });

    it("rechaza un email ya registrado", async () => {
      await makeUser();
      const r = await registerAction(null, form({ name: "Ana", email: "ANA@test.com", password: "password123" }));
      expect(r).toMatchObject({ ok: false, error: "Ya hay una cuenta con ese email." });
    });

    it("no acepta un next externo", async () => {
      const r = await registerAction(null, form({ name: "Ana", email: "a@b.com", password: "password123", next: "//evil.com" }));
      expect(r).toEqual({ ok: true, data: { next: "/home" } });
    });
  });

  describe("loginAction", () => {
    it("inicia sesión con email en cualquier caso y respeta next", async () => {
      const u = await makeUser();
      const r = await loginAction(null, form({ email: "ANA@test.com", password: "password123", next: "/settings" }));
      expect(r).toEqual({ ok: true, data: { next: "/settings" } });
      expect((await getSession())?.id).toBe(u.id);
    });

    it("mismo mensaje para contraseña incorrecta, usuario inexistente o inactivo", async () => {
      await makeUser();
      await makeUser("off@test.com", { isActive: false });
      const msg = "Email o contraseña incorrectos.";
      expect(await loginAction(null, form({ email: "ana@test.com", password: "mala-mala" }))).toMatchObject({ ok: false, error: msg });
      expect(await loginAction(null, form({ email: "nadie@test.com", password: "password123" }))).toMatchObject({ ok: false, error: msg });
      expect(await loginAction(null, form({ email: "off@test.com", password: "password123" }))).toMatchObject({ ok: false, error: msg });
      expect(cookieJar.has(SESSION_COOKIE)).toBe(false);
    });

    it("bloquea el sexto intento por ip:email durante 15 minutos", async () => {
      await makeUser();
      for (let i = 0; i < 5; i++) {
        expect(await loginAction(null, form({ email: "ana@test.com", password: "mala-mala" }))).toMatchObject({ ok: false, error: "Email o contraseña incorrectos." });
      }
      // ni siquiera con la contraseña correcta
      const r = await loginAction(null, form({ email: "ana@test.com", password: "password123" }));
      expect(r).toMatchObject({ ok: false, error: "Demasiados intentos. Probá de nuevo en 15 minutos." });
      expect(cookieJar.has(SESSION_COOKIE)).toBe(false);
      // otra IP no está bloqueada
      requestHeaders.set("x-forwarded-for", "10.0.0.2");
      expect((await loginAction(null, form({ email: "ana@test.com", password: "password123" }))).ok).toBe(true);
    });

    it("rotar la primera IP de x-forwarded-for (la escribe el cliente) no saltea el límite", async () => {
      await makeUser();
      for (let i = 0; i < 5; i++) {
        requestHeaders.set("x-forwarded-for", `1.2.3.${i}, 172.16.0.1`);
        await loginAction(null, form({ email: "ana@test.com", password: "mala-mala" }));
      }
      requestHeaders.set("x-forwarded-for", "9.9.9.9, 172.16.0.1");
      const r = await loginAction(null, form({ email: "ana@test.com", password: "password123" }));
      expect(r).toMatchObject({ ok: false, error: "Demasiados intentos. Probá de nuevo en 15 minutos." });
    });

    it("limita por email aunque cada intento venga de otra IP (ataque distribuido)", async () => {
      await makeUser();
      for (let i = 0; i < 20; i++) {
        requestHeaders.set("x-forwarded-for", `10.1.0.${i}`);
        expect((await loginAction(null, form({ email: "ana@test.com", password: "mala-mala" }))).ok).toBe(false);
      }
      requestHeaders.set("x-forwarded-for", "10.1.1.1");
      const r = await loginAction(null, form({ email: "ana@test.com", password: "password123" }));
      expect(r).toMatchObject({ ok: false, error: expect.stringContaining("Demasiados intentos") });
    });
  });

  describe("sesiones revocables", () => {
    it("un token con versión vieja deja de valer", async () => {
      const u = await makeUser();
      await loginAction(null, form({ email: "ana@test.com", password: "password123" }));
      expect((await getSession())?.id).toBe(u.id);
      await prisma.user.update({ where: { id: u.id }, data: { tokenVersion: { increment: 1 } } });
      expect(await getSession()).toBeNull();
    });
  });

  describe("changePasswordAction", () => {
    async function loggedIn() {
      const u = await makeUser();
      await loginAction(null, form({ email: "ana@test.com", password: "password123" }));
      return u;
    }

    it("verifica la contraseña actual", async () => {
      await loggedIn();
      const r = await changePasswordAction({ currentPassword: "incorrecta", newPassword: "nueva-clave-1" });
      expect(r).toMatchObject({ ok: false, fieldErrors: { currentPassword: ["La contraseña actual no es correcta."] } });
    });

    it("la nueva tiene que ser distinta y de 8+ caracteres", async () => {
      await loggedIn();
      expect((await changePasswordAction({ currentPassword: "password123", newPassword: "password123" })).ok).toBe(false);
      const r = await changePasswordAction({ currentPassword: "password123", newPassword: "corta" });
      expect(r.ok === false && r.fieldErrors?.newPassword).toBeTruthy();
    });

    it("cambia la contraseña, mantiene esta sesión y cierra las demás", async () => {
      const u = await loggedIn();
      const otherSession = cookieJar.get(SESSION_COOKIE)!;
      const r = await changePasswordAction({ currentPassword: "password123", newPassword: "nueva-clave-1" });
      expect(r).toEqual({ ok: true, data: undefined, message: "Contraseña actualizada. Cerramos tus otras sesiones." });
      expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).tokenVersion).toBe(1);
      // esta sesión sigue (cookie re-emitida con la versión nueva)
      expect((await getSession())?.id).toBe(u.id);
      // la otra (token viejo) ya no
      cookieJar.set(SESSION_COOKIE, otherSession);
      expect(await getSession()).toBeNull();
      // y la contraseña nueva funciona
      cookieJar.clear();
      expect((await loginAction(null, form({ email: "ana@test.com", password: "nueva-clave-1" }))).ok).toBe(true);
    });

    it("sin sesión responde que hay que iniciar sesión", async () => {
      expect(await changePasswordAction({ currentPassword: "x", newPassword: "nueva-clave-1" })).toMatchObject({
        ok: false,
        error: "Tenés que iniciar sesión.",
      });
    });
  });

  describe("logout", () => {
    it("logoutEverywhereAction incrementa tokenVersion y borra la cookie", async () => {
      const u = await makeUser();
      await loginAction(null, form({ email: "ana@test.com", password: "password123" }));
      const token = cookieJar.get(SESSION_COOKIE)!;
      expect((await logoutEverywhereAction()).ok).toBe(true);
      expect(cookieJar.has(SESSION_COOKIE)).toBe(false);
      expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).tokenVersion).toBe(1);
      cookieJar.set(SESSION_COOKIE, token);
      expect(await getSession()).toBeNull();
    });

    it("logoutAction borra la cookie y redirige a /login", async () => {
      await makeUser();
      await loginAction(null, form({ email: "ana@test.com", password: "password123" }));
      await expect(logoutAction()).rejects.toMatchObject({ digest: expect.stringContaining("/login") });
      expect(cookieJar.has(SESSION_COOKIE)).toBe(false);
    });
  });

  describe("updateProfileAction", () => {
    async function loggedIn() {
      const u = await makeUser();
      await loginAction(null, form({ email: "ana@test.com", password: "password123" }));
      return u;
    }
    const base = { name: "Ana María", bio: "Corro", weeklyGoal: 3, timezone: "America/Montevideo", photoUrl: null };

    it("valida zona horaria y objetivo semanal (1 a 7)", async () => {
      await loggedIn();
      const tz = await updateProfileAction({ ...base, timezone: "Marte/Olympus" });
      expect(tz.ok === false && tz.fieldErrors?.timezone).toBeTruthy();
      const goal = await updateProfileAction({ ...base, weeklyGoal: 8 });
      expect(goal.ok === false && goal.fieldErrors?.weeklyGoal).toBeTruthy();
    });

    it("guarda nombre, bio, zona y foto (de su carpeta del bucket) sin tocar el email", async () => {
      vi.stubEnv("R2_ACCOUNT_ID", "test");
      vi.stubEnv("R2_ACCESS_KEY_ID", "test");
      vi.stubEnv("R2_SECRET_ACCESS_KEY", "test");
      vi.stubEnv("R2_BUCKET", "elbravo-media");
      vi.stubEnv("R2_PUBLIC_BASE_URL", "https://media.test");
      try {
        const u = await loggedIn();
        const photoUrl = `https://media.test/avatars/${u.id}/abc.webp`;
        const r = await updateProfileAction({ ...base, photoUrl });
        expect(r.ok).toBe(true);
        const after = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
        expect(after).toMatchObject({ name: "Ana María", bio: "Corro", timezone: "America/Montevideo", photoUrl, email: "ana@test.com" });
        expect(recomputeUserBadges).not.toHaveBeenCalled();

        // Ni hosts externos ni fotos de otro usuario (se borrarían al cambiar la foto).
        for (const bad of ["https://img.test/a.webp", "https://media.test/avatars/otro/abc.webp", "https://media.test/activities/x/abc.webp"]) {
          const res = await updateProfileAction({ ...base, photoUrl: bad });
          expect(res).toMatchObject({ ok: false, fieldErrors: { photoUrl: ["Subí la foto desde la app."] } });
        }
        // Mantener la que ya tenía o sacarla sí se puede.
        expect((await updateProfileAction({ ...base, photoUrl })).ok).toBe(true);
        expect((await updateProfileAction({ ...base, photoUrl: null })).ok).toBe(true);
      } finally {
        vi.unstubAllEnvs();
      }
    });

    it("si cambia el objetivo semanal recalcula insignias", async () => {
      const u = await loggedIn();
      expect((await updateProfileAction({ ...base, weeklyGoal: 5 })).ok).toBe(true);
      expect(recomputeUserBadges).toHaveBeenCalledWith(u.id);
    });
  });
});
