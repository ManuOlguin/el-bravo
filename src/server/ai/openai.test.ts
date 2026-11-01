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
    expect(await rejection(client(async () => errorResponse(400, "invalid_json_schema")).generateJson(REQ))).toMatchObject({ code: "bad_request" });
    expect(await rejection(client(async () => { throw new TypeError("fetch failed"); }).generateJson(REQ))).toMatchObject({ code: "unavailable", status: null });
  });

  it("negativa, respuesta cortada, vacía o no-JSON", async () => {
    expect(await rejection(client(async () => completion({ content: null, refusal: "No puedo" })).generateJson(REQ))).toMatchObject({ code: "refused" });
    expect(await rejection(client(async () => completion({ content: '{"a":', refusal: null }, "length")).generateJson(REQ))).toMatchObject({ code: "truncated" });
    expect(await rejection(client(async () => completion({ content: "", refusal: null })).generateJson(REQ))).toMatchObject({ code: "invalid_output" });
    expect(await rejection(client(async () => new Response("<html>", { status: 200 })).generateJson(REQ))).toMatchObject({ code: "invalid_output" });
  });
});
