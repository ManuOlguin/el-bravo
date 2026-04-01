export type RoutineExerciseMuscleInput = {
  id: string;
  percentage: number;
  muscle: {
    id: string;
    name: string;
    slug: string;
    groupKey: string;
  };
};

export type RoutineExerciseInput = {
  id: string;
  sets: number;
  reps: number;
  exercise: {
    id: string;
    name: string;
    muscles: RoutineExerciseMuscleInput[];
  };
};

export type RoutineMuscleShareItem = {
  muscleId: string;
  muscleName: string;
  muscleSlug: string;
  groupKey: string;
  rawLoad: number;
  sharePct: number;
};

export type RoutineMuscleGroupShareItem = {
  groupKey: string;
  rawLoad: number;
  sharePct: number;
};

export type RoutineMuscleShareResult = {
  totalLoad: number;
  muscles: RoutineMuscleShareItem[];
  groups: RoutineMuscleGroupShareItem[];
  ignoredExercises: {
    exerciseId: string;
    exerciseName: string;
    reason: string;
  }[];
};

function roundTo(value: number, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function calculateRoutineMuscleShare(
  routineExercises: RoutineExerciseInput[]
): RoutineMuscleShareResult {
  const muscleLoadMap = new Map<
    string,
    {
      muscleId: string;
      muscleName: string;
      muscleSlug: string;
      groupKey: string;
      rawLoad: number;
    }
  >();

  const groupLoadMap = new Map<
    string,
    {
      groupKey: string;
      rawLoad: number;
    }
  >();

  const ignoredExercises: RoutineMuscleShareResult["ignoredExercises"] = [];

  for (const routineExercise of routineExercises) {
    const exerciseName = routineExercise.exercise?.name ?? "Ejercicio sin nombre";
    const exerciseId = routineExercise.exercise?.id ?? routineExercise.id;

    const sets = isPositiveNumber(routineExercise.sets) ? routineExercise.sets : 0;
    const reps = isPositiveNumber(routineExercise.reps) ? routineExercise.reps : 0;
    const weight = sets * reps;

    if (weight <= 0) {
      ignoredExercises.push({
        exerciseId,
        exerciseName,
        reason: "sets_or_reps_invalid",
      });
      continue;
    }

    const muscles = routineExercise.exercise?.muscles ?? [];

    if (muscles.length === 0) {
      ignoredExercises.push({
        exerciseId,
        exerciseName,
        reason: "exercise_without_muscle_mapping",
      });
      continue;
    }

    const totalPercentage = muscles.reduce((sum, item) => sum + item.percentage, 0);

    if (totalPercentage <= 0) {
      ignoredExercises.push({
        exerciseId,
        exerciseName,
        reason: "invalid_muscle_percentages",
      });
      continue;
    }

    for (const muscleRelation of muscles) {
      const muscle = muscleRelation.muscle;
      const normalizedShare = muscleRelation.percentage / totalPercentage;
      const contributedLoad = weight * normalizedShare;

      const existingMuscle = muscleLoadMap.get(muscle.id);

      if (existingMuscle) {
        existingMuscle.rawLoad += contributedLoad;
      } else {
        muscleLoadMap.set(muscle.id, {
          muscleId: muscle.id,
          muscleName: muscle.name,
          muscleSlug: muscle.slug,
          groupKey: muscle.groupKey,
          rawLoad: contributedLoad,
        });
      }

      const existingGroup = groupLoadMap.get(muscle.groupKey);

      if (existingGroup) {
        existingGroup.rawLoad += contributedLoad;
      } else {
        groupLoadMap.set(muscle.groupKey, {
          groupKey: muscle.groupKey,
          rawLoad: contributedLoad,
        });
      }
    }
  }

  const totalLoad = Array.from(muscleLoadMap.values()).reduce(
    (sum, item) => sum + item.rawLoad,
    0
  );

  if (totalLoad <= 0) {
    return {
      totalLoad: 0,
      muscles: [],
      groups: [],
      ignoredExercises,
    };
  }

  const muscles: RoutineMuscleShareItem[] = Array.from(muscleLoadMap.values())
    .map((item) => ({
      muscleId: item.muscleId,
      muscleName: item.muscleName,
      muscleSlug: item.muscleSlug,
      groupKey: item.groupKey,
      rawLoad: roundTo(item.rawLoad, 2),
      sharePct: roundTo((item.rawLoad / totalLoad) * 100, 1),
    }))
    .sort((a, b) => b.sharePct - a.sharePct);

  const groups: RoutineMuscleGroupShareItem[] = Array.from(groupLoadMap.values())
    .map((item) => ({
      groupKey: item.groupKey,
      rawLoad: roundTo(item.rawLoad, 2),
      sharePct: roundTo((item.rawLoad / totalLoad) * 100, 1),
    }))
    .sort((a, b) => b.sharePct - a.sharePct);

  return {
    totalLoad: roundTo(totalLoad, 2),
    muscles,
    groups,
    ignoredExercises,
  };
}