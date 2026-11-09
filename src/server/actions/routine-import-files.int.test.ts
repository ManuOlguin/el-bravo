// src/server/actions/routine-import-files.int.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetDb, prisma } from "@/tests/setup/db";
import type { AiJsonRequest, AiUserPart } from "@/src/server/ai/openai";

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
const ai = vi.hoisted(() => ({ client: null as null | { model: string; generateJson: (req: AiJsonRequest) => Promise<string> } }));
vi.mock("@/src/server/ai/openai", async (orig) => ({
  ...(await orig<typeof import("@/src/server/ai/openai")>()),
  getAiClient: () => ai.client,
}));

import { importRoutineFromFilesWithAiAction, importRoutineWithAiAction } from "./routine-import";
import { AiError } from "@/src/server/ai/openai";
import { __clearRateLimits } from "@/src/server/account/rate-limit";
import { AI_IMPORT_TIMEOUT_MS } from "@/src/features/routines-share/import-limits";

const AI_JSON = JSON.stringify({
  routines: [{
    name: "Rutina de la foto", notes: null,
    exercises: [{ name: "Banco plano", sourceText: "banco plano", catalogName: "Press de Banca", measureType: "reps", restSeconds: 90,
      setGroups: [{ count: 4, kind: "normal", reps: 8, durationSeconds: null, weightKg: 60 }], newExercise: null }],
  }],
  routinesInText: 1,
});

function fakeAi(content: string | Error) {
  const generateJson = vi.fn(async (req: AiJsonRequest) => {
    void req;
    if (content instanceof Error) throw content;
    return content;
  });
  ai.client = { model: "test", generateJson };
  return generateJson;
}

function jpeg(content = "foto", padTo = 0): File {
  const head = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
  const body = new TextEncoder().encode(content);
  return new File([head, body, new Uint8Array(Math.max(0, padTo - head.length - body.length))], "foto.jpg", { type: "image/jpeg" });
}
function pdf(pages: number): File {
  const objs = Array.from({ length: pages }, (_, i) => `${i + 3} 0 obj\n<< /Type /Page /Parent 2 0 R >>\nendobj`).join("\n");
  return new File([`%PDF-1.4\n2 0 obj\n<< /Type /Pages /Count ${pages} >>\nendobj\n${objs}\n%%EOF`], "rutina.pdf", { type: "application/pdf" });
}
const form = (...files: File[]) => {
  const f = new FormData();
  for (const x of files) f.append("files", x);
  return f;
};
const four = () => form(jpeg("1"), jpeg("2"), jpeg("3"), jpeg("4"));

async function fixtures() {
  const me = await prisma.user.create({ data: { email: "me@a.com", passwordHash: "x", name: "Yo" } });
  const pecho = await prisma.muscle.create({ data: { name: "Pecho", slug: "pecho", groupKey: "chest" } });
  await prisma.exercise.create({
    data: { slug: "press-de-banca", name: "Press de Banca", source: "catalog", muscles: { create: [{ muscleId: pecho.id, percentage: 100 }] } },
  });
  session.userId = me.id;
  return { me };
}

