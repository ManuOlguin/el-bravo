// src/server/actions/routine-import.ts
"use server";
/**
 * Importar una rutina escrita en cualquier formato con IA (spec 2026-10-31, fase 3).
 * El texto se manda a OpenAI y NO se guarda ni se loguea. Límite: 20 por usuario por día
 * (en memoria, por instancia, como el resto de los límites: ver docs/security-review.md).
 */
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import { rateLimit } from "@/src/server/account/rate-limit";
import { AiError, getAiClient, type AiErrorCode } from "@/src/server/ai/openai";
import { AI_IMPORT_MAX_CHARS, AiImportError, importRoutineWithAi } from "@/src/server/ai/routine-import";
import { requireUser } from "@/src/server/auth/dal";
import { visibleTo } from "@/src/server/exercises/catalog";
import { fail, ok, parseInput, runAction, type ActionResult } from "@/src/server/http/result";
import type { AiImportResult } from "@/src/features/routines-share/ai-draft";

const DAILY_LIMIT = { max: 20, windowMs: 24 * 60 * 60_000 };
/** Tope de nombres en el prompt (catálogo primero, después los propios). */
const MAX_CATALOG_NAMES = 400;

const NOT_AVAILABLE = "La importación con IA no está disponible.";
const UNAVAILABLE = "No pudimos usar la IA en este momento. Probá más tarde o pegá la rutina en el formato de El Bravo.";
const NOT_UNDERSTOOD = "La IA no pudo entender la rutina. Revisá el texto y probá de nuevo.";
const NO_EXERCISES = "No encontramos ejercicios en ese texto. ¿Pegaste una rutina?";
const AI_MESSAGES: Record<AiErrorCode, string> = {
  timeout: "La IA tardó demasiado. Si la rutina es larga o tiene varios días, pegá un día por vez.",
  rate_limited: "La IA está con mucha demanda. Probá de nuevo en un rato.",
  quota_exceeded: UNAVAILABLE,
  auth: UNAVAILABLE,
  bad_request: UNAVAILABLE,
  unavailable: UNAVAILABLE,
  refused: NOT_UNDERSTOOD,
  truncated: "La rutina es demasiado larga para leerla con IA. Probá pegarla en dos partes.",
  invalid_output: NOT_UNDERSTOOD,
};
/** Los que tiene que ver el dueño en los logs de Vercel (key, saldo, pedido mal armado, caída). Nunca el texto. */
const LOGGED: ReadonlySet<AiErrorCode> = new Set(["auth", "quota_exceeded", "bad_request", "unavailable"]);

const textSchema = z
  .string({ error: "Pegá la rutina" })
  .trim()
  .min(1, "Pegá la rutina")
  .max(AI_IMPORT_MAX_CHARS, "El texto es muy largo (máximo 8.000 caracteres).");

export async function importRoutineWithAiAction(text: string): Promise<ActionResult<AiImportResult>> {
  return runAction(async () => {
    const user = await requireUser();
    const parsed = parseInput(textSchema, text);
    if (!parsed.ok) return parsed.result;
    const client = getAiClient();
    if (!client) return fail(NOT_AVAILABLE);

    // El schema estricto usa los slugs de músculos como enum: vacío, OpenAI lo rechaza. No gasta cupo.
    const muscles = await prisma.muscle.findMany({ select: { slug: true, name: true }, orderBy: { name: "asc" } });
    if (!muscles.length) return fail(NOT_AVAILABLE);

    const limit = rateLimit(`ai-import:${user.id}`, DAILY_LIMIT);
    if (!limit.ok) {
      const hours = Math.max(1, Math.ceil(limit.retryAfterS / 3600));
      return fail(`Llegaste al límite de ${DAILY_LIMIT.max} importaciones con IA por día. Probá de nuevo en ${hours} ${hours === 1 ? "hora" : "horas"}.`);
    }

    const exercises = await prisma.exercise.findMany({ where: visibleTo(user.id), select: { name: true, createdByUserId: true }, orderBy: [{ name: "asc" }, { id: "asc" }] });
    // Orden determinista: oficiales primero, después los propios (el índice de catalogName gana el primero).
    const catalogNames = [...exercises.filter((e) => !e.createdByUserId), ...exercises.filter((e) => e.createdByUserId)]
      .map((e) => e.name)
      .slice(0, MAX_CATALOG_NAMES);

    try {
      return ok(await importRoutineWithAi({ text: parsed.data, catalogNames, muscles, client }));
    } catch (e) {
      if (e instanceof AiError) {
        if (LOGGED.has(e.code)) console.error("[ai-import]", e.code, e.status ?? "-", e.message);
        return fail(AI_MESSAGES[e.code]);
      }
      if (e instanceof AiImportError) return fail(e.code === "no_exercises" ? NO_EXERCISES : NOT_UNDERSTOOD);
      throw e;
    }
  });
}
