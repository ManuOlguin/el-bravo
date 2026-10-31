import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetDb, prisma } from "@/tests/setup/db";

vi.mock("server-only", () => ({}));

import {
  createRoutine,
  deleteRoutine,
  getRoutineForEditor,
  listRoutines,
  updateRoutine,
  updateRoutineFromWorkout,
  RoutineError,
} from "./service";
import type { NewExerciseInput, RoutineInput } from "@/src/schemas/routine";

async function fixtures() {
  const user = await prisma.user.create({ data: { email: "a@a.com", passwordHash: "x", name: "A" } });
  const other = await prisma.user.create({ data: { email: "b@b.com", passwordHash: "x", name: "B" } });
  const chest = await prisma.muscle.create({ data: { slug: "pectoral", name: "Pectoral", groupKey: "chest" } });
  const core = await prisma.muscle.create({ data: { slug: "abs", name: "Abdominales", groupKey: "core" } });
  const bench = await prisma.exercise.create({
    data: { slug: "press-banca", name: "Press banca", muscles: { create: [{ muscleId: chest.id, percentage: 100 }] } },
  });
  const plank = await prisma.exercise.create({
    data: {
      slug: "plancha", name: "Plancha", measureType: "duration", tracksWeight: false, equipment: "bodyweight",
      muscles: { create: [{ muscleId: core.id, percentage: 100 }] },
    },
  });
  const privateOfOther = await prisma.exercise.create({ data: { slug: "secreto", name: "Secreto", createdByUserId: other.id } });
  const cat = await prisma.activityCategory.create({ data: { slug: "strength", name: "Fuerza", usesExercises: true } });
  return { user, other, bench, plank, privateOfOther, cat };
}

const routineInput = (benchId: string, plankId: string): RoutineInput => ({
  name: "Pecho y core",
  notes: null,
  exercises: [
    { exerciseId: plankId, restSeconds: 30, notes: null, sets: [{ kind: "normal", targetReps: null, targetDurationSeconds: 45, targetWeightKg: null, restSeconds: null }] },
    {
      exerciseId: benchId, restSeconds: 120, notes: "codos a 45°",
      sets: [
        { kind: "warmup", targetReps: 12, targetDurationSeconds: null, targetWeightKg: 20, restSeconds: 60 },
        { kind: "normal", targetReps: 10, targetDurationSeconds: null, targetWeightKg: 40, restSeconds: null },
        { kind: "normal", targetReps: 8, targetDurationSeconds: null, targetWeightKg: 45, restSeconds: null },
        { kind: "failure", targetReps: 6, targetDurationSeconds: null, targetWeightKg: 50, restSeconds: null },
      ],
    },
  ],
});

