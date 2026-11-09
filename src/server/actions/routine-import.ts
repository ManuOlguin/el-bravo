// src/server/actions/routine-import.ts
"use server";
/**
 * Importar rutinas con IA (spec 2026-10-31, fases 3 y 3b): desde texto pegado o desde fotos/PDF adjuntos.
 * El texto y los archivos se mandan a OpenAI y NO se guardan ni se loguean. Límite: 20 importaciones por usuario por
 * día, COMPARTIDO entre texto y archivos (una importación = un cupo, tenga 1 o 4 fotos o varias rutinas). En memoria,
 * por instancia, como el resto de los límites: ver docs/security-review.md.
 */
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import { rateLimit } from "@/src/server/account/rate-limit";
import { readImportAttachments } from "@/src/server/ai/attachments";
import { AiError, getAiClient, type AiClient, type AiErrorCode } from "@/src/server/ai/openai";
import { AI_IMPORT_MAX_CHARS, AiImportError, importRoutineFromFilesWithAi, importRoutineWithAi, type ImportMuscle } from "@/src/server/ai/routine-import";
import { requireUser } from "@/src/server/auth/dal";
import { visibleTo } from "@/src/server/exercises/catalog";
import { fail, ok, parseInput, runAction, type ActionResult } from "@/src/server/http/result";
import type { AiImportResult } from "@/src/features/routines-share/ai-draft";

const DAILY_LIMIT = { max: 20, windowMs: 24 * 60 * 60_000 };
/** Tope de nombres en el prompt (catálogo primero, después los propios). */
const MAX_CATALOG_NAMES = 400;

const NOT_AVAILABLE = "La importación con IA no está disponible.";
const UNAVAILABLE = "No pudimos usar la IA en este momento. Probá más tarde o pegá la rutina en el formato de El Bravo.";

type ImportMessages = { ai: Record<AiErrorCode, string>; notUnderstood: string; noExercises: string };

const TEXT_NOT_UNDERSTOOD = "La IA no pudo entender la rutina. Revisá el texto y probá de nuevo.";
const TEXT_MESSAGES: ImportMessages = {
  ai: {
    timeout: "La IA tardó demasiado. Si la rutina es larga o tiene varios días, pegá un día por vez.",
    rate_limited: "La IA está con mucha demanda. Probá de nuevo en un rato.",
    quota_exceeded: UNAVAILABLE,
    auth: UNAVAILABLE,
    bad_request: UNAVAILABLE,
    unavailable: UNAVAILABLE,
    refused: TEXT_NOT_UNDERSTOOD,
    truncated: "La rutina es demasiado larga para leerla con IA. Probá pegarla en dos partes.",
    invalid_output: TEXT_NOT_UNDERSTOOD,
  },
  notUnderstood: TEXT_NOT_UNDERSTOOD,
  noExercises: "No encontramos ejercicios en ese texto. ¿Pegaste una rutina?",
};

const FILES_NOT_UNDERSTOOD = "La IA no pudo leer la rutina de los archivos. Probá con fotos más nítidas o pegá el texto.";
const FILE_MESSAGES: ImportMessages = {
  ai: {
    ...TEXT_MESSAGES.ai,
    timeout: "La IA tardó demasiado. Probá con menos fotos o un PDF más corto.",
    truncated: "La rutina es demasiado larga para leerla con IA. Probá con menos fotos o páginas.",
    // Con archivos, un 400 suele ser una imagen o PDF que OpenAI no pudo abrir (igual se loguea el código).
    bad_request: "No pudimos leer esos archivos con IA. Probá con fotos JPG o PNG, o con otro PDF.",
    refused: FILES_NOT_UNDERSTOOD,
    invalid_output: FILES_NOT_UNDERSTOOD,
  },
  notUnderstood: FILES_NOT_UNDERSTOOD,
  noExercises: "No encontramos ejercicios en los archivos. ¿Son de una rutina?",
};
/** Los que tiene que ver el dueño en los logs de Vercel (key, saldo, pedido mal armado, caída). Nunca el texto ni los archivos. */
const LOGGED: ReadonlySet<AiErrorCode> = new Set(["auth", "quota_exceeded", "bad_request", "unavailable"]);

const textSchema = z
  .string({ error: "Pegá la rutina" })
  .trim()
  .min(1, "Pegá la rutina")
  .max(AI_IMPORT_MAX_CHARS, "El texto es muy largo (máximo 8.000 caracteres).");

type AiCall = (ctx: { catalogNames: string[]; muscles: ImportMuscle[]; client: AiClient }) => Promise<AiImportResult>;

/** Lo común a texto y archivos: IA disponible → músculos → UN cupo del límite diario → nombres visibles → IA → mensajes claros. */
async function runAiImport(userId: string, messages: ImportMessages, call: AiCall): Promise<ActionResult<AiImportResult>> {
  const client = getAiClient();
  if (!client) return fail(NOT_AVAILABLE);

  // El schema estricto usa los slugs de músculos como enum: vacío, OpenAI lo rechaza. No gasta cupo.
  const muscles = await prisma.muscle.findMany({ select: { slug: true, name: true }, orderBy: { name: "asc" } });
  if (!muscles.length) return fail(NOT_AVAILABLE);

  const limit = rateLimit(`ai-import:${userId}`, DAILY_LIMIT);
  if (!limit.ok) {
    const hours = Math.max(1, Math.ceil(limit.retryAfterS / 3600));
    return fail(`Llegaste al límite de ${DAILY_LIMIT.max} importaciones con IA por día. Probá de nuevo en ${hours} ${hours === 1 ? "hora" : "horas"}.`);
  }

  const exercises = await prisma.exercise.findMany({ where: visibleTo(userId), select: { name: true, createdByUserId: true }, orderBy: [{ name: "asc" }, { id: "asc" }] });
  // Orden determinista: oficiales primero, después los propios (el índice de catalogName gana el primero).
  const catalogNames = [...exercises.filter((e) => !e.createdByUserId), ...exercises.filter((e) => e.createdByUserId)]
    .map((e) => e.name)
    .slice(0, MAX_CATALOG_NAMES);

  try {
    return ok(await call({ catalogNames, muscles, client }));
  } catch (e) {
    if (e instanceof AiError) {
      if (LOGGED.has(e.code)) console.error("[ai-import]", e.code, e.status ?? "-", e.message);
      return fail(messages.ai[e.code]);
    }
    if (e instanceof AiImportError) return fail(e.code === "no_exercises" ? messages.noExercises : messages.notUnderstood);
    throw e;
  }
}

export async function importRoutineWithAiAction(text: string): Promise<ActionResult<AiImportResult>> {
  return runAction(async () => {
    const user = await requireUser();
    const parsed = parseInput(textSchema, text);
    if (!parsed.ok) return parsed.result;
    return runAiImport(user.id, TEXT_MESSAGES, (ctx) => importRoutineWithAi({ text: parsed.data, ...ctx }));
  });
}

/** Fotos (hasta 4) o un PDF, como `FormData` con el campo `files`. Se revalida todo acá: el navegador puede mentir. */
export async function importRoutineFromFilesWithAiAction(form: FormData): Promise<ActionResult<AiImportResult>> {
  return runAction(async () => {
    const user = await requireUser();
    if (!(form instanceof FormData)) return fail("Adjuntá al menos una foto o un PDF.");
    const files = await readImportAttachments(form);
    if (!files.ok) return fail(files.error);
    return runAiImport(user.id, FILE_MESSAGES, (ctx) => importRoutineFromFilesWithAi({ files: files.files, ...ctx }));
  });
}
