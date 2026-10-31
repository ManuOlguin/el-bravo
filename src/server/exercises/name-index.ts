/**
 * Regla única de "reusar por nombre normalizado" para importar y copiar rutinas: si el usuario ya ve un ejercicio
 * con ese nombre, se usa ese en vez de crear otro. Puro, sin I/O.
 * Desempate determinista ante nombres repetidos: gana el oficial del catálogo (`createdByUserId === null`) sobre el
 * propio; entre iguales, el primero en el orden de entrada.
 * Los nombres que normalizan a "" (solo emoji o escritura no latina) no se indexan: no hay forma confiable de decir que
 * dos de ellos son "el mismo" ejercicio.
 */
import { normalize } from "@/src/features/exercises/search";

export type NameIndexRow = { id: string; name: string; createdByUserId: string | null };

export function buildVisibleNameIndex(rows: NameIndexRow[]): Map<string, string> {
  const winners = new Map<string, NameIndexRow>();
  for (const row of rows) {
    const key = normalize(row.name);
    if (!key) continue;
    const current = winners.get(key);
    if (!current || (current.createdByUserId !== null && row.createdByUserId === null)) winners.set(key, row);
  }
  return new Map([...winners].map(([key, row]) => [key, row.id]));
}
