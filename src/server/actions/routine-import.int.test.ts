// src/server/actions/routine-import.int.test.ts
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

// El cliente de OpenAI se simula: nunca sale a la red.
const ai = vi.hoisted(() => ({ client: null as null | { model: string; generateJson: (req: { user: string }) => Promise<string> } }));
vi.mock("@/src/server/ai/openai", async (orig) => ({
  ...(await orig<typeof import("@/src/server/ai/openai")>()),
  getAiClient: () => ai.client,
}));

import { importRoutineWithAiAction } from "./routine-import";
import { createRoutineAction } from "./routines";
import { getExerciseCatalogAction } from "./exercises";
import { AiError } from "@/src/server/ai/openai";
import { __clearRateLimits } from "@/src/server/account/rate-limit";
import { aiImportToDraft } from "@/src/features/routines-share/ai-draft";
import { importDraftToRoutine, pendingExercises } from "@/src/features/routines-share/match";
import type { RoutineInput } from "@/src/schemas/routine";

const s = (reps: number | null, weightKg: number | null = null) => ({ kind: "normal", reps, durationSeconds: null, weightKg });
const AI_JSON = JSON.stringify({
  name: "Espalda del profe",
  notes: "Bajar lento",
  exercises: [
    { name: "Banco plano", catalogName: "press de banca", measureType: "reps", restSeconds: 90, sets: [s(8, 60), s(8, 60)], newExercise: null },
    {
      name: "Remo Hammer", catalogName: null, measureType: "reps", restSeconds: null, sets: [s(12), s(12), s(12)],
      newExercise: { nameEn: "Hammer Row", equipment: "machine", muscles: [{ muscleSlug: "espalda", percentage: 70 }, { muscleSlug: "dorsal", percentage: 20 }, { muscleSlug: "biceps", percentage: 20 }] },
    },
    { name: "Pullover Fantasma", catalogName: "Pullover Fantasma", measureType: "reps", restSeconds: null, sets: [s(10, 20)], newExercise: null },
  ],
});

function fakeAi(content: string | Error) {
  const generateJson = vi.fn(async (req: { user: string }) => {
    void req;
    if (content instanceof Error) throw content;
    return content;
  });
  ai.client = { model: "test", generateJson };
  return generateJson;
}

async function fixtures() {
  const me = await prisma.user.create({ data: { email: "me@a.com", passwordHash: "x", name: "Yo" } });
  const other = await prisma.user.create({ data: { email: "otro@a.com", passwordHash: "x", name: "Otro" } });
  const pecho = await prisma.muscle.create({ data: { name: "Pecho", slug: "pecho", groupKey: "chest" } });
  await prisma.muscle.create({ data: { name: "Espalda", slug: "espalda", groupKey: "back" } });
  await prisma.muscle.create({ data: { name: "Bíceps", slug: "biceps", groupKey: "arms" } });
  const bench = await prisma.exercise.create({
    data: { slug: "press-de-banca", name: "Press de Banca", source: "catalog", muscles: { create: [{ muscleId: pecho.id, percentage: 100 }] } },
  });
  await prisma.exercise.create({ data: { slug: "secreto-x1", name: "Secreto de Otro", createdByUserId: other.id } });
  session.userId = me.id;
  return { me, bench };
}

