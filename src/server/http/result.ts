import { z } from "zod";
import { AuthError } from "@/src/server/auth/errors";

/** Resultado uniforme de toda Server Action (roadmap D10, contrato §5.3). */
export type ActionResult<T = void> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export function ok<T>(data: T, message?: string): ActionResult<T> {
  return message === undefined ? { ok: true, data } : { ok: true, data, message };
}

export function fail(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return fieldErrors ? { ok: false, error, fieldErrors } : { ok: false, error };
}

/** Valida con Zod 4. En error, el primer mensaje es `error` y cada issue va a `fieldErrors["a.b.0"]`. */
export function parseInput<S extends z.ZodTypeAny>(
  schema: S,
  input: unknown
): { ok: true; data: z.infer<S> } | { ok: false; result: ActionResult<never> } {
  const parsed = schema.safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path.map(String).join(".") || "_";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return { ok: false, result: fail(parsed.error.issues[0]?.message ?? "Datos inválidos", fieldErrors) };
}

const AUTH_MESSAGES: Record<AuthError["code"], string> = {
  UNAUTHENTICATED: "Tenés que iniciar sesión.",
  FORBIDDEN: "No tenés permiso para hacer esto.",
  NOT_FOUND: "No encontramos lo que buscabas.",
};

/** redirect()/notFound()/forbidden() de Next se implementan con throw: hay que dejarlos pasar. */
function isNextControlFlow(e: unknown) {
  const digest = (e as { digest?: unknown } | null)?.digest;
  return (
    typeof digest === "string" &&
    (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK") || digest === "NEXT_NOT_FOUND")
  );
}

function isAuthError(e: unknown): e is AuthError {
  return e instanceof AuthError || (e instanceof Error && e.name === "AuthError" && "code" in e);
}

/** Ejecuta una acción y traduce errores conocidos (auth, Prisma) a mensajes es-AR. */
export async function runAction<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (e) {
    if (isNextControlFlow(e)) throw e;
    if (isAuthError(e)) return fail(AUTH_MESSAGES[e.code] ?? AUTH_MESSAGES.FORBIDDEN);
    const code = (e as { code?: unknown } | null)?.code;
    if (code === "P2002") return fail("Ya existe un registro con esos datos.");
    if (code === "P2025") return fail("No encontramos lo que buscabas.");
    console.error("[action]", e);
    return fail("Algo salió mal. Probá de nuevo.");
  }
}
