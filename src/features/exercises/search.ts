/**
 * Búsqueda pura del catálogo de ejercicios (cliente, sin round-trips).
 * Tolera acentos, orden de palabras, nombres en inglés/alias y un error de tipeo.
 */
import type { CatalogEntry, Equipment } from "./types";

export type { CatalogEntry, Equipment, ExerciseSummary } from "./types";

export type SearchFilters = { groupKey?: string; equipment?: Equipment };

/** Minúsculas, sin acentos, sin signos (todo lo que no es letra/número pasa a espacio), espacios colapsados. */
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** ¿Distancia de Levenshtein ≤ 1? Corta enseguida si los largos difieren en más de 1. */
export function levenshteinWithin1(a: string, b: string): boolean {
  if (a === b) return true;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0;
  while (i < la && i < lb && a[i] === b[i]) i++;
  if (la === lb) return a.slice(i + 1) === b.slice(i + 1); // sustitución
  if (la > lb) return a.slice(i + 1) === b.slice(i); // borrado en b
  return a.slice(i) === b.slice(i + 1); // inserción en b
}

type Indexed = {
  name: string;
  /** nameEn + alias, normalizados. */
  others: string[];
  /** Palabras de nombre, nameEn y alias. */
  words: string[];
};

const cache = new WeakMap<CatalogEntry, Indexed>();

function indexOf(entry: CatalogEntry): Indexed {
  let ix = cache.get(entry);
  if (!ix) {
    const name = normalize(entry.name);
    const others = [entry.nameEn, ...entry.aliases].filter((x): x is string => !!x).map(normalize).filter(Boolean);
    const words = [...new Set([name, ...others].flatMap((s) => s.split(" ")).filter(Boolean))];
    ix = { name, others, words };
    cache.set(entry, ix);
  }
  return ix;
}

const FUZZY_MIN_LEN = 4;

function fuzzyWordMatch(q: string, word: string): boolean {
  if (levenshteinWithin1(q, word)) return true;
  // Error mientras se tipea: comparar contra el prefijo de la palabra de largo parecido.
  for (const len of [q.length - 1, q.length, q.length + 1]) {
    if (len > 0 && len < word.length && levenshteinWithin1(q, word.slice(0, len))) return true;
  }
  return false;
}

/** 0 = mejor. `null` = no coincide. */
function rank(entry: CatalogEntry, q: string, qWords: string[]): number | null {
  const ix = indexOf(entry);
  if (ix.name === q) return 0;
  if (ix.name.startsWith(q)) return 1;
  if (ix.others.some((o) => o.startsWith(q))) return 2;
  if (qWords.every((w) => ix.words.some((x) => x.startsWith(w)))) return 3;
  const fuzzy = qWords.every((w) =>
    ix.words.some((x) => x.startsWith(w) || (w.length >= FUZZY_MIN_LEN && fuzzyWordMatch(w, x)))
  );
  return fuzzy ? 4 : null;
}

const collator = new Intl.Collator("es", { sensitivity: "base", numeric: true });
const byName = (a: CatalogEntry, b: CatalogEntry) => collator.compare(a.name, b.name);

function passesFilters(e: CatalogEntry, f?: SearchFilters) {
  if (f?.groupKey && !e.groupKeys.includes(f.groupKey)) return false;
  if (f?.equipment && e.equipment !== f.equipment) return false;
  return true;
}

/**
 * Ranking: nombre exacto > nombre empieza con la query > alias/nameEn empieza con la query >
 * todas las palabras son prefijo (cualquier orden) > aproximado (1 error en palabras de ≥ 4 letras).
 * Desempate: propios primero, después alfabético. Query vacía: todo lo filtrado, alfabético.
 */
export function searchExercises(catalog: CatalogEntry[], query: string, filters?: SearchFilters): CatalogEntry[] {
  const filtered = catalog.filter((e) => passesFilters(e, filters));
  const q = normalize(query);
  if (!q) return filtered.sort(byName);
  const qWords = q.split(" ");
  const scored: { e: CatalogEntry; r: number }[] = [];
  for (const e of filtered) {
    const r = rank(e, q, qWords);
    if (r !== null) scored.push({ e, r });
  }
  scored.sort((a, b) => a.r - b.r || Number(b.e.isMine) - Number(a.e.isMine) || byName(a.e, b.e));
  return scored.map((s) => s.e);
}
