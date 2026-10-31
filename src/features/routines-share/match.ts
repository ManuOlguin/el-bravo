/** Asocia los ejercicios de una rutina leída (texto o IA) al catálogo visible del usuario; lo que no está, es nuevo. Puro. */
import { normalize } from "@/src/features/exercises/search";
import type { CatalogEntry, ExerciseSummary } from "@/src/features/exercises/types";
import type { RoutineForEditor } from "@/src/schemas/routine";
import type { ImportDraft, ImportItem, NewExerciseDraft, ParsedRoutine, ParsedSet } from "./types";

export const PENDING_PREFIX = "new:";
export const isPendingExerciseId = (id: string) => id.startsWith(PENDING_PREFIX);

const summary = (e: CatalogEntry): ExerciseSummary => ({
  id: e.id, name: e.name, nameEn: e.nameEn, measureType: e.measureType, equipment: e.equipment,
  tracksWeight: e.tracksWeight, primaryGroupKey: e.primaryGroupKey, mediaUrl: e.mediaUrl,
});

/** Distancia de Levenshtein (inserciones, borrados y sustituciones). */
function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/**
 * Solo coincidencias fuertes, porque un falso positivo engancha la rutina al ejercicio equivocado (peor que crear uno nuevo):
 * exacta (nombre, inglés o alias) o con un error de tipeo (≤ 1 si la query tiene ≥ 5 letras, ≤ 2 si tiene ≥ 10). Sin prefijos.
 */
function findInCatalog(name: string, catalog: CatalogEntry[]): CatalogEntry | null {
  const q = normalize(name);
  if (!q) return null;
  const maxDistance = q.length >= 10 ? 2 : q.length >= 5 ? 1 : 0;
  let best: CatalogEntry | null = null;
  let bestDistance = Infinity;
  for (const e of catalog) {
    const names = [normalize(e.name), ...(e.nameEn ? [normalize(e.nameEn)] : []), ...e.aliases];
    const distance = Math.min(...names.map((n) => (n === q ? 0 : maxDistance > 0 ? editDistance(q, n) : Infinity)));
    if (distance === 0) return e;
    if (distance <= maxDistance && distance < bestDistance) {
      best = e;
      bestDistance = distance;
    }
  }
  return best;
}

export function newExerciseFromName(name: string, tempId: string, sets: ParsedSet[]): NewExerciseDraft {
  const duration = sets.length > 0 && sets.every((s) => s.durationSeconds !== null);
  return {
    tempId, name: name.trim().replace(/\s+/g, " ").slice(0, 100), nameEn: null,
    measureType: duration ? "duration" : "reps", equipment: "other", tracksWeight: sets.some((s) => s.weightKg !== null),
    muscles: [], source: "user",
  };
}

export function matchImport(parsed: ParsedRoutine, catalog: CatalogEntry[], hints?: Map<string, Partial<NewExerciseDraft>>): ImportDraft {
  const pending = new Map<string, NewExerciseDraft>();
  const items: ImportItem[] = parsed.exercises.map((e, i) => {
    const found = findInCatalog(e.name, catalog);
    let match: ImportItem["match"];
    if (found) match = { kind: "found", exercise: summary(found) };
    else {
      const key = normalize(e.name);
      let draft = pending.get(key);
      if (!draft) {
        draft = { ...newExerciseFromName(e.name, `t${pending.size + 1}`, e.sets), ...(hints?.get(key) ?? {}) };
        pending.set(key, draft);
      }
      match = { kind: "new", draft };
    }
    return { key: `i${i}`, sourceName: e.name, match, restSeconds: e.restSeconds, sets: e.sets };
  });
  return { name: parsed.name, notes: parsed.notes, items };
}

/** Borrador listo para `RoutineEditorScreen`; los nuevos llevan id `new:<tempId>` y `primaryGroupKey` del músculo mayor si se conoce. */
export function importDraftToRoutine(d: ImportDraft): RoutineForEditor {
  return {
    id: "", name: d.name, notes: d.notes,
    exercises: d.items.map((i) => ({
      exercise: i.match.kind === "found"
        ? i.match.exercise
        : { id: `${PENDING_PREFIX}${i.match.draft.tempId}`, name: i.match.draft.name, nameEn: i.match.draft.nameEn, measureType: i.match.draft.measureType,
            equipment: i.match.draft.equipment, tracksWeight: i.match.draft.tracksWeight, primaryGroupKey: null, mediaUrl: null },
      restSeconds: i.restSeconds, notes: null,
      sets: i.sets.map((s) => ({ kind: s.kind, targetReps: s.reps, targetWeightKg: s.weightKg, targetDurationSeconds: s.durationSeconds, restSeconds: null })),
    })),
  };
}
