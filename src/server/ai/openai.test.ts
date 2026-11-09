import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { AiError, DEFAULT_OPENAI_MODEL, createOpenAiClient, getAiClient, isAiEnabled } from "./openai";

const REQ = { system: "sys", user: "hola", schemaName: "test", schema: { type: "object", additionalProperties: false, required: [], properties: {} } };
const completion = (message: Record<string, unknown>, finish_reason = "stop") =>
  new Response(JSON.stringify({ choices: [{ finish_reason, message }] }), { status: 200, headers: { "content-type": "application/json" } });
const errorResponse = (status: number, code: string | null = null) => new Response(JSON.stringify({ error: { message: "x", code } }), { status });
const client = (fetchImpl: typeof fetch, timeoutMs?: number) => createOpenAiClient({ apiKey: "sk-test", model: "gpt-test", fetch: fetchImpl, timeoutMs });
const rejection = (p: Promise<unknown>) => p.then(() => { throw new Error("no lanzó"); }, (e: unknown) => e);

describe("isAiEnabled / getAiClient", () => {
  it("la IA está prendida solo si hay key (no vacía)", () => {
    expect(isAiEnabled({})).toBe(false);
    expect(isAiEnabled({ OPENAI_API_KEY: "   " })).toBe(false);
    expect(isAiEnabled({ OPENAI_API_KEY: "sk-x" })).toBe(true);
    expect(getAiClient({})).toBeNull();
  });

  it("modelo por OPENAI_MODEL, con uno chico por defecto", () => {
    expect(getAiClient({ OPENAI_API_KEY: "sk-x" })?.model).toBe(DEFAULT_OPENAI_MODEL);
    expect(getAiClient({ OPENAI_API_KEY: "sk-x", OPENAI_MODEL: "" })?.model).toBe(DEFAULT_OPENAI_MODEL);
    expect(getAiClient({ OPENAI_API_KEY: "sk-x", OPENAI_MODEL: "gpt-4.1-mini" })?.model).toBe("gpt-4.1-mini");
  });
});

