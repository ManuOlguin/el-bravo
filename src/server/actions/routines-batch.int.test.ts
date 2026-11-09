// src/server/actions/routines-batch.int.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetDb, prisma } from "@/tests/setup/db";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const session = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock("@/src/server/auth/dal", async () => {
  const { AuthError } = await import("@/src/server/auth/errors");
  return {
    AuthError,
    requireUser: vi.fn(async () => {
      if (!session.userId) throw new AuthError("UNAUTHENTICATED");
      return { id: session.userId, email: "me@a.com", name: "Yo", photoUrl: null, timezone: "America/Argentina/Buenos_Aires" };
    }),
  };
});

import { createRoutinesAction } from "./routines";
import type { RoutineInput } from "@/src/schemas/routine";

const oneSet = { kind: "normal" as const, targetReps: 8, targetDurationSeconds: null, targetWeightKg: null, restSeconds: null };
const routine = (name: string, exerciseId: string): RoutineInput => ({ name, notes: null, exercises: [{ exerciseId, restSeconds: null, notes: null, sets: [oneSet] }] });

async function fixtures() {
  const me = await prisma.user.create({ data: { email: "me@a.com", passwordHash: "x", name: "Yo" } });
  const other = await prisma.user.create({ data: { email: "otro@a.com", passwordHash: "x", name: "Otro" } });
  const bench = await prisma.exercise.create({ data: { slug: "press-de-banca", name: "Press de Banca", source: "catalog" } });
  const secret = await prisma.exercise.create({ data: { slug: "secreto-x1", name: "Secreto de Otro", createdByUserId: other.id } });
  return { me, other, bench, secret };
}

describe("createRoutinesAction", () => {
  beforeEach(async () => {
    await resetDb();
    session.userId = null;
  });

  it("pide sesión", async () => {
    const { bench } = await fixtures();
    expect(await createRoutinesAction([routine("A", bench.id)])).toEqual({ ok: false, error: "Tenés que iniciar sesión." });
    expect(await prisma.routine.count()).toBe(0);
  });

  it("crea varias del usuario de la sesión y avisa cuántas", async () => {
    const { me, other, bench } = await fixtures();
    session.userId = me.id;
    const r = await createRoutinesAction([routine("Día 1", bench.id), routine("Día 2", bench.id)]);
    expect(r).toMatchObject({ ok: true, message: "2 rutinas creadas" });
    expect(await prisma.routine.count({ where: { userId: me.id, visibility: "private" } })).toBe(2);
    expect(await prisma.routine.count({ where: { userId: other.id } })).toBe(0);
  });

  it("no deja usar ejercicios privados de otro (y no crea ninguna)", async () => {
    const { me, bench, secret } = await fixtures();
    session.userId = me.id;
    expect(await createRoutinesAction([routine("Día 1", bench.id), routine("Día 2", secret.id)])).toEqual({
      ok: false,
      error: "Alguno de los ejercicios ya no existe. Recargá y probá de nuevo.",
    });
    expect(await prisma.routine.count()).toBe(0);
  });

  it("máximo 7 por vez", async () => {
    const { me, bench } = await fixtures();
    session.userId = me.id;
    const eight = Array.from({ length: 8 }, (_, i) => routine(`R${i}`, bench.id));
    expect(await createRoutinesAction(eight)).toMatchObject({ ok: false, error: "Máximo 7 rutinas por vez" });
    expect(await prisma.routine.count()).toBe(0);
  });
});
