/** Tipos compartidos entre las pantallas (cliente) y las lecturas del servidor de W2-1. */
import type { ScoringEffect } from "@/src/server/scoring/types";
import type { BadgeChange } from "@/src/server/badges/types";
import type { SetKind } from "./state";

export type CategoryOption = { id: string; slug: string; name: string; usesExercises: boolean };

export type PreviousSet = { kind: SetKind; reps: number | null; durationSeconds: number | null; weightKg: number | null };

export type RoutineOption = { id: string; name: string; exerciseCount: number; setCount: number };

/** Lo que devuelven create/update para la pantalla de resultado. */
export type SubmitOutcome = {
  activityId: string;
  effects: { scoring: ScoringEffect[]; badges: BadgeChange[] };
  sharedDaySeasonIds: string[];
  replayed: boolean;
  /** Solo al crear (no en ediciones ni reintentos): datos extra para la secuencia de festejo. */
  celebration?: Celebration | null;
};

/** Récord personal de peso logrado en este entrenamiento. */
export type NewRecord = { exerciseId: string; exerciseName: string; weightKg: number; reps: number | null; previousKg: number };

/** Lo que la secuencia de festejo necesita además de los efectos de puntos e insignias. */
export type Celebration = {
  /** Cuántos entrenamientos lleva el usuario, contando este. */
  workoutNumber: number;
  /** Semana del entrenamiento, solo si es la semana en curso. */
  week: { workouts: number; goal: number; justMet: boolean; perfectStreak: number } | null;
  records: NewRecord[];
  /** Por temporada en la que subió de puesto: nombres de quienes pasó. */
  passed: { seasonId: string; names: string[] }[];
};
