"use client";
import { cn } from "@/src/components/ui";
import { nextKind, setLabels, type PreviousSetLike } from "./format";
import { PlusIcon } from "./icons";
import { SetRow, setGridClass } from "./SetRow";
import type { ExerciseDraft, SetDraft, WorkoutMode } from "./state";

/** Tabla de series de un ejercicio: Serie · Anterior · kg · Reps (o Seg) · ✓ y "+ Serie" al pie. */
export function SetTable({
  exercise,
  mode,
  previous,
  onChangeSet,
  onToggleDone,
  onRemoveSet,
  onAddSet,
}: {
  exercise: ExerciseDraft;
  mode: WorkoutMode;
  previous?: PreviousSetLike[];
  onChangeSet(setKey: string, patch: Partial<Omit<SetDraft, "key">>): void;
  onToggleDone(set: SetDraft, index: number): void;
  onRemoveSet(setKey: string): void;
  onAddSet(): void;
}) {
  const measure = exercise.exercise.measureType;
  const labels = setLabels(exercise.sets);
  const head = "text-center text-[11px] font-bold uppercase tracking-wide text-fg-subtle";
  return (
    <div>
      <div className={cn("grid items-center gap-1.5 px-1 pb-1", setGridClass(mode))} aria-hidden="true">
        <span className={head}>Serie</span>
        {mode !== "plan" && <span className={head}>Anterior</span>}
        <span className={head}>kg</span>
        <span className={head}>{measure === "duration" ? "Seg" : "Reps"}</span>
        {mode === "live" && <span className={head}>✓</span>}
      </div>
      <div className="space-y-1">
        {exercise.sets.map((set, i) => (
          <SetRow
            key={set.key}
            label={labels[i]}
            set={set}
            mode={mode}
            measure={measure}
            tracksWeight={exercise.exercise.tracksWeight}
            previous={previous?.[i]}
            onChange={(patch) => onChangeSet(set.key, patch)}
            onToggleDone={() => onToggleDone(set, i)}
            onRemove={() => onRemoveSet(set.key)}
            onCycleKind={() => onChangeSet(set.key, { kind: nextKind(set.kind) })}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={onAddSet}
        className="mt-2 flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-surface-2 text-sm font-semibold text-fg-muted transition-[transform,background-color] duration-100 hover:bg-surface-3 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.98]"
      >
        <PlusIcon size={16} />
        Serie
      </button>
    </div>
  );
}