describe("importRoutineWithAiAction", () => {
  beforeEach(async () => {
    await resetDb();
    session.userId = null;
    ai.client = null;
    __clearRateLimits();
  });

  it("pide sesión antes que nada", async () => {
    const call = fakeAi(AI_JSON);
    expect(await importRoutineWithAiAction("banco plano 4x8")).toEqual({ ok: false, error: "Tenés que iniciar sesión." });
    expect(call).not.toHaveBeenCalled();
  });

  it("lee la rutina: verifica el catálogo, limpia músculos y no guarda nada", async () => {
    await fixtures();
    const call = fakeAi(AI_JSON);
    const before = await prisma.exercise.count();
    const r = await importRoutineWithAiAction("Lunes espalda: banco plano 2x8 60kg, remo hammer 3x12, pullover 10 con 20");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.parsed.exercises.map((e) => e.name)).toEqual(["Press de Banca", "Remo Hammer", "Pullover Fantasma"]);
    expect(r.data.hints["remo hammer"]).toMatchObject({ source: "ai", equipment: "machine", muscles: [{ muscleSlug: "espalda", percentage: 80 }, { muscleSlug: "biceps", percentage: 20 }] });
    expect(r.data.hints["pullover fantasma"]).toMatchObject({ source: "ai", muscles: [] });
    const prompt = call.mock.calls[0][0].user;
    expect(prompt).toContain("- Press de Banca");
    expect(prompt).toContain("- espalda: Espalda");
    expect(prompt).not.toContain("Secreto de Otro"); // los privados de otros nunca van al prompt
    expect(await prisma.exercise.count()).toBe(before);
    expect(await prisma.routine.count()).toBe(0);
  });

  it("al prompt van primero los ejercicios oficiales y después los propios, en orden estable", async () => {
    const { me } = await fixtures();
    await prisma.exercise.create({ data: { slug: "aaa-propio", name: "Aaa Propio", createdByUserId: me.id } });
    await prisma.exercise.create({ data: { slug: "zzz-oficial", name: "Zzz Oficial", source: "catalog" } });
    const call = fakeAi(AI_JSON);
    expect((await importRoutineWithAiAction("banco plano 4x8")).ok).toBe(true);
    const prompt = call.mock.calls[0][0].user;
    const at = (n: string) => prompt.indexOf(`- ${n}\n`);
    expect(at("Press de Banca")).toBeGreaterThan(-1);
    expect(at("Zzz Oficial")).toBeLessThan(at("Aaa Propio"));
    expect(at("Press de Banca")).toBeLessThan(at("Aaa Propio"));
  });

  it("sin OPENAI_API_KEY no está disponible y no llama a nadie", async () => {
    await fixtures();
    expect(await importRoutineWithAiAction("banco plano 4x8")).toEqual({ ok: false, error: "La importación con IA no está disponible." });
  });

  it("valida el texto (vacío o más de 8.000 caracteres) sin llamar a la IA", async () => {
    await fixtures();
    const call = fakeAi(AI_JSON);
    expect(await importRoutineWithAiAction("   ")).toMatchObject({ ok: false, error: "Pegá la rutina" });
    expect(await importRoutineWithAiAction("x".repeat(8001))).toMatchObject({ ok: false, error: "El texto es muy largo (máximo 8.000 caracteres)." });
    expect(call).not.toHaveBeenCalled();
  });

  it("límite: 20 por usuario por día", async () => {
    await fixtures();
    const call = fakeAi(AI_JSON);
    for (let i = 0; i < 20; i++) expect((await importRoutineWithAiAction("banco plano 4x8")).ok).toBe(true);
    const r = await importRoutineWithAiAction("banco plano 4x8");
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/límite de 20 importaciones con IA por día/) });
    expect(call).toHaveBeenCalledTimes(20);
  });

  it("sin músculos en la base no está disponible y no llama a la IA", async () => {
    const me = await prisma.user.create({ data: { email: "me@a.com", passwordHash: "x", name: "Yo" } });
    session.userId = me.id;
    const call = fakeAi(AI_JSON);
    expect(await importRoutineWithAiAction("banco plano 4x8")).toEqual({ ok: false, error: "La importación con IA no está disponible." });
    expect(call).not.toHaveBeenCalled();
  });

  it("no guarda ni loguea el texto pegado, ni siquiera cuando la IA falla", async () => {
    await fixtures();
    const secret = "mi-rutina-super-secreta-12345";
    const spies = (["log", "info", "warn", "error"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    try {
      fakeAi(new AiError("unavailable", "caída", 503));
      const r = await importRoutineWithAiAction(`banco plano ${secret}`);
      expect(JSON.stringify(r)).not.toContain(secret);
      expect(JSON.stringify(spies.flatMap((s) => s.mock.calls))).not.toContain(secret);
    } finally {
      spies.forEach((s) => s.mockRestore());
    }
  });

  it("errores de OpenAI o respuestas inválidas dan un mensaje claro", async () => {
    await fixtures();
    fakeAi(new AiError("timeout", "lento"));
    expect(await importRoutineWithAiAction("banco plano 4x8")).toEqual({ ok: false, error: "La IA tardó demasiado en responder. Probá de nuevo." });
    fakeAi("{ roto");
    expect(await importRoutineWithAiAction("banco plano 4x8")).toEqual({ ok: false, error: "La IA no pudo entender la rutina. Revisá el texto y probá de nuevo." });
    fakeAi(JSON.stringify({ name: "X", notes: null, exercises: [] }));
    expect(await importRoutineWithAiAction("hola")).toEqual({ ok: false, error: "No encontramos ejercicios en ese texto. ¿Pegaste una rutina?" });
  });

  it("al guardar la rutina, los ejercicios nuevos quedan source ai con los músculos propuestos", async () => {
    const { me, bench } = await fixtures();
    fakeAi(AI_JSON);
    const r = await importRoutineWithAiAction("cualquier texto");
    const cat = await getExerciseCatalogAction();
    if (!r.ok || !cat.ok) throw new Error("esperaba ok");
    const draft = aiImportToDraft(r.data, cat.data.exercises);
    const routine = importDraftToRoutine(draft);
    const newExercises = pendingExercises(draft);
    const input: RoutineInput = {
      name: routine.name,
      notes: routine.notes,
      newExercises,
      exercises: routine.exercises.map((e) => ({ exerciseId: e.exercise.id, restSeconds: e.restSeconds, notes: null, sets: e.sets })),
    };
    expect((await createRoutineAction(input)).ok).toBe(true);

    const mine = await prisma.exercise.findMany({
      where: { createdByUserId: me.id },
      include: { muscles: { include: { muscle: true } } },
      orderBy: { name: "asc" },
    });
    expect(mine.map((e) => [e.name, e.source, e.equipment, e.nameEn])).toEqual([
      ["Pullover Fantasma", "ai", "other", null],
      ["Remo Hammer", "ai", "machine", "Hammer Row"],
    ]);
    expect(mine[1].muscles.map((m) => [m.muscle.slug, m.percentage]).sort()).toEqual([["biceps", 20], ["espalda", 80]]);
    const saved = await prisma.routineExercise.findMany({ orderBy: { position: "asc" }, select: { exerciseId: true } });
    expect(saved[0].exerciseId).toBe(bench.id); // "Banco plano" → el del catálogo, sin duplicar
  });
});
