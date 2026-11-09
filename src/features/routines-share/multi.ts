// src/features/routines-share/multi.ts
/**
 * Varias rutinas en una importación (spec 2026-10-31, fase 3b). Una sola revisión de ejercicios para todas las rutinas
 * elegidas: cada ejercicio distinto (por nombre normalizado) es UN ítem de `review` (un `ImportDraft` común que edita
 * `ImportReview`), y cada rutina apunta a esos ítems. Así un ejercicio nuevo que aparece en varias rutinas se revisa
 * una vez y viaja con el mismo tempId a todas (el servidor lo crea una vez). Puro.
 */
import { normalize } from "@/src/features/exercises/search";
import type { CatalogEntry } from "@/src/features/exercises/types";
import type { RoutineInput } from "@/src/schemas/routine";
import { aiImportToDraft, type AiRoutineImport } from "./ai-draft";
import { MAX_ROUTINES_PER_IMPORT } from "./import-limits";
import { PENDING_PREFIX, pendingExercises, referencedPending } from "./match";
import type { ImportDraft, ParsedExercise, ParsedSet } from "./types";

export type MultiRoutineEntry = { itemKey: string; restSeconds: number | null; sets: ParsedSet[] };
export type MultiRoutine = { name: string; notes: string | null; entries: MultiRoutineEntry[] };
export type MultiImportDraft = { review: ImportDraft; routines: MultiRoutine[] };

export function buildMultiDraft(selected: AiRoutineImport[], catalog: CatalogEntry[]): MultiImportDraft {
  const unique: ParsedExercise[] = [];
  const uniqueSource: string[] = [];
  const hints: AiRoutineImport["hints"] = {};
  const indexByKey = new Map<string, number>();
  const routines: MultiRoutine[] = selected.map((r) => {
    for (const [k, h] of Object.entries(r.hints)) if (!Object.hasOwn(hints, k)) hints[k] = h;
    return {
      name: r.parsed.name,
      notes: r.parsed.notes,
      entries: r.parsed.exercises.map((e, i) => {
        const key = normalize(e.name);
        // Clave vacía (solo emoji / escritura no latina): nunca se junta con otro, igual que en matchImport.
        let idx = key ? indexByKey.get(key) : undefined;
        if (idx === undefined) {
          idx = unique.length;
          unique.push(e);
          uniqueSource.push(r.sourceNames[i] ?? e.name);
          if (key) indexByKey.set(key, idx);
        }
        // matchImport numera los ítems `i<índice>`: la rutina guarda esa clave.
        return { itemKey: `i${idx}`, restSeconds: e.restSeconds, sets: e.sets };
      }),
    };
  });
  const review = aiImportToDraft({ parsed: { name: "", notes: null, exercises: unique, unparsedLines: [] }, hints, sourceNames: uniqueSource }, catalog);
  return { review, routines };
}

const toTargets = (sets: ParsedSet[]) =>
  sets.map((s) => ({ kind: s.kind, targetReps: s.reps, targetWeightKg: s.weightKg, targetDurationSeconds: s.durationSeconds, restSeconds: null }));

/** Una `RoutineInput` por rutina, con los ejercicios revisados; cada una lleva solo las definiciones de nuevos que usa. */
export function multiDraftToInputs(m: MultiImportDraft): RoutineInput[] {
  const items = new Map(m.review.items.map((i) => [i.key, i]));
  const pending = pendingExercises(m.review);
  return m.routines.map((r) => {
    const exercises = r.entries.map((e) => {
      const item = items.get(e.itemKey);
      if (!item) throw new Error(`Ítem de revisión inexistente: ${e.itemKey}`);
      const exerciseId = item.match.kind === "found" ? item.match.exercise.id : `${PENDING_PREFIX}${item.match.draft.tempId}`;
      return { exerciseId, restSeconds: e.restSeconds, notes: null, sets: toTargets(e.sets) };
    });
    const newExercises = referencedPending(pending, exercises.map((x) => x.exerciseId));
    return { name: r.name.slice(0, 100) || "Rutina importada", notes: r.notes, exercises, ...(newExercises.length ? { newExercises } : {}) };
  });
}

/** Para "Decía «…» · En: Día 1, Día 2" en la revisión. */
export function routinesUsing(m: MultiImportDraft): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const r of m.routines) {
    for (const e of r.entries) {
      const list = (out[e.itemKey] ??= []);
      if (!list.includes(r.name)) list.push(r.name);
    }
  }
  return out;
}

export function omittedText(n: number): string {
  return n === 1
    ? `Quedó afuera 1 rutina más (máximo ${MAX_ROUTINES_PER_IMPORT} por vez): importala por separado.`
    : `Quedaron afuera ${n} rutinas más (máximo ${MAX_ROUTINES_PER_IMPORT} por vez): importalas por separado.`;
}
