import "server-only";

/**
 * Cliente mínimo de OpenAI (spec 2026-10-31, R1): Chat Completions con salida estructurada
 * (`response_format: json_schema`, `strict: true`), sin SDK — un `fetch` con timeout.
 * Lo usan la importación de rutinas (fase 3) y la curaduría del catálogo (fase 4).
 * Sin `OPENAI_API_KEY` la IA queda apagada (`getAiClient()` → null) y nadie falla.
 * `fetch` es inyectable para los tests; en integración se reemplaza `getAiClient` con `vi.mock`.
 */

type Env = Record<string, string | undefined>;

/** Chico, barato y con salida estructurada. Se cambia con `OPENAI_MODEL` sin tocar código. */
export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
export const AI_TIMEOUT_MS = 30_000;
const CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";

export type AiErrorCode =
  | "timeout"
  | "rate_limited"
  | "quota_exceeded"
  | "auth"
  | "bad_request"
  | "unavailable"
  | "refused"
  | "truncated"
  | "invalid_output";

export class AiError extends Error {
  readonly code: AiErrorCode;
  /** Status HTTP de OpenAI, si hubo respuesta. */
  readonly status: number | null;
  constructor(code: AiErrorCode, message: string, status: number | null = null) {
    super(message);
    this.name = "AiError";
    this.code = code;
    this.status = status;
  }
}

export type JsonSchema = Record<string, unknown>;
export type AiJsonRequest = { system: string; user: string; schemaName: string; schema: JsonSchema; maxOutputTokens?: number };

export interface AiClient {
  readonly model: string;
  /** Devuelve el JSON (como texto) que respeta `schema`. Lanza `AiError`. */
  generateJson(req: AiJsonRequest): Promise<string>;
}

export function isAiEnabled(env: Env = process.env): boolean {
  return !!env.OPENAI_API_KEY?.trim();
}

export function getAiClient(env: Env = process.env): AiClient | null {
  if (!isAiEnabled(env)) return null;
  return createOpenAiClient({ apiKey: env.OPENAI_API_KEY!.trim(), model: env.OPENAI_MODEL });
}

type ChatCompletion = {
  choices?: { finish_reason?: string; message?: { content?: string | null; refusal?: string | null } }[];
};

function httpError(status: number, body: string): AiError {
  let code: string | undefined;
  try {
    code = (JSON.parse(body) as { error?: { code?: string | null } }).error?.code ?? undefined;
  } catch {
    // cuerpo no-JSON (p. ej. un 502 HTML): alcanza con el status
  }
  if (status === 429) {
    return code === "insufficient_quota"
      ? new AiError("quota_exceeded", "OpenAI: sin saldo o se alcanzó el límite mensual del proyecto", status)
      : new AiError("rate_limited", "OpenAI: demasiados pedidos", status);
  }
  if (status === 401 || status === 403) return new AiError("auth", `OpenAI: key inválida o sin permiso (${code ?? status})`, status);
  if (status === 400 || status === 404 || status === 422) return new AiError("bad_request", `OpenAI rechazó el pedido (${code ?? status})`, status);
  return new AiError("unavailable", `OpenAI respondió ${status}`, status);
}

export function createOpenAiClient(opts: { apiKey: string; model?: string; fetch?: typeof fetch; timeoutMs?: number }): AiClient {
  const doFetch = opts.fetch ?? globalThis.fetch;
  const model = opts.model?.trim() || DEFAULT_OPENAI_MODEL;
  const timeoutMs = opts.timeoutMs ?? AI_TIMEOUT_MS;
  return {
    model,
    async generateJson(req) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await doFetch(CHAT_COMPLETIONS_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${opts.apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: req.system },
              { role: "user", content: req.user },
            ],
            response_format: { type: "json_schema", json_schema: { name: req.schemaName, strict: true, schema: req.schema } },
            max_completion_tokens: req.maxOutputTokens ?? 4000,
            store: false, // que no quede guardado en el dashboard de OpenAI
          }),
          signal: controller.signal,
        });
        const body = await res.text(); // también bajo el timeout
        if (!res.ok) throw httpError(res.status, body);
        let data: ChatCompletion;
        try {
          data = JSON.parse(body) as ChatCompletion;
        } catch {
          throw new AiError("invalid_output", "OpenAI devolvió algo que no es JSON", res.status);
        }
        const choice = data.choices?.[0];
        if (choice?.message?.refusal) throw new AiError("refused", "El modelo se negó a responder");
        if (choice?.finish_reason === "length") throw new AiError("truncated", "La respuesta quedó cortada (max_completion_tokens)");
        const content = choice?.message?.content;
        if (!content) throw new AiError("invalid_output", "Respuesta vacía");
        return content;
      } catch (e) {
        if (e instanceof AiError) throw e;
        if (controller.signal.aborted) throw new AiError("timeout", `OpenAI no respondió en ${Math.round(timeoutMs / 1000)} s`);
        throw new AiError("unavailable", `No se pudo conectar con OpenAI: ${(e as Error).message}`);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
