import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetDb, prisma } from "@/tests/setup/db";
import { localDateToDbDate } from "@/src/lib/time";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const TZ = "America/Argentina/Buenos_Aires";
const session = vi.hoisted(() => ({ user: null as null | { id: string; email: string; name: string | null; photoUrl: string | null; timezone: string } }));
vi.mock("@/src/server/auth/dal", async () => {
  const { AuthError } = await import("@/src/server/auth/errors");
  const requireUser = async () => {
    if (!session.user) throw new AuthError("UNAUTHENTICATED");
    return session.user;
  };
  return { AuthError, getSession: async () => session.user, requireUser, requirePageUser: requireUser };
});

import { revalidatePath } from "next/cache";
import {
  createActivityAction,
  deleteActivityAction,
  getLastPerformanceAction,
  listActivityCategoriesAction,
  updateActivityAction,
} from "./activities";
import type { ActivityInput } from "@/src/schemas/workout";

const as = (u: { id: string; email: string; name: string | null }) => {
  session.user = { id: u.id, email: u.email, name: u.name, photoUrl: null, timezone: TZ };
};

async function setup() {
  const user = await prisma.user.create({ data: { email: "a@a.com", passwordHash: "x", name: "A" } });
  const other = await prisma.user.create({ data: { email: "b@b.com", passwordHash: "x", name: "B" } });
  const strength = await prisma.activityCategory.create({ data: { slug: "strength", name: "Fuerza", sortOrder: 1, usesExercises: true } });
  const running = await prisma.activityCategory.create({ data: { slug: "running", name: "Running", sortOrder: 2 } });
  const bench = await prisma.exercise.create({ data: { slug: "press-banca", name: "Press banca" } });
  const group = await prisma.group.create({ data: { name: "Los Bravos", timezone: TZ, members: { create: [{ userId: user.id, role: "admin" }] } } });
  // Temporada pasada pero sin finalizar: los entrenamientos de septiembre cuentan.
  const season = await prisma.season.create({
    data: {
      groupId: group.id, name: "Primavera", startDate: localDateToDbDate("2026-09-07"), endDate: localDateToDbDate("2026-09-27"),
      members: { create: [{ userId: user.id }] },
      categories: { create: [{ activityCategoryId: strength.id, weight: 1 }, { activityCategoryId: running.id, weight: 1 }] },
    },
  });
  return { user, other, strength, running, bench, group, season };
}

const input = (catId: string, o: Partial<ActivityInput> = {}): ActivityInput => ({
  clientRequestId: `req-${Math.random().toString(36).slice(2)}`,
  activityCategoryId: catId,
  localDate: "2026-09-08",
  localTime: "07:00",
  durationMinutes: 40,
  notes: null,
  routineId: null,
  exercises: [],
  ...o,
});

beforeEach(async () => {
  await resetDb();
  session.user = null;
  vi.mocked(revalidatePath).mockClear();
});

