import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetDb, prisma } from "@/tests/setup/db";

vi.mock("server-only", () => ({}));

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

import { getExerciseCatalogAction, getExerciseDetailAction, createExerciseAction } from "./exercises";

async function fixtures() {
  const me = await prisma.user.create({ data: { email: "me@a.com", passwordHash: "x", name: "Yo" } });
  const pecho = await prisma.muscle.create({ data: { name: "Pecho", slug: "pecho", groupKey: "chest" } });
  const triceps = await prisma.muscle.create({ data: { name: "Tríceps", slug: "triceps", groupKey: "arms" } });
  const jalon = await prisma.exercise.create({ data: { slug: "jalon-al-pecho", name: "Jalón al pecho" } });
  session.userId = me.id;
  return { me, pecho, triceps, jalon };
}

describe("exercise actions", () => {
  beforeEach(async () => {
    await resetDb();
    session.userId = null;
  });

  it("piden sesión", async () => {
    expect(await getExerciseCatalogAction()).toEqual({ ok: false, error: "Tenés que iniciar sesión." });
  });

  it("crear por tiempo persiste el tipo", async () => {
    const f = await fixtures();
    const r = await createExerciseAction({
      name: "Plancha lateral", measureType: "duration", equipment: "bodyweight", tracksWeight: false,
      muscles: [{ muscleId: f.pecho.id, percentage: 100 }],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.exercise.measureType).toBe("duration");
    expect(r.message).toMatch(/Plancha lateral/);
    const cat = await getExerciseCatalogAction();
    expect(cat.ok && cat.data.exercises.find((e) => e.name === "Plancha lateral")?.isMine).toBe(true);
  });

  it("nombre duplicado (sin acento) da error y el id existente", async () => {
    const f = await fixtures();
    const r = await createExerciseAction({
      name: "Jalon al pecho", measureType: "reps", equipment: "machine", tracksWeight: true,
      muscles: [{ muscleId: f.pecho.id, percentage: 100 }],
    });
    expect(r).toMatchObject({ ok: false, error: "Ya existe un ejercicio con ese nombre: Jalón al pecho", existing: { id: f.jalon.id, name: "Jalón al pecho" } });
  });

  it("porcentajes que suman 90 dan error de validación en español", async () => {
    const f = await fixtures();
    const r = await createExerciseAction({
      name: "Press raro", measureType: "reps", equipment: "barbell", tracksWeight: true,
      muscles: [{ muscleId: f.pecho.id, percentage: 60 }, { muscleId: f.triceps.id, percentage: 30 }],
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe("Los porcentajes tienen que sumar 100 % (ahora suman 90 %)");
    expect(r.fieldErrors?.muscles).toEqual(["Los porcentajes tienen que sumar 100 % (ahora suman 90 %)"]);
    expect(await prisma.exercise.count()).toBe(1);
  });

  it("detalle: existe / no existe", async () => {
    const f = await fixtures();
    const d = await getExerciseDetailAction(f.jalon.id);
    expect(d).toMatchObject({ ok: true, data: { name: "Jalón al pecho", instructions: [], reviewed: false, description: null } });
    expect(await getExerciseDetailAction("nope")).toEqual({ ok: false, error: "No encontramos ese ejercicio." });
  });
});
