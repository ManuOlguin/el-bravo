import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetDb, prisma } from "@/tests/setup/db";

vi.mock("server-only", () => ({}));

vi.mock("@/src/server/activities/effects", async (orig) => ({
  ...(await orig<typeof import("@/src/server/activities/effects")>()),
  runActivityEffects: vi.fn(async () => ({ scoring: [], badges: [] })),
}));

import { createActivity, updateActivity, deleteActivity, getActivityForEdit } from "./service";
import { runActivityEffects } from "./effects";

async function fixtures() {
  const user = await prisma.user.create({ data: { email: "a@a.com", passwordHash: "x", name: "A" } });
  const other = await prisma.user.create({ data: { email: "b@b.com", passwordHash: "x", name: "B" } });
  const cat = await prisma.activityCategory.create({ data: { slug: "strength", name: "Fuerza", usesExercises: true } });
  const ex = await prisma.exercise.create({ data: { slug: "press-banca", name: "Press banca" } });
  return { user, other, cat, ex };
}

const input = (catId: string, exId: string) => ({
  clientRequestId: "req-1", activityCategoryId: catId, localDate: "2026-10-30", localTime: "18:00", durationMinutes: 70,
  exercises: [{ exerciseId: exId, sets: [{ kind: "normal" as const, reps: 10, weightKg: 40, durationSeconds: null, restSeconds: 90, completed: true }, { kind: "normal" as const, reps: 8, weightKg: 45, durationSeconds: null, restSeconds: null, completed: true }] }],
});

describe("activity service", () => {
  beforeEach(async () => { await resetDb(); vi.mocked(runActivityEffects).mockClear(); });

  it("crea con hora local → UTC, series en orden y dispara efectos", async () => {
    const { user, cat, ex } = await fixtures();
    const { activityId } = await createActivity(user.id, input(cat.id, ex.id));
    const a = await prisma.activity.findUniqueOrThrow({ where: { id: activityId }, include: { exercises: { include: { sets: { orderBy: { position: "asc" } } } } } });
    expect(a.startedAt.toISOString()).toBe("2026-10-30T21:00:00.000Z"); // timezone del usuario (AR)
    expect(a.exercises[0].sets.map((s) => s.weightKg)).toEqual([40, 45]);
    expect(runActivityEffects).toHaveBeenCalledWith({ userId: user.id, before: null, after: expect.objectContaining({ id: activityId }) });
  });

  it("es idempotente por clientRequestId (reintento no duplica)", async () => {
    const { user, cat, ex } = await fixtures();
    const a = await createActivity(user.id, input(cat.id, ex.id));
    const b = await createActivity(user.id, input(cat.id, ex.id));
    expect(b.activityId).toBe(a.activityId);
    expect(await prisma.activity.count()).toBe(1);
  });

  it("doble envío concurrente con el mismo clientRequestId crea una sola actividad", async () => {
    const { user, cat, ex } = await fixtures();
    const [a, b] = await Promise.all([createActivity(user.id, input(cat.id, ex.id)), createActivity(user.id, input(cat.id, ex.id))]);
    expect(b.activityId).toBe(a.activityId);
    expect(await prisma.activity.count()).toBe(1);
  });

  it("crea una actividad sin ejercicios (running)", async () => {
    const { user } = await fixtures();
    const run = await prisma.activityCategory.create({ data: { slug: "running", name: "Running" } });
    const { activityId } = await createActivity(user.id, { ...input(run.id, "x"), clientRequestId: "req-run", exercises: [] });
    const a = await prisma.activity.findUniqueOrThrow({ where: { id: activityId }, include: { exercises: true } });
    expect(a.durationMinutes).toBe(70);
    expect(a.exercises).toHaveLength(0);
  });

  it("si un ejercicio no existe, no queda nada a medias", async () => {
    const { user, cat } = await fixtures();
    await expect(createActivity(user.id, input(cat.id, "no-existe"))).rejects.toThrow();
    expect(await prisma.activity.count()).toBe(0);
  });

  it("rechaza rutina ajena", async () => {
    const { user, other, cat, ex } = await fixtures();
    const r = await prisma.routine.create({ data: { name: "R", userId: other.id } });
    await expect(createActivity(user.id, { ...input(cat.id, ex.id), routineId: r.id })).rejects.toThrow("FORBIDDEN");
  });

  it("edita reemplazando ejercicios y pasa before/after a los efectos", async () => {
    const { user, cat, ex } = await fixtures();
    const { activityId } = await createActivity(user.id, input(cat.id, ex.id));
    await updateActivity(user.id, activityId, { ...input(cat.id, ex.id), clientRequestId: "req-2", localTime: "07:00", exercises: [] });
    const a = await prisma.activity.findUniqueOrThrow({ where: { id: activityId }, include: { exercises: true } });
    expect(a.startedAt.toISOString()).toBe("2026-10-30T10:00:00.000Z");
    expect(a.exercises).toHaveLength(0);
    const call = vi.mocked(runActivityEffects).mock.calls.at(-1)![0];
    expect(call.before?.startedAt.toISOString()).toBe("2026-10-30T21:00:00.000Z");
    expect(call.after?.startedAt.toISOString()).toBe("2026-10-30T10:00:00.000Z");
  });

  it("solo el dueño edita/borra; borrar es duro", async () => {
    const { user, other, cat, ex } = await fixtures();
    const { activityId } = await createActivity(user.id, input(cat.id, ex.id));
    await expect(deleteActivity(other.id, activityId)).rejects.toThrow("NOT_FOUND");
    await deleteActivity(user.id, activityId);
    expect(await prisma.activity.count()).toBe(0);
    expect(await prisma.activitySet.count()).toBe(0);
  });

  it("getActivityForEdit devuelve fecha/hora local", async () => {
    const { user, cat, ex } = await fixtures();
    const { activityId } = await createActivity(user.id, input(cat.id, ex.id));
    const e = await getActivityForEdit(user.id, activityId);
    expect(e).toMatchObject({ localDate: "2026-10-30", localTime: "18:00", durationMinutes: 70 });
    expect(e.exercises[0].sets).toHaveLength(2);
  });
});