describe("createActivityAction", () => {
  it("exige sesión", async () => {
    const { running } = await setup();
    const r = await createActivityAction(input(running.id));
    expect(r).toEqual({ ok: false, error: "Tenés que iniciar sesión." });
  });

  it("crea, devuelve puntos por temporada y revalida", async () => {
    const { user, running, group, season } = await setup();
    as(user);
    const r = await createActivityAction(input(running.id));
    if (!r.ok) throw new Error(r.error);
    expect(r.data.replayed).toBe(false);
    expect(r.data.sharedDaySeasonIds).toEqual([]);
    expect(r.data.effects.scoring).toEqual([
      expect.objectContaining({ seasonId: season.id, seasonName: "Primavera", groupName: "Los Bravos", activityPoints: 22, totalBefore: 0, totalAfter: 22 }),
    ]);
    expect(revalidatePath).toHaveBeenCalledWith("/home");
    expect(revalidatePath).toHaveBeenCalledWith(`/group/${group.id}`);
  });

  it("una segunda actividad el mismo día suma el marginal (40 → 70 min = +5)", async () => {
    const { user, running, strength } = await setup();
    as(user);
    await createActivityAction(input(running.id));
    const r = await createActivityAction(input(strength.id, { localTime: "19:00", durationMinutes: 30 }));
    if (!r.ok) throw new Error(r.error);
    expect(r.data.effects.scoring[0]).toMatchObject({ activityPoints: 5, totalBefore: 22, totalAfter: 27 });
    expect(r.data.sharedDaySeasonIds).toEqual([r.data.effects.scoring[0].seasonId]);
  });

  it("un reintento con el mismo clientRequestId no duplica y devuelve los puntos actuales", async () => {
    const { user, running } = await setup();
    as(user);
    const body = input(running.id, { clientRequestId: "retry-1" });
    const a = await createActivityAction(body);
    const b = await createActivityAction(body);
    if (!a.ok || !b.ok) throw new Error("falló");
    expect(b.data.activityId).toBe(a.data.activityId);
    expect(b.data.replayed).toBe(true);
    expect(b.data.effects.scoring[0]).toMatchObject({ activityPoints: 22, totalAfter: 22 });
    expect(await prisma.activity.count()).toBe(1);
  });

  it("valida con mensajes en español por campo", async () => {
    const { user, strength, bench } = await setup();
    as(user);
    const r = await createActivityAction(
      input(strength.id, { durationMinutes: 0, exercises: [{ exerciseId: bench.id, notes: null, sets: [{ kind: "normal", reps: null, durationSeconds: null, weightKg: 40, restSeconds: null, completed: true }] }] })
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.fieldErrors?.durationMinutes).toEqual(["La duración mínima es 1 minuto"]);
    expect(r.fieldErrors?.["exercises.0.sets.0.reps"]).toEqual(["Cada serie necesita repeticiones o tiempo"]);
  });

  it("una categoría inexistente devuelve un error entendible", async () => {
    const { user } = await setup();
    as(user);
    const r = await createActivityAction(input("no-existe"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/ya no existe/);
  });
});

describe("updateActivityAction / deleteActivityAction", () => {
  it("editar pasando a otro día recalcula los puntos", async () => {
    const { user, running } = await setup();
    as(user);
    const a = await createActivityAction(input(running.id));
    const b = await createActivityAction(input(running.id, { localTime: "19:00", durationMinutes: 30 }));
    if (!a.ok || !b.ok) throw new Error("falló");
    const r = await updateActivityAction(b.data.activityId, input(running.id, { localDate: "2026-09-09", localTime: "19:00", durationMinutes: 30 }));
    if (!r.ok) throw new Error(r.error);
    // Día propio de 30 min = 20 pts (antes era el marginal de +5).
    expect(r.data.effects.scoring[0]).toMatchObject({ activityPoints: 20, totalBefore: 27, totalAfter: 42 });
  });

  it("otro usuario no puede editar ni borrar", async () => {
    const { user, other, running } = await setup();
    as(user);
    const a = await createActivityAction(input(running.id));
    if (!a.ok) throw new Error(a.error);
    as(other);
    expect(await updateActivityAction(a.data.activityId, input(running.id))).toEqual({ ok: false, error: "No encontramos lo que buscabas." });
    expect(await deleteActivityAction(a.data.activityId)).toEqual({ ok: false, error: "No encontramos lo que buscabas." });
    expect(await prisma.activity.count()).toBe(1);
  });

  it("borrar baja los puntos", async () => {
    const { user, running } = await setup();
    as(user);
    const a = await createActivityAction(input(running.id));
    if (!a.ok) throw new Error(a.error);
    const r = await deleteActivityAction(a.data.activityId);
    if (!r.ok) throw new Error(r.error);
    expect(r.data.effects.scoring[0]).toMatchObject({ totalBefore: 22, totalAfter: 0 });
    expect(await prisma.activity.count()).toBe(0);
  });
});

describe("lecturas", () => {
  it("lista categorías con las más usadas primero", async () => {
    const { user, running } = await setup();
    as(user);
    await createActivityAction(input(running.id));
    const r = await listActivityCategoriesAction();
    if (!r.ok) throw new Error(r.error);
    expect(r.data.map((c) => c.slug)).toEqual(["running", "strength"]);
    expect(r.data[1]).toMatchObject({ usesExercises: true, name: "Fuerza" });
  });

  it("devuelve las series de la última vez por ejercicio", async () => {
    const { user, strength, bench } = await setup();
    as(user);
    const set = (reps: number, weightKg: number) => ({ kind: "normal" as const, reps, durationSeconds: null, weightKg, restSeconds: null, completed: true });
    await createActivityAction(input(strength.id, { localDate: "2026-09-08", exercises: [{ exerciseId: bench.id, notes: null, sets: [set(10, 40)] }] }));
    const last = await createActivityAction(input(strength.id, { localDate: "2026-09-10", exercises: [{ exerciseId: bench.id, notes: null, sets: [set(10, 45), set(8, 50)] }] }));
    if (!last.ok) throw new Error(last.error);
    const r = await getLastPerformanceAction([bench.id, "otro"]);
    if (!r.ok) throw new Error(r.error);
    expect(r.data[bench.id].map((s) => [s.reps, s.weightKg])).toEqual([[10, 45], [8, 50]]);
    expect(r.data.otro).toBeUndefined();
    const excluding = await getLastPerformanceAction([bench.id], last.data.activityId);
    if (!excluding.ok) throw new Error(excluding.error);
    expect(excluding.data[bench.id].map((s) => s.weightKg)).toEqual([40]);
  });
});
