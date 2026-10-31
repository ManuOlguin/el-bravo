"use client";
import { useEffect, useSyncExternalStore } from "react";
import { getExerciseCatalogAction } from "@/src/server/actions/exercises";
import type { CatalogEntry, CatalogMuscle } from "./types";

/**
 * Catálogo de ejercicios cacheado en memoria (uno por pestaña), compartido por todos los componentes.
 * Se carga la primera vez que alguien lo usa; `refresh()` lo vuelve a pedir (p. ej. después de crear uno).
 */
type State = {
  exercises: CatalogEntry[] | null;
  muscles: CatalogMuscle[];
  loading: boolean;
  error: string | null;
};

const INITIAL: State = { exercises: null, muscles: [], loading: false, error: null };
let state: State = INITIAL;
const listeners = new Set<() => void>();
let inflight: Promise<void> | null = null;

function setState(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function load(): Promise<void> {
  if (inflight) return inflight;
  setState({ loading: true, error: null });
  inflight = getExerciseCatalogAction()
    .then((r) => {
      if (r.ok) setState({ exercises: r.data.exercises, muscles: r.data.muscles, loading: false });
      else setState({ loading: false, error: r.error });
    })
    .catch(() => setState({ loading: false, error: "No pudimos cargar los ejercicios. Revisá tu conexión." }))
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Agrega o reemplaza un ejercicio en el catálogo en memoria (p. ej. recién creado), sin esperar al servidor. */
export function upsertCatalogEntry(entry: CatalogEntry) {
  const list = state.exercises ?? [];
  setState({ exercises: [...list.filter((e) => e.id !== entry.id), entry] });
}

const EMPTY: CatalogEntry[] = [];

export function useExerciseCatalog(): {
  catalog: CatalogEntry[];
  muscles: CatalogMuscle[];
  loading: boolean;
  error: string | null;
  refresh(): void;
} {
  const s = useSyncExternalStore(subscribe, () => state, () => INITIAL);
  useEffect(() => {
    if (state.exercises === null && !state.error) void load();
  }, []);
  return {
    catalog: s.exercises ?? EMPTY,
    muscles: s.muscles,
    loading: s.exercises === null && !s.error,
    error: s.error,
    refresh: () => void load(),
  };
}