describe("importRoutineFromFilesWithAiAction", () => {
  beforeEach(async () => {
    await resetDb();
    session.userId = null;
    ai.client = null;
    __clearRateLimits();
  });

  it("pide sesión antes que nada", async () => {
    const call = fakeAi(AI_JSON);
    expect(await importRoutineFromFilesWithAiAction(four())).toEqual({ ok: false, error: "Tenés que iniciar sesión." });
    expect(call).not.toHaveBeenCalled();
  });

  it("4 fotos = UNA llamada a la IA con las 4 imágenes, con el timeout de importación, y no guarda nada", async () => {
    await fixtures();
    const call = fakeAi(AI_JSON);
    const before = await prisma.exercise.count();
    const r = await importRoutineFromFilesWithAiAction(four());
    expect(r.ok && r.data.routines[0].parsed.exercises[0].name).toBe("Press de Banca");
    expect(call).toHaveBeenCalledTimes(1);
    const req = call.mock.calls[0][0];
    expect(req.timeoutMs).toBe(AI_IMPORT_TIMEOUT_MS);
    const parts = req.user as AiUserPart[];
    expect(parts.map((p) => p.type)).toEqual(["text", "image", "image", "image", "image"]);
    expect(parts[0].type === "text" && parts[0].text).toContain("- Press de Banca");
    expect(await prisma.exercise.count()).toBe(before);
    expect(await prisma.routine.count()).toBe(0);
  });

  it("un PDF va como archivo, con nombre fijo", async () => {
    await fixtures();
    const call = fakeAi(AI_JSON);
    expect((await importRoutineFromFilesWithAiAction(form(pdf(3)))).ok).toBe(true);
    expect((call.mock.calls[0][0].user as AiUserPart[])[1]).toMatchObject({ type: "pdf", filename: "rutina.pdf" });
  });

  it("una importación = un cupo: 20 por día, compartido con el texto", async () => {
    await fixtures();
    const call = fakeAi(AI_JSON);
    for (let i = 0; i < 19; i++) expect((await importRoutineFromFilesWithAiAction(four())).ok).toBe(true);
    expect((await importRoutineWithAiAction("banco plano 4x8")).ok).toBe(true); // la 20
    expect(await importRoutineFromFilesWithAiAction(form(jpeg()))).toMatchObject({ ok: false, error: expect.stringMatching(/límite de 20 importaciones con IA por día/) });
    expect(call).toHaveBeenCalledTimes(20);
  });

  it("valida en el servidor sin llamar a la IA ni gastar cupo", async () => {
    await fixtures();
    const call = fakeAi(AI_JSON);
    const html = new File(["<html>hola</html>"], "foto.jpg", { type: "image/jpeg" });
    const cases: [FormData, RegExp][] = [
      [new FormData(), /Adjuntá al menos una foto o un PDF/],
      [form(html), /Solo podemos leer fotos \(JPG, PNG o WebP\) o un PDF/],
      [form(jpeg(), jpeg(), jpeg(), jpeg(), jpeg()), /hasta 4 fotos o un PDF/],
      [form(jpeg("a", 2_100_000), jpeg("b", 2_100_000)), /pesan 4,2 MB: el máximo es 4 MB/],
      [form(jpeg(), pdf(1)), /fotos o un PDF, no los dos juntos/],
      [form(pdf(11)), /El PDF tiene 11 páginas: el máximo es 10/],
    ];
    for (const [f, error] of cases) expect(await importRoutineFromFilesWithAiAction(f)).toMatchObject({ ok: false, error: expect.stringMatching(error) });
    expect(call).not.toHaveBeenCalled();
    for (let i = 0; i < 20; i++) expect((await importRoutineFromFilesWithAiAction(form(jpeg()))).ok).toBe(true); // el cupo sigue entero
  });

  it("sin OPENAI_API_KEY no está disponible", async () => {
    await fixtures();
    expect(await importRoutineFromFilesWithAiAction(four())).toEqual({ ok: false, error: "La importación con IA no está disponible." });
  });

  it("no devuelve ni loguea el contenido de los archivos (ni su base64), aunque la IA falle", async () => {
    await fixtures();
    const secret = "contenido-de-la-foto-987";
    const file = jpeg(secret);
    const b64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const spies = (["log", "info", "warn", "error"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    try {
      fakeAi(new AiError("bad_request", "OpenAI rechazó el pedido (invalid_image_format)", 400));
      const r = await importRoutineFromFilesWithAiAction(form(file));
      expect(r).toEqual({ ok: false, error: "No pudimos leer esos archivos con IA. Probá con fotos JPG o PNG, o con otro PDF." });
      const logged = JSON.stringify(spies.flatMap((s) => s.mock.calls));
      expect(logged).toContain("[ai-import]"); // el código sí queda para el dueño
      for (const leak of [secret, b64]) {
        expect(JSON.stringify(r)).not.toContain(leak);
        expect(logged).not.toContain(leak);
      }
    } finally {
      spies.forEach((s) => s.mockRestore());
    }
  });

  it("mensajes pensados para archivos", async () => {
    await fixtures();
    fakeAi(new AiError("timeout", "lento"));
    expect(await importRoutineFromFilesWithAiAction(four())).toEqual({ ok: false, error: "La IA tardó demasiado. Probá con menos fotos o un PDF más corto." });
    fakeAi(JSON.stringify({ routines: [], routinesInText: 0 }));
    expect(await importRoutineFromFilesWithAiAction(four())).toEqual({ ok: false, error: "No encontramos ejercicios en los archivos. ¿Son de una rutina?" });
  });
});
