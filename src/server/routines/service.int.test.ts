import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetDb, prisma } from "@/tests/setup/db";

vi.mock("server-only", () => ({}));

import {
  copyRoutine,
  createRoutine,
  deleteRoutine,
  getPublicRoutine,
  getRoutineForEditor,
  listPublicRoutines,
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

    it("dos ejercicios nuevos distintos con nombre sin letras latinas crean dos ejercicios (no se mapean al mismo)", async () => {
      const { user } = await fixtures();
      const { routineId } = await createRoutine(user.id, {
        name: "X",
        newExercises: [draft({ tempId: "t1", name: "Жим лёжа" }), draft({ tempId: "t2", name: "Тяга" })],
        exercises: [
          { exerciseId: "new:t1", restSeconds: null, notes: null, sets: [oneSet] },
          { exerciseId: "new:t2", restSeconds: null, notes: null, sets: [oneSet] },
          { exerciseId: "new:t1", restSeconds: null, notes: null, sets: [oneSet] },
        ],
      });
      expect(await prisma.exercise.count({ where: { createdByUserId: user.id } })).toBe(2);
      const ids = (await getRoutineForEditor(user.id, routineId)).exercises.map((e) => e.exercise.id);
      expect(ids[0]).not.toBe(ids[1]);
      expect(ids[2]).toBe(ids[0]);
    });

    it("un nombre solo-emoji que el usuario ya tiene (la colación de la base los considera iguales) se reusa en vez de chocar con el único (dueño, nombre)", async () => {
      const { user } = await fixtures();
      const mine = await prisma.exercise.create({ data: { slug: "mio-emoji", name: "💪💪", createdByUserId: user.id } });
      const { routineId } = await createRoutine(user.id, {
        name: "X",
        newExercises: [draft({ name: "💪💪" })],
        exercises: [{ exerciseId: "new:t1", restSeconds: null, notes: null, sets: [oneSet] }],
      });
      expect((await getRoutineForEditor(user.id, routineId)).exercises[0].exercise.id).toBe(mine.id);
      expect(await prisma.exercise.count({ where: { createdByUserId: user.id } })).toBe(1);
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

describe("rutinas públicas (fase 2)", () => {
  beforeEach(resetDb);

  const workoutWithBench = (catId: string, routineId: string, benchId: string) => ({
    clientRequestId: "x", activityCategoryId: catId, localDate: "2026-10-31", localTime: "18:00", durationMinutes: 40, routineId,
    exercises: [{ exerciseId: benchId, notes: null, sets: [{ kind: "normal" as const, reps: 10, durationSeconds: null, weightKg: 40, restSeconds: null, completed: true }] }],
  });

  it("se crea privada; la visibilidad se guarda y editar sin mandarla no la cambia", async () => {
    const { user, bench, plank, cat } = await fixtures();
    const { routineId } = await createRoutine(user.id, routineInput(bench.id, plank.id));
    const visibility = async () => (await getRoutineForEditor(user.id, routineId)).visibility;
    expect(await visibility()).toBe("private");
    await updateRoutine(user.id, routineId, { ...routineInput(bench.id, plank.id), visibility: "public" });
    expect(await visibility()).toBe("public");
    await updateRoutine(user.id, routineId, routineInput(bench.id, plank.id));
    expect(await visibility()).toBe("public");
    await updateRoutineFromWorkout(user.id, routineId, workoutWithBench(cat.id, routineId, bench.id));
    expect(await visibility()).toBe("public");
  });

  it("una pública ajena se ve con su autor, pero no se edita, ni se borra, ni se abre en el editor", async () => {
    const { user, other, bench, plank } = await fixtures();
    const { routineId } = await createRoutine(other.id, { ...routineInput(bench.id, plank.id), visibility: "public" });
    const view = await getPublicRoutine(user.id, routineId);
    expect(view).toMatchObject({ id: routineId, name: "Pecho y core", visibility: "public", isOwner: false, copiedFromUserName: null, owner: { id: other.id, name: "B" } });
    expect(view.exercises.map((e) => e.exercise.name)).toEqual(["Plancha", "Press banca"]);
    expect(JSON.stringify(view)).not.toContain("b@b.com");
    await expect(getRoutineForEditor(user.id, routineId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(updateRoutine(user.id, routineId, routineInput(bench.id, plank.id))).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(deleteRoutine(user.id, routineId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await prisma.routine.count()).toBe(1);
  });

  it("IDOR: la privada de otro no se ve (NOT_FOUND, no FORBIDDEN)", async () => {
    const { user, other, bench, plank } = await fixtures();
    const { routineId } = await createRoutine(other.id, routineInput(bench.id, plank.id));
    await expect(getPublicRoutine(user.id, routineId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getPublicRoutine(user.id, "no-existe")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("el dueño ve la suya aunque sea privada; la pública de un usuario desactivado no se ve", async () => {
    const { user, other, bench, plank } = await fixtures();
    const mine = await createRoutine(user.id, routineInput(bench.id, plank.id));
    expect(await getPublicRoutine(user.id, mine.routineId)).toMatchObject({ isOwner: true, visibility: "private", owner: { id: user.id } });
    const theirs = await createRoutine(other.id, { ...routineInput(bench.id, plank.id), visibility: "public" });
    await prisma.user.update({ where: { id: other.id }, data: { isActive: false } });
    await expect(getPublicRoutine(user.id, theirs.routineId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await listPublicRoutines(other.id)).toEqual([]);
  });

  it("listPublicRoutines: solo las públicas de ese dueño, con conteos y sin último uso", async () => {
    const { user, other, bench, plank } = await fixtures();
    await createRoutine(other.id, routineInput(bench.id, plank.id));
    const pub = await createRoutine(other.id, { ...routineInput(bench.id, plank.id), name: "La pública", visibility: "public" });
    await createRoutine(user.id, { ...routineInput(bench.id, plank.id), visibility: "public" });
    expect(await listPublicRoutines(other.id)).toEqual([
      { id: pub.routineId, name: "La pública", exerciseCount: 2, setCount: 5, groupKeys: ["chest", "core"], visibility: "public", copiedFromUserName: null },
    ]);
    expect((await listRoutines(other.id)).map((r) => r.visibility).sort()).toEqual(["private", "public"]);
  });
});

const oneSet = (o: Partial<RoutineInput["exercises"][number]["sets"][number]> = {}) => ({
  kind: "normal" as const, targetReps: 10, targetDurationSeconds: null, targetWeightKg: null, restSeconds: null, ...o,
});

/** `other` ("B") tiene un ejercicio propio "Remo Hammer" y una rutina pública que lo usa junto con uno del catálogo. */
async function publicFixtures() {
  const base = await fixtures();
  const pectoral = await prisma.muscle.findUniqueOrThrow({ where: { slug: "pectoral" } });
  const hammer = await prisma.exercise.create({
    data: {
      slug: "remo-hammer-b", name: "Remo Hammer", nameEn: "Hammer row", description: "Con el pecho apoyado.",
      instructions: ["Apoyá el pecho", "Tirá con los codos"], equipment: "machine", measureType: "reps", tracksWeight: true,
      createdByUserId: base.other.id,
      muscles: { create: [{ muscleId: pectoral.id, percentage: 100 }] },
      aliases: { create: [{ alias: "remo maquina hammer" }] },
    },
  });
  const { routineId } = await createRoutine(base.other.id, {
    name: "Espalda de B", notes: "al fallo la última", visibility: "public",
    exercises: [
      { exerciseId: base.bench.id, restSeconds: 90, notes: null, sets: [oneSet({ targetReps: 8, targetWeightKg: 60 }), oneSet({ targetReps: 8, targetWeightKg: 60 })] },
      { exerciseId: hammer.id, restSeconds: null, notes: "lento", sets: [oneSet({ kind: "failure", targetReps: 12 })] },
    ],
  });
  return { ...base, pectoral, hammer, publicId: routineId };
}

describe("copiar rutinas (fase 2)", () => {
  beforeEach(resetDb);

  it("copiar una pública ajena: referencia el catálogo, duplica el ejercicio propio del autor y guarda el origen", async () => {
    const { user, bench, hammer, pectoral, publicId } = await publicFixtures();
    const { routineId, own } = await copyRoutine(user.id, publicId);
    expect(own).toBe(false);
    expect(await prisma.routine.findUniqueOrThrow({ where: { id: routineId } })).toMatchObject({
      userId: user.id, name: "Espalda de B", notes: "al fallo la última", visibility: "private",
      copiedFromRoutineId: publicId, copiedFromUserName: "B",
    });
    const r = await getRoutineForEditor(user.id, routineId);
    expect(r.exercises[0].exercise.id).toBe(bench.id);
    const dupId = r.exercises[1].exercise.id;
    expect(dupId).not.toBe(hammer.id);
    const dup = await prisma.exercise.findUniqueOrThrow({ where: { id: dupId }, include: { muscles: true, aliases: true } });
    expect(dup).toMatchObject({
      name: "Remo Hammer", nameEn: "Hammer row", description: "Con el pecho apoyado.", instructions: ["Apoyá el pecho", "Tirá con los codos"],
      equipment: "machine", measureType: "reps", tracksWeight: true, createdByUserId: user.id,
    });
    expect(dup.muscles.map((m) => [m.muscleId, m.percentage])).toEqual([[pectoral.id, 100]]);
    expect(dup.aliases.map((a) => a.alias)).toEqual(["remo maquina hammer"]);
    expect(r.exercises.map((e) => [e.restSeconds, e.notes, e.sets.map((s) => [s.kind, s.targetReps, s.targetWeightKg])])).toEqual([
      [90, null, [["normal", 8, 60], ["normal", 8, 60]]],
      [null, "lento", [["failure", 12, null]]],
    ]);
    // El original no se tocó.
    expect(await prisma.routineExercise.count({ where: { routineId: publicId } })).toBe(2);
  });

  it("si ya tengo uno con el mismo nombre normalizado, lo reusa (no duplica)", async () => {
    const { user, publicId } = await publicFixtures();
    const mine = await prisma.exercise.create({ data: { slug: "mi-remo", name: "remo  hammer", createdByUserId: user.id } });
    const { routineId } = await copyRoutine(user.id, publicId);
    expect((await getRoutineForEditor(user.id, routineId)).exercises[1].exercise.id).toBe(mine.id);
    expect(await prisma.exercise.count({ where: { createdByUserId: user.id } })).toBe(1);
  });

  it("un ejercicio del autor sin letras latinas se duplica aunque el que copia tenga otro distinto sin letras latinas (no se reusa)", async () => {
    const { user, other } = await publicFixtures();
    const theirs = await prisma.exercise.create({ data: { slug: "cirilico-b", name: "Тяга", createdByUserId: other.id } });
    const mine = await prisma.exercise.create({ data: { slug: "cirilico-a", name: "Жим лёжа", createdByUserId: user.id } });
    const { routineId: srcId } = await createRoutine(other.id, {
      name: "Cirílico", visibility: "public",
      exercises: [{ exerciseId: theirs.id, restSeconds: null, notes: null, sets: [oneSet()] }],
    });
    const { routineId } = await copyRoutine(user.id, srcId);
    const copiedId = (await getRoutineForEditor(user.id, routineId)).exercises[0].exercise.id;
    expect(copiedId).not.toBe(mine.id);
    expect(copiedId).not.toBe(theirs.id);
    expect(await prisma.exercise.findUniqueOrThrow({ where: { id: copiedId } })).toMatchObject({ name: "Тяга", createdByUserId: user.id });
  });

  it("copiar dos veces duplica el ejercicio una sola vez (la segunda reusa el duplicado)", async () => {
    const { user, publicId } = await publicFixtures();
    const a = await copyRoutine(user.id, publicId);
    const b = await copyRoutine(user.id, publicId);
    expect(await prisma.exercise.count({ where: { createdByUserId: user.id } })).toBe(1);
    const ids = async (id: string) => (await getRoutineForEditor(user.id, id)).exercises.map((e) => e.exercise.id);
    expect(await ids(b.routineId)).toEqual(await ids(a.routineId));
  });

  it("IDOR: la privada de otro, una inexistente o la de un autor desactivado no se copian y no dejan nada", async () => {
    const { user, other, bench, plank, publicId } = await publicFixtures();
    const { routineId: privateId } = await createRoutine(other.id, routineInput(bench.id, plank.id));
    await expect(copyRoutine(user.id, privateId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(copyRoutine(user.id, "no-existe")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await prisma.user.update({ where: { id: other.id }, data: { isActive: false } });
    await expect(copyRoutine(user.id, publicId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await prisma.routine.count({ where: { userId: user.id } })).toBe(0);
    expect(await prisma.exercise.count({ where: { createdByUserId: user.id } })).toBe(0);
  });

  it("duplicar una propia: '(copia)', privada, mismos ejercicios y la misma atribución que el original", async () => {
    const { user, bench, plank, publicId } = await publicFixtures();
    const own = await createRoutine(user.id, { ...routineInput(bench.id, plank.id), visibility: "public" });
    const dup = await copyRoutine(user.id, own.routineId);
    expect(dup.own).toBe(true);
    expect(await prisma.routine.findUniqueOrThrow({ where: { id: dup.routineId } })).toMatchObject({
      name: "Pecho y core (copia)", visibility: "private", copiedFromRoutineId: null, copiedFromUserName: null,
    });
    expect((await getRoutineForEditor(user.id, dup.routineId)).exercises.map((e) => e.exercise.id)).toEqual([plank.id, bench.id]);
    // Duplicar una copia conserva "Basada en la rutina de B".
    const copied = await copyRoutine(user.id, publicId);
    const again = await copyRoutine(user.id, copied.routineId);
    expect(await prisma.routine.findUniqueOrThrow({ where: { id: again.routineId } })).toMatchObject({
      name: "Espalda de B (copia)", copiedFromRoutineId: publicId, copiedFromUserName: "B",
    });
  });

  it("si el autor no tiene nombre, la atribución usa el nombre por defecto de la app", async () => {
    const { user, other, publicId } = await publicFixtures();
    await prisma.user.update({ where: { id: other.id }, data: { name: null } });
    const { routineId } = await copyRoutine(user.id, publicId);
    expect(await prisma.routine.findUniqueOrThrow({ where: { id: routineId } })).toMatchObject({ copiedFromUserName: "Usuario de El Bravo" });
  });

  it("borrar la original deja la copia con el nombre del autor y sin link", async () => {
    const { user, other, publicId } = await publicFixtures();
    const { routineId } = await copyRoutine(user.id, publicId);
    await deleteRoutine(other.id, publicId);
    expect(await prisma.routine.findUniqueOrThrow({ where: { id: routineId } })).toMatchObject({ copiedFromRoutineId: null, copiedFromUserName: "B" });
  });
});
