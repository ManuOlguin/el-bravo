import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetDb, prisma } from "@/tests/setup/db";

vi.mock("server-only", () => ({}));

import { getExerciseCatalog, getExerciseDetail } from "./catalog";
import { createExercise } from "./create";

async function fixtures() {
  const me = await prisma.user.create({ data: { email: "me@a.com", passwordHash: "x", name: "Yo" } });
  const other = await prisma.user.create({ data: { email: "other@a.com", passwordHash: "x", name: "Otro" } });
  const pecho = await prisma.muscle.create({ data: { name: "Pecho", slug: "pecho", groupKey: "chest" } });
  const triceps = await prisma.muscle.create({ data: { name: "Tríceps", slug: "triceps", groupKey: "arms" } });
  const espalda = await prisma.muscle.create({ data: { name: "Espalda", slug: "espalda", groupKey: "back" } });
  const press = await prisma.exercise.create({
    data: {
      slug: "press-de-banca", name: "Press de Banca", nameEn: "Bench Press", equipment: "barbell",
      description: "Empuje con barra.", instructions: { steps: ["Uno", "Dos", "Evitá: tres"], reviewed: false },
      mediaUrl: "https://example.com/press.jpg",
      aliases: { create: [{ alias: "pecho plano", locale: "es" }, { alias: "bench", locale: "en" }] },
      muscles: { create: [{ muscleId: triceps.id, percentage: 30 }, { muscleId: pecho.id, percentage: 70 }] },
    },
  });
  const jalon = await prisma.exercise.create({
    data: { slug: "jalon-al-pecho", name: "Jalón al pecho", equipment: "machine", muscles: { create: [{ muscleId: espalda.id, percentage: 100 }] } },
  });
  const mine = await prisma.exercise.create({ data: { slug: "mio", name: "Mío", createdByUserId: me.id } });
  const theirs = await prisma.exercise.create({ data: { slug: "ajeno", name: "Ajeno", createdByUserId: other.id } });
  return { me, other, pecho, triceps, espalda, press, jalon, mine, theirs };
}

describe("getExerciseCatalog", () => {
  beforeEach(resetDb);

  it("incluye oficiales + propios y excluye los de otros usuarios", async () => {
    const f = await fixtures();
    const { exercises, muscles } = await getExerciseCatalog(f.me.id);
    expect(exercises.map((e) => e.name).sort()).toEqual(["Jalón al pecho", "Mío", "Press de Banca"]);
    expect(exercises.find((e) => e.id === f.mine.id)?.isMine).toBe(true);
    expect(exercises.find((e) => e.id === f.press.id)?.isMine).toBe(false);
    expect(muscles.map((m) => m.slug).sort()).toEqual(["espalda", "pecho", "triceps"]);
  });

  it("arma el CatalogEntry: grupo principal, grupos, alias y equipamiento", async () => {
    const f = await fixtures();
    const press = (await getExerciseCatalog(f.me.id)).exercises.find((e) => e.id === f.press.id)!;
    expect(press).toMatchObject({
      nameEn: "Bench Press", equipment: "barbell", measureType: "reps", tracksWeight: true,
      primaryGroupKey: "chest", mediaUrl: "https://example.com/press.jpg",
    });
    expect(press.groupKeys.sort()).toEqual(["arms", "chest"]);
    expect(press.aliases.sort()).toEqual(["bench", "pecho plano"]);
  });
});

describe("getExerciseDetail", () => {
  beforeEach(resetDb);

  it("devuelve texto, pasos, revisión y músculos ordenados por porcentaje", async () => {
    const f = await fixtures();
    const d = await getExerciseDetail(f.press.id, f.me.id);
    expect(d).toMatchObject({ name: "Press de Banca", description: "Empuje con barra.", reviewed: false, primaryGroupKey: "chest" });
    expect(d!.instructions).toEqual(["Uno", "Dos", "Evitá: tres"]);
    expect(d!.muscles.map((m) => [m.name, m.percentage])).toEqual([["Pecho", 70], ["Tríceps", 30]]);
  });

  it("no expone ejercicios privados de otros usuarios", async () => {
    const f = await fixtures();
    expect(await getExerciseDetail(f.theirs.id, f.me.id)).toBeNull();
    expect(await getExerciseDetail(f.mine.id, f.me.id)).not.toBeNull();
    expect(await getExerciseDetail("no-existe", f.me.id)).toBeNull();
  });
});

describe("createExercise", () => {
  beforeEach(resetDb);

  const input = (o: Partial<Parameters<typeof createExercise>[1]> = {}, muscleId = "") => ({
    name: "Plancha lateral", measureType: "duration" as const, equipment: "bodyweight" as const, tracksWeight: false,
    muscles: [{ muscleId, percentage: 100 }], ...o,
  });

  it("crea un ejercicio por tiempo y lo devuelve como propio", async () => {
    const f = await fixtures();
    const r = await createExercise(f.me.id, input({}, f.pecho.id));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.exercise).toMatchObject({ name: "Plancha lateral", measureType: "duration", tracksWeight: false, isMine: true, primaryGroupKey: "chest" });
    const row = await prisma.exercise.findUniqueOrThrow({ where: { id: r.exercise.id } });
    expect(row).toMatchObject({ measureType: "duration", equipment: "bodyweight", slug: "plancha-lateral", createdByUserId: f.me.id });
    expect((await getExerciseCatalog(f.me.id)).exercises.some((e) => e.id === r.exercise.id && e.isMine)).toBe(true);
  });

  it("un nombre repetido con otro acento devuelve el existente", async () => {
    const f = await fixtures();
    const r = await createExercise(f.me.id, input({ name: "jalon al PECHO" }, f.espalda.id));
    expect(r).toEqual({ ok: false, reason: "duplicate", existing: { id: f.jalon.id, name: "Jalón al pecho" } });
    expect(await prisma.exercise.count()).toBe(4);
  });

  it("el nombre de un ejercicio privado ajeno no se revela, pero no se puede repetir", async () => {
    const f = await fixtures();
    const r = await createExercise(f.me.id, input({ name: "Ajeno" }, f.pecho.id));
    expect(r).toEqual({ ok: false, reason: "name_taken" });
  });

  it("si el slug está tomado agrega sufijo", async () => {
    const f = await fixtures();
    await prisma.exercise.create({ data: { slug: "remo-raro", name: "Remo raro viejo" } });
    const r = await createExercise(f.me.id, input({ name: "Remo raro!" }, f.espalda.id));
    expect(r.ok && (await prisma.exercise.findUniqueOrThrow({ where: { id: r.exercise.id } })).slug).toBe("remo-raro-2");
  });

  it("rechaza músculos inexistentes", async () => {
    const f = await fixtures();
    const r = await createExercise(f.me.id, input({}, "no-existe"));
    expect(r).toEqual({ ok: false, reason: "invalid_muscles" });
  });

  it("dos creaciones concurrentes con el mismo nombre crean uno solo", async () => {
    const f = await fixtures();
    const [a, b] = await Promise.all([createExercise(f.me.id, input({}, f.pecho.id)), createExercise(f.me.id, input({}, f.pecho.id))]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    expect(await prisma.exercise.count({ where: { name: "Plancha lateral" } })).toBe(1);
  });
});
