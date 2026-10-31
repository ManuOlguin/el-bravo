import type { SetKind } from "@/src/features/workout/state";
import type { Equipment, ExerciseSummary } from "@/src/features/exercises/types";

export type ParsedSet = { kind: SetKind; reps: number | null; durationSeconds: number | null; weightKg: number | null };
export type ParsedExercise = { name: string; restSeconds: number | null; sets: ParsedSet[] };
export type ParsedRoutine = { name: string; notes: string | null; exercises: ParsedExercise[]; unparsedLines: string[] };

/** Ejercicio que todavía no existe: se crea al guardar la rutina. */
export type NewExerciseDraft = {
  tempId: string; // id temporal; en el editor el ejercicio lleva id `new:<tempId>`
  name: string;
  nameEn: string | null;
  measureType: "reps" | "duration";
  equipment: Equipment;
  tracksWeight: boolean;
  muscles: { muscleSlug: string; percentage: number }[]; // puede venir vacío (fase 1); la IA lo completa (fase 3)
  source: "user" | "ai";
};

export type ImportMatch = { kind: "found"; exercise: ExerciseSummary } | { kind: "new"; draft: NewExerciseDraft };
export type ImportItem = { key: string; sourceName: string; match: ImportMatch; restSeconds: number | null; sets: ParsedSet[] };
export type ImportDraft = { name: string; notes: string | null; items: ImportItem[]; unparsedLines: string[] };