describe("createOpenAiClient.generateJson", () => {

  const IMG = Uint8Array.from({ length: 120 }, (_, i) => (i * 37) % 256); // base64 de 160 caracteres
  const PDF = new TextEncoder().encode("%PDF-1.4 rutina-secreta-777");
  const b64 = (u: Uint8Array) => Buffer.from(u).toString("base64");
  const FILES_REQ = {
    ...REQ,
    user: [
      { type: "text" as const, text: "leé la rutina" },
      { type: "image" as const, mediaType: "image/jpeg" as const, data: IMG },
      { type: "pdf" as const, filename: "rutina.pdf", data: PDF },
    ],
  };

  it("arma las partes multimodales: texto, imagen como data URL (detail high) y PDF como file_data", async () => {
    const f = vi.fn<typeof fetch>(async () => completion({ content: "{}", refusal: null }));
    await client(f).generateJson(FILES_REQ);
    const body = JSON.parse(f.mock.calls[0][1]!.body as string);
    expect(body.messages[1]).toEqual({
      role: "user",
      content: [
        { type: "text", text: "leé la rutina" },
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64(IMG)}`, detail: "high" } },
        { type: "file", file: { filename: "rutina.pdf", file_data: `data:application/pdf;base64,${b64(PDF)}` } },
      ],
    });
  });

  it("ningún error lleva el base64 ni el texto de los archivos", async () => {
    const leaks = [b64(IMG), b64(PDF), "rutina-secreta-777", "leé la rutina"];
    const echo400 = async () =>
      new Response(JSON.stringify({ error: { message: `bad image ${b64(IMG)} leé la rutina`, code: b64(IMG) } }), { status: 400 });
    const boom = async (): Promise<Response> => {
      throw new TypeError(`fetch failed ${b64(PDF)} rutina-secreta-777`);
    };
    const hang: typeof fetch = (_u, init) =>
      new Promise((_, reject) => init!.signal!.addEventListener("abort", () => reject(new DOMException(b64(IMG), "AbortError"))));
    const errors = [
      await rejection(client(echo400).generateJson(FILES_REQ)),
      await rejection(client(boom).generateJson(FILES_REQ)),
      await rejection(client(hang).generateJson({ ...FILES_REQ, timeoutMs: 20 })),
    ];
    expect(errors.map((e) => (e as AiError).code)).toEqual(["bad_request", "unavailable", "timeout"]);
    for (const e of errors) {
      const seen = `${(e as Error).message} ${JSON.stringify(e)} ${String((e as Error).stack)}`;
      for (const leak of leaks) expect(seen).not.toContain(leak);
    }
  });
  it("timeoutMs del pedido pisa el del cliente y no viaja a OpenAI", async () => {
    const hang: typeof fetch = (_u, init) =>
      new Promise((_, reject) => init!.signal!.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
    const started = Date.now();
    const e = await rejection(client(hang, 60_000).generateJson({ ...REQ, timeoutMs: 20 }));
    expect(e).toMatchObject({ code: "timeout" });
    expect(Date.now() - started).toBeLessThan(5_000);

    const f = vi.fn<typeof fetch>(async () => completion({ content: "{}", refusal: null }));
    await client(f).generateJson({ ...REQ, timeoutMs: 1_000 });
    expect(JSON.parse(f.mock.calls[0][1]!.body as string)).not.toHaveProperty("timeoutMs");
  });

  it("un código de error raro de OpenAI no entra al mensaje (podría repetir lo que le mandamos)", async () => {
    const echoed = `${"QUJD".repeat(30)}+/=`;
    const e = await rejection(client(async () => errorResponse(400, echoed)).generateJson(REQ));
    expect(e).toMatchObject({ code: "bad_request", status: 400 });
    expect((e as Error).message).toBe("OpenAI rechazó el pedido (400)");
    expect(await rejection(client(async () => errorResponse(400, "invalid_image_format")).generateJson(REQ))).toMatchObject({
      message: "OpenAI rechazó el pedido (invalid_image_format)",
    });
  });

  it("pide salida estructurada estricta y devuelve el contenido", async () => {
    const f = vi.fn<typeof fetch>(async () => completion({ content: '{"ok":true}', refusal: null }));
    expect(await client(f).generateJson(REQ)).toBe('{"ok":true}');
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect((init!.headers as Record<string, string>).Authorization).toBe("Bearer sk-test");
    expect(JSON.parse(init!.body as string)).toMatchObject({
      model: "gpt-test",
      store: false,
      messages: [{ role: "system", content: "sys" }, { role: "user", content: "hola" }],
      response_format: { type: "json_schema", json_schema: { name: "test", strict: true, schema: REQ.schema } },
    });
    expect(init!.signal).toBeInstanceOf(AbortSignal);
  });

  it("corta a los timeoutMs con AiError timeout", async () => {
    const hang: typeof fetch = (_u, init) =>
      new Promise((_, reject) => init!.signal!.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
    const e = await rejection(client(hang, 20).generateJson(REQ));
    expect(e).toBeInstanceOf(AiError);
    expect(e).toMatchObject({ code: "timeout" });
  });

  it("429 es rate_limited; 429 sin saldo es quota_exceeded", async () => {
    expect(await rejection(client(async () => errorResponse(429, "rate_limit_exceeded")).generateJson(REQ))).toMatchObject({ code: "rate_limited", status: 429 });
    expect(await rejection(client(async () => errorResponse(429, "insufficient_quota")).generateJson(REQ))).toMatchObject({ code: "quota_exceeded", status: 429 });
  });

  it("500/503 es unavailable; 401 es auth; 400 es bad_request; sin red es unavailable", async () => {
    expect(await rejection(client(async () => errorResponse(500)).generateJson(REQ))).toMatchObject({ code: "unavailable", status: 500 });
    expect(await rejection(client(async () => new Response("<html>", { status: 503 })).generateJson(REQ))).toMatchObject({ code: "unavailable", status: 503 });
    expect(await rejection(client(async () => errorResponse(401, "invalid_api_key")).generateJson(REQ))).toMatchObject({ code: "auth" });
    expect(await rejection(client(async () => errorResponse(403, "forbidden")).generateJson(REQ))).toMatchObject({ code: "auth", status: 403 });
    expect(await rejection(client(async () => errorResponse(400, "invalid_json_schema")).generateJson(REQ))).toMatchObject({ code: "bad_request" });
    expect(await rejection(client(async () => { throw new TypeError("fetch failed"); }).generateJson(REQ))).toMatchObject({ code: "unavailable", status: null });
  });

  it("negativa, respuesta cortada, vacía o no-JSON", async () => {
    expect(await rejection(client(async () => completion({ content: null, refusal: "No puedo" })).generateJson(REQ))).toMatchObject({ code: "refused" });
    expect(await rejection(client(async () => completion({ content: '{"a":', refusal: null }, "length")).generateJson(REQ))).toMatchObject({ code: "truncated" });
    expect(await rejection(client(async () => completion({ content: "", refusal: null })).generateJson(REQ))).toMatchObject({ code: "invalid_output" });
    expect(await rejection(client(async () => new Response("<html>", { status: 200 })).generateJson(REQ))).toMatchObject({ code: "invalid_output" });
  });

  it("un fallo de fetch nunca filtra su texto (puede traer la key)", async () => {
    const e = await rejection(client(async () => { throw new TypeError('bad "Bearer sk-test"'); }).generateJson(REQ));
    expect(e).toBeInstanceOf(AiError);
    expect(e).toMatchObject({ code: "unavailable", status: null });
    expect((e as Error).message).not.toContain("sk-test");
    expect((e as Error).message).not.toContain("Bearer");
  });

  it("finish_reason distinto de stop (content_filter) con contenido parcial es invalid_output", async () => {
    expect(await rejection(client(async () => completion({ content: '{"a":1', refusal: null }, "content_filter")).generateJson(REQ))).toMatchObject({ code: "invalid_output" });
  });
});
