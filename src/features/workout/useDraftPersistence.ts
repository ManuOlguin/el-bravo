"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { restTimerKey } from "./rest-alerts";
import type { WorkoutDraft, WorkoutMode } from "./state";

/**
 * Borrador del editor en `localStorage` (clave `workout-draft:<mode>:<id>`), para que un entrenamiento
 * sobreviva a recargas o a cerrar la pestaña. Todo con try/catch: en modo privado o con el storage
 * bloqueado la app funciona igual, solo que sin borrador.
 */

const VERSION = 1;
type Stored = { v: number; savedAt: number; draft: WorkoutDraft };

export function draftKey(mode: WorkoutMode, id: string) {
  return `workout-draft:${mode}:${id}`;
}

function isDraft(d: unknown): d is WorkoutDraft {
  const x = d as Partial<WorkoutDraft> | null;
  return (
    !!x &&
    typeof x.clientRequestId === "string" &&
    (x.mode === "plan" || x.mode === "log" || x.mode === "live") &&
    Array.isArray(x.exercises) &&
    x.exercises.every((e) => !!e && typeof e.key === "string" && !!e.exercise && Array.isArray(e.sets))
  );
}

export function readDraft(key: string): { draft: WorkoutDraft; savedAt: number } | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    if (parsed?.v !== VERSION || !isDraft(parsed.draft)) return null;
    return { draft: parsed.draft, savedAt: parsed.savedAt };
  } catch {
    return null;
  }
}

export function writeDraft(key: string, draft: WorkoutDraft) {
  try {
    window.localStorage.setItem(key, JSON.stringify({ v: VERSION, savedAt: Date.now(), draft } satisfies Stored));
  } catch {
    // storage lleno o bloqueado: se sigue sin borrador
  }
}

export function clearDraft(key: string) {
  try {
    window.localStorage.removeItem(key);
    window.localStorage.removeItem(restTimerKey(key)); // el descanso en curso de ese entrenamiento
  } catch {
    // ídem
  }
}

/** Un borrador vale la pena guardarlo si el usuario cargó algo. */
export function isDraftDirty(d: WorkoutDraft) {
  return d.exercises.length > 0 || d.activityCategoryId !== null || d.notes.trim() !== "" || d.durationMinutes !== null;
}

/**
 * `saved`: lo que había guardado al montar (`undefined` mientras no se leyó, `null` si no había).
 * Guarda `draft` (con un pequeño debounce) solo mientras `enabled` es true: así una pantalla puede
 * preguntar "¿retomar?" sin pisar el borrador viejo, y dejar de guardar después de enviar.
 */
export function useDraftPersistence(key: string, draft: WorkoutDraft, enabled: boolean) {
  const [saved, setSaved] = useState<{ draft: WorkoutDraft; savedAt: number } | null | undefined>(undefined);

  useEffect(() => {
    // Lectura de localStorage después de montar (no existe en el servidor).
    setSaved(readDraft(key));
  }, [key]);

  // Último borrador todavía no escrito (por el debounce): se escribe igual si la página se va.
  const pending = useRef<WorkoutDraft | null>(null);

  useEffect(() => {
    if (!enabled) {
      pending.current = null;
      return;
    }
    pending.current = draft;
    const t = setTimeout(() => {
      pending.current = null;
      if (isDraftDirty(draft)) writeDraft(key, draft);
    }, 250);
    return () => clearTimeout(t);
  }, [key, draft, enabled]);

  // Recargar o cerrar la pestaña dentro del debounce perdía lo último que se tildó.
  useEffect(() => {
    const flush = () => {
      const d = pending.current;
      pending.current = null;
      if (d && isDraftDirty(d)) writeDraft(key, d);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [key]);

  const clear = useCallback(() => {
    pending.current = null;
    clearDraft(key);
  }, [key]);
  return { saved, clear };
}
