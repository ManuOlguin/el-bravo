/**
 * Qué hacer con cada ejercicio al copiar una rutina (fase 2, decisión R3 del spec). Puro, sin I/O.
 * - Del catálogo oficial o propio del que copia → se referencia tal cual.
 * - Propio de otro (el autor) → si el que copia ya ve uno con el mismo nombre normalizado (catálogo o suyo), se reusa;
 *   si no, se duplica como privado suyo. Dos del autor con el mismo nombre normalizado comparten un único duplicado.
 * El "ya ve uno con ese nombre" usa la misma regla que importar rutinas (`buildVisibleNameIndex`).
 */
import { normalize } from "@/src/features/exercises/search";
import { buildVisibleNameIndex, type NameIndexRow } from "@/src/server/exercises/name-index";

export type CopySourceExercise = { id: string; name: string; createdByUserId: string | null };
export type ExerciseCopyDecision = { kind: "reference"; exerciseId: string } | { kind: "duplicate"; sourceId: string };

export function planExerciseCopies(
  exercises: CopySourceExercise[],
  copierId: string,
  copierVisible: NameIndexRow[]
): Map<string, ExerciseCopyDecision> {
  const visibleByName = buildVisibleNameIndex(copierVisible);
  const duplicateByName = new Map<string, string>();
  const plan = new Map<string, ExerciseCopyDecision>();
  for (const e of exercises) {
    if (plan.has(e.id)) continue;
    if (e.createdByUserId === null || e.createdByUserId === copierId) {
      plan.set(e.id, { kind: "reference", exerciseId: e.id });
      continue;
    }
    const key = normalize(e.name);
    const reuse = visibleByName.get(key);
    if (reuse) {
      plan.set(e.id, { kind: "reference", exerciseId: reuse });
      continue;
    }
    const first = duplicateByName.get(key) ?? e.id;
    duplicateByName.set(key, first);
    plan.set(e.id, { kind: "duplicate", sourceId: first });
  }
  return plan;
}

const COPY_SUFFIX = " (copia)";

/** Copiar de otro conserva el nombre; "Duplicar" una propia le agrega " (copia)" (máx. 100 caracteres, como el schema). */
export function copyRoutineName(name: string, own: boolean): string {
  return own ? `${name.slice(0, 100 - COPY_SUFFIX.length)}${COPY_SUFFIX}` : name;
}