describe("routines service", () => {
  beforeEach(resetDb);

  it("crea con un ejercicio por tiempo y pesos distintos por serie, conservando el orden", async () => {
    const { user, bench, plank } = await fixtures();
    const { routineId } = await createRoutine(user.id, routineInput(bench.id, plank.id));
    const r = await getRoutineForEditor(user.id, routineId);
    expect(r.name).toBe("Pecho y core");
    expect(r.exercises.map((e) => e.exercise.name)).toEqual(["Plancha", "Press banca"]);
    expect(r.exercises[0].exercise).toMatchObject({ measureType: "duration", tracksWeight: false, primaryGroupKey: "core" });
    expect(r.exercises[0].sets[0]).toMatchObject({ targetDurationSeconds: 45, targetReps: null });
    expect(r.exercises[1]).toMatchObject({ restSeconds: 120, notes: "codos a 45°" });
    expect(r.exercises[1].sets.map((s) => [s.kind, s.targetReps, s.targetWeightKg, s.restSeconds])).toEqual([
      ["warmup", 12, 20, 60],
      ["normal", 10, 40, null],
      ["normal", 8, 45, null],
      ["failure", 6, 50, null],
    ]);
  });

  it("otro usuario no puede leer, editar ni borrar la rutina", async () => {
    const { user, other, bench, plank } = await fixtures();
    const { routineId } = await createRoutine(user.id, routineInput(bench.id, plank.id));
    await expect(getRoutineForEditor(other.id, routineId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(updateRoutine(other.id, routineId, routineInput(bench.id, plank.id))).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(deleteRoutine(other.id, routineId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await listRoutines(other.id)).toEqual([]);
  });

  it("la actualización es atómica: con un ejercicio inexistente la rutina queda intacta", async () => {
    const { user, bench, plank } = await fixtures();
    const { routineId } = await createRoutine(user.id, routineInput(bench.id, plank.id));
    const broken = routineInput(bench.id, "no-existe");
    broken.name = "Cambiada";
    await expect(updateRoutine(user.id, routineId, broken)).rejects.toBeInstanceOf(RoutineError);
    const r = await getRoutineForEditor(user.id, routineId);
    expect(r.name).toBe("Pecho y core");
    expect(r.exercises).toHaveLength(2);
    expect(r.exercises[1].sets).toHaveLength(4);
  });

  it("no deja usar ejercicios privados de otro usuario", async () => {
    const { user, bench, privateOfOther } = await fixtures();
    await expect(createRoutine(user.id, routineInput(bench.id, privateOfOther.id))).rejects.toBeInstanceOf(RoutineError);
    expect(await prisma.routine.count()).toBe(0);
  });

  it("actualiza reemplazando ejercicios y series", async () => {
    const { user, bench, plank } = await fixtures();
    const { routineId } = await createRoutine(user.id, routineInput(bench.id, plank.id));
    const next = routineInput(bench.id, plank.id);
    next.name = "Solo banca";
    next.exercises = [next.exercises[1]];
    await updateRoutine(user.id, routineId, next);
    const r = await getRoutineForEditor(user.id, routineId);
    expect(r.name).toBe("Solo banca");
    expect(r.exercises.map((e) => e.exercise.name)).toEqual(["Press banca"]);
    expect(await prisma.routineSet.count()).toBe(4);
  });

  it("borrar la rutina conserva los entrenamientos (routineId → null)", async () => {
    const { user, bench, plank, cat } = await fixtures();
    const { routineId } = await createRoutine(user.id, routineInput(bench.id, plank.id));
    const a = await prisma.activity.create({ data: { userId: user.id, activityCategoryId: cat.id, routineId, startedAt: new Date(), durationMinutes: 40 } });
    await deleteRoutine(user.id, routineId);
    expect(await prisma.routine.count()).toBe(0);
    expect((await prisma.activity.findUniqueOrThrow({ where: { id: a.id } })).routineId).toBeNull();
  });

  it("lista con conteos, grupos musculares y último uso", async () => {
    const { user, bench, plank, cat } = await fixtures();
    const { routineId } = await createRoutine(user.id, routineInput(bench.id, plank.id));
    const used = new Date("2026-10-30T21:00:00Z");
    await prisma.activity.create({ data: { userId: user.id, activityCategoryId: cat.id, routineId, startedAt: used, durationMinutes: 40 } });
    const [item] = await listRoutines(user.id);
    expect(item).toMatchObject({ id: routineId, exerciseCount: 2, setCount: 5, groupKeys: ["chest", "core"] });
    expect(item.lastUsedAt?.toISOString()).toBe(used.toISOString());
  });

  it("actualiza la rutina con los valores de un entrenamiento", async () => {
    const { user, bench, plank, cat } = await fixtures();
    const { routineId } = await createRoutine(user.id, routineInput(bench.id, plank.id));
    await updateRoutineFromWorkout(user.id, routineId, {
      clientRequestId: "x", activityCategoryId: cat.id, localDate: "2026-10-31", localTime: "18:00", durationMinutes: 40, routineId,
      exercises: [
        { exerciseId: bench.id, notes: null, sets: [
          { kind: "normal", reps: 10, durationSeconds: null, weightKg: 42.5, restSeconds: 90, completed: true },
          { kind: "normal", reps: 9, durationSeconds: null, weightKg: 47.5, restSeconds: 90, completed: true },
        ] },
      ],
    });
    const r = await getRoutineForEditor(user.id, routineId);
    expect(r.name).toBe("Pecho y core");
    expect(r.exercises).toHaveLength(1);
    expect(r.exercises[0].restSeconds).toBe(90);
    expect(r.exercises[0].sets.map((s) => [s.targetReps, s.targetWeightKg, s.restSeconds])).toEqual([[10, 42.5, null], [9, 47.5, null]]);
  });

  describe("ejercicios nuevos (new:<tempId>)", () => {
    const oneSet = { kind: "normal" as const, targetReps: 8, targetDurationSeconds: null, targetWeightKg: null, restSeconds: null };
    const draft = (over: Partial<NewExerciseInput> = {}): NewExerciseInput => ({
      tempId: "t1", name: "Remo Hammer", nameEn: null, measureType: "reps", equipment: "machine", tracksWeight: true, muscles: [], source: "user", ...over,
    });

    it("crea los ejercicios nuevos en la misma transacción y los usa", async () => {
      const { user, bench } = await fixtures();
      const { routineId } = await createRoutine(user.id, {
        name: "Importada",
        newExercises: [draft({ muscles: [{ muscleSlug: "pectoral", percentage: 100 }] })],
        exercises: [
          { exerciseId: bench.id, restSeconds: null, notes: null, sets: [{ ...oneSet, targetWeightKg: 60 }] },
          { exerciseId: "new:t1", restSeconds: null, notes: null, sets: [{ ...oneSet, targetReps: 12 }] },
        ],
      });
      const created = await prisma.exercise.findFirstOrThrow({ where: { name: "Remo Hammer" }, include: { muscles: true } });
      expect(created.createdByUserId).toBe(user.id);
      expect(created.equipment).toBe("machine");
      expect(created.muscles).toHaveLength(1);
      const r = await getRoutineForEditor(user.id, routineId);
      expect(r.exercises.map((e) => e.exercise.id)).toEqual([bench.id, created.id]);
    });

    it("el mismo new: usado dos veces crea un solo ejercicio", async () => {
      const { user } = await fixtures();
      await createRoutine(user.id, {
        name: "X",
        newExercises: [draft()],
        exercises: [
          { exerciseId: "new:t1", restSeconds: null, notes: null, sets: [oneSet] },
          { exerciseId: "new:t1", restSeconds: null, notes: null, sets: [oneSet] },
        ],
      });
      expect(await prisma.exercise.count({ where: { createdByUserId: user.id } })).toBe(1);
      expect(await prisma.routineExercise.count()).toBe(2);
    });

    it("si ya hay uno visible con ese nombre (sin importar mayúsculas ni acentos), lo reusa en vez de duplicar", async () => {
      const { user, bench } = await fixtures();
      await createRoutine(user.id, {
        name: "X",
        newExercises: [draft({ name: "PRÉSS  banca", equipment: "barbell" })],
        exercises: [{ exerciseId: "new:t1", restSeconds: null, notes: null, sets: [oneSet] }],
      });
      expect(await prisma.exercise.count({ where: { createdByUserId: user.id } })).toBe(0);
      expect(await prisma.routineExercise.findFirstOrThrow({ select: { exerciseId: true } })).toEqual({ exerciseId: bench.id });
    });

    it("un ejercicio privado de otro usuario con el mismo nombre no cuenta: se crea uno propio", async () => {
      const { user, privateOfOther } = await fixtures();
      await createRoutine(user.id, {
        name: "X",
        newExercises: [draft({ name: "Secreto" })],
        exercises: [{ exerciseId: "new:t1", restSeconds: null, notes: null, sets: [oneSet] }],
      });
      const mine = await prisma.exercise.findFirstOrThrow({ where: { createdByUserId: user.id } });
      expect(mine.id).not.toBe(privateOfOther.id);
      expect(mine.name).toBe("Secreto");
    });

    it("renormaliza los porcentajes a 100 y descarta músculos desconocidos", async () => {
      const { user } = await fixtures();
      await createRoutine(user.id, {
        name: "X",
        newExercises: [draft({ muscles: [
          { muscleSlug: "pectoral", percentage: 60 },
          { muscleSlug: "no-existe", percentage: 40 },
          { muscleSlug: "abs", percentage: 60 },
        ] })],
        exercises: [{ exerciseId: "new:t1", restSeconds: null, notes: null, sets: [oneSet] }],
      });
      const created = await prisma.exercise.findFirstOrThrow({ where: { createdByUserId: user.id }, include: { muscles: { include: { muscle: true } } } });
      expect(created.muscles.map((m) => [m.muscle.slug, m.percentage]).sort()).toEqual([["abs", 50], ["pectoral", 50]]);
    });

    it("también funciona al actualizar una rutina", async () => {
      const { user, bench, plank } = await fixtures();
      const { routineId } = await createRoutine(user.id, routineInput(bench.id, plank.id));
      await updateRoutine(user.id, routineId, {
        name: "Editada",
        newExercises: [draft()],
        exercises: [{ exerciseId: "new:t1", restSeconds: null, notes: null, sets: [oneSet] }],
      });
      const r = await getRoutineForEditor(user.id, routineId);
      expect(r.exercises.map((e) => e.exercise.name)).toEqual(["Remo Hammer"]);
    });

    it("un new: sin su definición falla y no deja nada creado", async () => {
      const { user } = await fixtures();
      await expect(
        createRoutine(user.id, { name: "X", exercises: [{ exerciseId: "new:t9", restSeconds: null, notes: null, sets: [oneSet] }] }),
      ).rejects.toBeInstanceOf(RoutineError);
      expect(await prisma.routine.count()).toBe(0);
    });

    it("si falla el guardado, el ejercicio nuevo tampoco queda creado", async () => {
      const { user } = await fixtures();
      await expect(
        createRoutine(user.id, {
          name: "X",
          newExercises: [draft()],
          exercises: [
            { exerciseId: "new:t1", restSeconds: null, notes: null, sets: [oneSet] },
            { exerciseId: "no-existe", restSeconds: null, notes: null, sets: [oneSet] },
          ],
        }),
      ).rejects.toBeInstanceOf(RoutineError);
      expect(await prisma.exercise.count({ where: { createdByUserId: user.id } })).toBe(0);
    });
  });
});
