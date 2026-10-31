import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "@/src/server/auth/errors";

/**
 * PUENTE (W0-C): errores de los route handlers viejos → JSON `{ error }` en español.
 * Se borra cuando cada workstream migre sus endpoints a Server Actions (D10).
 */
export function routeError(e: unknown, fallback = "Algo salió mal. Probá de nuevo.") {
  if (e instanceof AuthError) {
    const map = {
      UNAUTHENTICATED: [401, "Tenés que iniciar sesión."],
      FORBIDDEN: [403, "No tenés permiso para hacer esto."],
      NOT_FOUND: [404, "No encontramos lo que buscabas."],
    } as const;
    const [status, error] = map[e.code];
    return NextResponse.json({ error }, { status });
  }
  if (e instanceof ZodError) {
    return NextResponse.json({ error: e.issues[0]?.message ?? "Datos inválidos", issues: e.issues }, { status: 400 });
  }
  console.error(e);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;
export function isLocalDate(v: unknown): v is string {
  return typeof v === "string" && LOCAL_DATE.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
}
