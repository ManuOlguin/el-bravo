import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { localDateOf, localTimeOf } from "@/src/lib/time";
import { AuthError } from "@/src/server/auth/errors";
import type { ActivityInput } from "@/src/schemas/workout";

/**
 * PUENTE (W0-C) entre el formulario viejo (`/load`) y el servicio de actividades.
 * Se borra cuando W2-1 reemplace `app/api/activities/*` por Server Actions.
 */

type LegacyExercise = {
  exerciseId?: unknown;
  sets?: unknown;
  reps?: unknown;
  durationSeconds?: unknown;
  weightKg?: unknown;
};

export type LegacyActivityBody = {
  clientRequestId?: unknown;
  startedAt?: unknown;
  endedAt?: unknown;
  durationMinutes?: unknown;
  notes?: unknown;
  activityCategoryId?: unknown;
  routineId?: unknown;
  exercises?: unknown;
};

const blankToNull = (v: unknown) => (v === "" || v === undefined ? null : v);

/** Formato viejo (instantes ISO + `sets` planos por ejercicio) → `ActivityInput` (N series iguales). */
export function legacyBodyToActivityInput(body: LegacyActivityBody, tz: string): ActivityInput {
  const start = new Date(String(body.startedAt ?? ""));
  if (Number.isNaN(start.getTime())) throw new LegacyInputError("La fecha u hora de inicio no son válidas.");
  // El form nuevo manda durationMinutes; el viejo solo endedAt (se deriva). La validación de rango es de Zod.
  let durationMinutes = Number(body.durationMinutes);
  if (body.durationMinutes === undefined || body.durationMinutes === null || body.durationMinutes === "") {
    const end = new Date(String(body.endedAt ?? ""));
    durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
  }
  if (!Number.isFinite(durationMinutes)) throw new LegacyInputError("Indicá la duración del entrenamiento.");
  const exercises = Array.isArray(body.exercises) ? (body.exercises as LegacyExercise[]) : [];
  return {
    clientRequestId: typeof body.clientRequestId === "string" && body.clientRequestId ? body.clientRequestId : randomUUID(),
    activityCategoryId: String(body.activityCategoryId ?? ""),
    localDate: localDateOf(start, tz),
    localTime: localTimeOf(start, tz),
    durationMinutes,
    notes: typeof body.notes === "string" ? body.notes : null,
    routineId: typeof body.routineId === "string" && body.routineId ? body.routineId : null,
    exercises: exercises.map((ex) => {
      const count = Math.min(Math.max(Math.trunc(Number(ex.sets) || 1), 1), 30);
      const set = {
        kind: "normal" as const,
        reps: blankToNull(ex.reps) as number | null,
        durationSeconds: blankToNull(ex.durationSeconds) as number | null,
        weightKg: blankToNull(ex.weightKg) as number | null,
        restSeconds: null,
        completed: true,
      };
      return { exerciseId: String(ex.exerciseId ?? ""), notes: null, sets: Array.from({ length: count }, () => ({ ...set })) };
    }),
  };
}

export class LegacyInputError extends Error {}

/** Traduce errores del servicio a respuestas JSON `{ error }` en español. */
export function activityErrorResponse(e: unknown) {
  if (e instanceof LegacyInputError) return NextResponse.json({ error: e.message }, { status: 400 });
  if (e instanceof ZodError) {
    return NextResponse.json({ error: e.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }
  if (e instanceof AuthError) {
    const status = e.code === "UNAUTHENTICATED" ? 401 : e.code === "FORBIDDEN" ? 403 : 404;
    const error =
      e.code === "UNAUTHENTICATED"
        ? "Tenés que iniciar sesión."
        : e.code === "FORBIDDEN"
          ? "No tenés permiso para hacer esto."
          : "No encontramos la actividad.";
    return NextResponse.json({ error }, { status });
  }
  const code = (e as { code?: unknown } | null)?.code;
  if (code === "P2003") {
    return NextResponse.json({ error: "El tipo de actividad o algún ejercicio no existe." }, { status: 400 });
  }
  console.error("[activities]", e);
  return NextResponse.json({ error: "No se pudo guardar la actividad." }, { status: 500 });
}
