/**
 * Resultado de `importRoutineWithAiAction` (fase 3) y su paso a borrador de importación. Puro: corre en el cliente
 * con el catálogo cacheado, igual que la importación de texto (fase 1).
 */
import { normalize } from "@/src/features/exercises/search";
import type { CatalogEntry } from "@/src/features/exercises/types";
import { matchImport, newExerciseFromName } from "./match";
import type { ImportDraft, ImportMatch, NewExerciseDraft, ParsedRoutine } from "./types";

export type AiRoutineImport = {
  /** Los ejercicios del catálogo vienen con su nombre EXACTO (verificado en el servidor); los nuevos, con el nombre limpio. */
  parsed: ParsedRoutine;
  /** Lo que propuso la IA para los nuevos, por nombre normalizado. Objeto plano para que viaje por la Server Action. */
  hints: Record<string, Partial<NewExerciseDraft>>;
  /** Cómo aparecía cada ejercicio en el texto, en el mismo orden que `parsed.exercises` ("Decía: «…»"). */
  sourceNames: string[];
};

/** Resultado de importar con IA (fase 3b): todas las rutinas que encontró (hasta 7) y cuántas quedaron afuera. */
export type AiImportResult = { routines: AiRoutineImport[]; omittedCount: number };

/** ¿El nombre (ya normalizado) coincide exacto con el ejercicio del catálogo (nombre, inglés o alias)? */
function isExact(entry: CatalogEntry | undefined, key: string): boolean {
  if (!entry || !key) return false;
  return normalize(entry.name) === key || (!!entry.nameEn && normalize(entry.nameEn) === key) || entry.aliases.includes(key);
}

export function aiImportToDraft(r: AiRoutineImport, catalog: CatalogEntry[]): ImportDraft {
  const hints = new Map(Object.entries(r.hints));
  const draft = matchImport(r.parsed, catalog, hints);
  const byId = new Map(catalog.map((c) => [c.id, c]));
  const forced = new Map<string, NewExerciseDraft>();
  return {
    ...draft,
    items: draft.items.map((it, i) => {
      const name = r.parsed.exercises[i]?.name ?? it.sourceName;
      const key = normalize(name);
      const hint = key ? hints.get(key) : undefined;
      let match: ImportMatch = it.match;
      // La IA dijo que NO es del catálogo: gana sobre el parecido aproximado, salvo coincidencia exacta.
      if (hint && match.kind === "found" && !isExact(byId.get(match.exercise.id), key)) {
        let d = forced.get(key);
        if (!d) {
          const base = newExerciseFromName(name, `ai${forced.size + 1}`, it.sets);
          // Los hints completan el ejercicio, pero no pueden cambiar su identidad (igual que en matchImport).
          d = { ...base, ...hint, tempId: base.tempId, name: base.name };
          forced.set(key, d);
        }
        match = { kind: "new", draft: d };
      }
      return { ...it, match, sourceName: r.sourceNames[i] ?? it.sourceName };
    }),
  };
}
