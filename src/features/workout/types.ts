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
};
