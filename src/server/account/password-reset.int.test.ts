import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetDb, prisma } from "@/tests/setup/db";
import { cookieJar, requestHeaders, resetNextMocks } from "@/src/server/account/testing/next-mocks";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", async () => (await import("@/src/server/account/testing/next-mocks")).nextHeadersMock);
vi.mock("next/navigation", async () => ({
  redirect: vi.fn((await import("@/src/server/account/testing/next-mocks")).redirectMock),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// Mails capturados en memoria (no se manda nada de verdad).
const sent = vi.hoisted(() => [] as { to: string; subject: string; text: string }[]);
const mailer = vi.hoisted(() => ({ enabled: true }));
vi.mock("@/src/server/notifications/email", async (orig) => ({
  ...(await orig<typeof import("@/src/server/notifications/email")>()),
  appUrl: () => "https://bravo.test",
  getEmailSender: () => (mailer.enabled ? async (m: { to: string; subject: string; text: string }) => void sent.push(m) : null),
}));

import { requestPasswordResetAction, resetPasswordAction } from "@/src/server/actions/account";
import { consumePasswordReset, createPasswordReset, hashResetToken, RESET_TTL_MS } from "./password-reset";
import { hashPassword, verifyPassword } from "./passwords";
import { __clearRateLimits } from "./rate-limit";
import { SESSION_COOKIE } from "@/src/server/auth/session";

function form(data: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(data)) f.set(k, v);
  return f;
}

async function makeUser(email = "ana@test.com", extra: Partial<{ isActive: boolean }> = {}) {
  return prisma.user.create({ data: { email, passwordHash: await hashPassword("vieja1234"), name: "Ana", ...extra } });
}

const tokenFrom = (text: string) => text.match(/token=([0-9a-f]{64})/)![1];

beforeEach(async () => {
  await resetDb();
  resetNextMocks();
  __clearRateLimits();
  sent.length = 0;
  mailer.enabled = true;
  requestHeaders.set("x-forwarded-for", "10.0.0.1");
});

describe("servicio de recuperación", () => {
  it("guarda solo el hash del token y vence a los 30 minutos", async () => {
    const user = await makeUser();
    const now = new Date("2026-11-01T12:00:00Z");
    const r = await createPasswordReset("  ANA@test.com ", now);
    expect(r?.email).toBe("ana@test.com");
    const stored = await prisma.passwordResetToken.findFirstOrThrow({ where: { userId: user.id } });
    expect(stored.tokenHash).toBe(hashResetToken(r!.token));
    expect(stored.tokenHash).not.toContain(r!.token);
    expect(stored.expiresAt.getTime()).toBe(now.getTime() + RESET_TTL_MS);
  });

  it("cuenta inexistente o desactivada: no crea nada", async () => {
    await makeUser("off@test.com", { isActive: false });
    expect(await createPasswordReset("nadie@test.com")).toBeNull();
    expect(await createPasswordReset("off@test.com")).toBeNull();
    expect(await prisma.passwordResetToken.count()).toBe(0);
  });

  it("usar el token cambia la clave, sube tokenVersion y no se puede reusar", async () => {
    const user = await makeUser();
    const r = (await createPasswordReset(user.email))!;
    const out = await consumePasswordReset(r.token, await hashPassword("nueva1234"));
    expect(out).toMatchObject({ ok: true, userId: user.id, tokenVersion: user.tokenVersion + 1 });
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await verifyPassword("nueva1234", after.passwordHash)).toBe(true);
    expect(await consumePasswordReset(r.token, await hashPassword("otra12345"))).toEqual({ ok: false, reason: "used" });
  });

  it("pedir uno nuevo invalida el anterior; vencido o inventado no sirve", async () => {
    const user = await makeUser();
    const first = (await createPasswordReset(user.email))!;
    const second = (await createPasswordReset(user.email))!;
    expect(await consumePasswordReset(first.token, "x")).toEqual({ ok: false, reason: "invalid" });
    const later = new Date(Date.now() + RESET_TTL_MS + 1000);
    expect(await consumePasswordReset(second.token, "x", later)).toEqual({ ok: false, reason: "expired" });
    expect(await consumePasswordReset("no-es-un-token", "x")).toEqual({ ok: false, reason: "invalid" });
    expect(await consumePasswordReset("a".repeat(64), "x")).toEqual({ ok: false, reason: "invalid" });
  });

  it("dos usos a la vez del mismo link: solo uno gana", async () => {
    const user = await makeUser();
    const r = (await createPasswordReset(user.email))!;
    const h = await hashPassword("nueva1234");
    const outs = await Promise.all([consumePasswordReset(r.token, h), consumePasswordReset(r.token, h)]);
    expect(outs.filter((o) => o.ok)).toHaveLength(1);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.tokenVersion).toBe(user.tokenVersion + 1);
  });
});

describe("acciones", () => {
  it("pedir el link: misma respuesta exista o no la cuenta; solo se manda mail si existe", async () => {
    await makeUser();
    const yes = await requestPasswordResetAction(null, form({ email: "ana@test.com" }));
    const no = await requestPasswordResetAction(null, form({ email: "nadie@test.com" }));
    expect(yes.ok && no.ok && yes.data.message === no.data.message).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("ana@test.com");
    expect(sent[0].text).toContain("https://bravo.test/reset-password?token=");
  });

  it("sin email configurado avisa en vez de fingir que mandó", async () => {
    mailer.enabled = false;
    await makeUser();
    const r = await requestPasswordResetAction(null, form({ email: "ana@test.com" }));
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining("no está configurada") });
  });

  it("límite: 3 mails por cuenta por hora", async () => {
    await makeUser();
    for (let i = 0; i < 3; i++) expect((await requestPasswordResetAction(null, form({ email: "ana@test.com" }))).ok).toBe(true);
    const blocked = await requestPasswordResetAction(null, form({ email: "ana@test.com" }));
    expect(blocked).toMatchObject({ ok: false, error: expect.stringContaining("demasiados") });
    expect(sent).toHaveLength(3);
  });

  it("elegir la contraseña nueva: valida, deja logueado y cierra las otras sesiones", async () => {
    const user = await makeUser();
    await requestPasswordResetAction(null, form({ email: user.email }));
    const token = tokenFrom(sent[0].text);

    const mismatch = await resetPasswordAction(null, form({ token, newPassword: "nueva1234", confirmPassword: "otra1234" }));
    expect(mismatch).toMatchObject({ ok: false, fieldErrors: { confirmPassword: ["Las contraseñas no coinciden."] } });

    const done = await resetPasswordAction(null, form({ token, newPassword: "nueva1234", confirmPassword: "nueva1234" }));
    expect(done).toMatchObject({ ok: true, data: { next: "/home" } });
    expect(cookieJar.get(SESSION_COOKIE)).toBeTruthy();
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.tokenVersion).toBe(user.tokenVersion + 1);
    expect(await verifyPassword("nueva1234", after.passwordHash)).toBe(true);

    const again = await resetPasswordAction(null, form({ token, newPassword: "otra12345", confirmPassword: "otra12345" }));
    expect(again).toMatchObject({ ok: false, error: expect.stringContaining("ya se usó") });
  });
});
