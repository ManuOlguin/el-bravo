"use client";
// Sección "Entrenamientos" del catálogo /dev/ui (W2-1): WorkoutEditor en los 3 modos con datos de ejemplo.
import { useReducer, useState } from "react";
import { Tabs } from "@/src/components/ui";
import type { ExerciseSummary } from "@/src/features/exercises";
import {
  WorkoutEditor,
  draftFromRoutine,
  draftSummary,
  formatVolume,
  workoutReducer,
  type PreviousLoader,
  type WorkoutMode,
} from "@/src/features/workout";
import type { RoutineForEditor } from "@/src/schemas/routine";

const bench: ExerciseSummary = { id: "demo-bench", name: "Press banca", nameEn: "Bench press", measureType: "reps", equipment: "barbell", tracksWeight: true, primaryGroupKey: "chest", mediaUrl: null };
const plank: ExerciseSummary = { id: "demo-plank", name: "Plancha", nameEn: "Plank", measureType: "duration", equipment: "bodyweight", tracksWeight: false, primaryGroupKey: "core", mediaUrl: null };
const pullup: ExerciseSummary = { id: "demo-pullup", name: "Dominadas", nameEn: "Pull-up", measureType: "reps", equipment: "bodyweight", tracksWeight: false, primaryGroupKey: "back", mediaUrl: null };

const SAMPLE: RoutineForEditor = {
  id: "demo",
  name: "Pecho y espalda",
  notes: null,
  exercises: [
    { exercise: plank, restSeconds: 30, notes: null, sets: [{ kind: "normal", targetReps: null, targetDurationSeconds: 45, targetWeightKg: null, restSeconds: null }] },
    {
      exercise: bench,
      restSeconds: 90,
      notes: null,
      sets: [
        { kind: "warmup", targetReps: 12, targetDurationSeconds: null, targetWeightKg: 20, restSeconds: 45 },
        ...[40, 45, 50].map((w) => ({ kind: "normal" as const, targetReps: 10, targetDurationSeconds: null, targetWeightKg: w, restSeconds: null })),
      ],
    },
    { exercise: pullup, restSeconds: 15, notes: null, sets: [{ kind: "normal", targetReps: 8, targetDurationSeconds: null, targetWeightKg: null, restSeconds: null }, { kind: "failure", targetReps: null, targetDurationSeconds: null, targetWeightKg: null, restSeconds: null }] },
  ],
};

const fakePrevious: PreviousLoader = async (ids) =>
  Object.fromEntries(
    ids
      .filter((id) => id === "demo-bench" || id === "demo-pullup")
      .map((id) => [
        id,
        id === "demo-bench"
          ? [{ reps: 12, weightKg: 20, durationSeconds: null }, { reps: 10, weightKg: 40, durationSeconds: null }, { reps: 9, weightKg: 45, durationSeconds: null }]
          : [{ reps: 7, weightKg: null, durationSeconds: null }],
      ])
  );

function Demo({ mode }: { mode: WorkoutMode }) {
  const [draft, dispatch] = useReducer(workoutReducer, undefined, () =>
    draftFromRoutine(SAMPLE, mode, { localDate: "2026-10-31", localTime: "18:00", nowMs: 0 })
  );
  const s = draftSummary(draft);
  return (
    <div className="space-y-2">
      <p className="text-xs text-fg-muted">
        {s.exercises} ejercicios · {s.setsDone}/{s.setsTotal} series hechas · {formatVolume(s.volumeKg)}
      </p>
      <WorkoutEditor draft={draft} dispatch={dispatch} loadPrevious={fakePrevious} />
    </div>
  );
}

export function WorkoutSection() {
  const [mode, setMode] = useState<WorkoutMode>("live");
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-bold uppercase tracking-wide text-fg-subtle">Entrenamientos (W2-1)</h2>
      <Tabs<WorkoutMode>
        aria-label="Modo del editor"
        tabs={[
          { id: "plan", label: "Rutina" },
          { id: "log", label: "Registrar" },
          { id: "live", label: "En vivo" },
        ]}
        value={mode}
        onChange={setMode}
      />
      <Demo key={mode} mode={mode} />
    </section>
  );
}
