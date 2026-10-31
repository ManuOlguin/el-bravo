import type { CreateRoutineInput } from "@/src/schemas/routine";

/**
 * PUENTE (W0-C) entre el formato viejo de rutina (sets/reps/tiempo/peso planos por ejercicio)
 * y el modelo v2 (`RoutineExercise` + N `RoutineSet` iguales, con `position`).
 * Se borra cuando W2-1 reemplace `app/api/routine/*` por Server Actions.
 */

type MeasureById = Map<string, { measureType: "reps" | "duration" }>;

export function routineExercisesCreate(exercises: CreateRoutineInput["exercises"], measureById: MeasureById) {
  return exercises.map((e, position) => {
    const isDuration = measureById.get(e.exerciseId)?.measureType === "duration";
    return {
      exerciseId: e.exerciseId,
      position,
      sets: {
        create: Array.from({ length: e.sets }, (_, i) => ({
          position: i,
          targetReps: isDuration ? null : (e.reps ?? null),
          targetDurationSeconds: isDuration ? (e.durationSeconds ?? null) : null,
          targetWeightKg: e.weightKg ?? null,
        })),
      },
    };
  });
}

type RoutineExerciseWithSets = {
  id: string;
  sets: { targetReps: number | null; targetDurationSeconds: number | null; targetWeightKg: number | null }[];
};

/** v2 → formato viejo que esperan RoutineForm y CreateActivityForm (toma la primera serie). */
export function legacyRoutineFields(re: RoutineExerciseWithSets) {
  const first = re.sets[0];
  return {
    sets: re.sets.length,
    reps: first?.targetReps ?? null,
    durationSeconds: first?.targetDurationSeconds ?? null,
    weightKg: first?.targetWeightKg ?? null,
  };
}

export const routineSetsInclude = { orderBy: { position: "asc" as const } };
