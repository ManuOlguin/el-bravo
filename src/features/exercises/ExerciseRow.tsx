"use client";
import { Pill, cn } from "@/src/components/ui";
import { ExerciseInfoButton } from "./ExerciseInfoButton";
import { ExerciseThumb } from "./ExerciseThumb";
import { EQUIPMENT_LABEL, GROUP_LABEL, type CatalogEntry } from "./types";

/** Fila del picker: miniatura, nombre, equipamiento · grupo, check si está elegido y botón "?" a la derecha. */
export function ExerciseRow({
  exercise,
  selected,
  onSelect,
}: {
  exercise: CatalogEntry;
  selected: boolean;
  onSelect(exercise: CatalogEntry): void;
}) {
  const subtitle = [EQUIPMENT_LABEL[exercise.equipment], exercise.primaryGroupKey ? GROUP_LABEL[exercise.primaryGroupKey] : null]
    .filter(Boolean)
    .join(" · ");
  return (
    <li className={cn("flex items-center gap-2 rounded-xl pr-2 transition-colors", selected && "bg-surface-2")}>
      <button
        type="button"
        aria-pressed={selected}
        onClick={() => onSelect(exercise)}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 text-left",
          "transition-transform duration-100 active:scale-[0.99] hover:bg-surface-2/60",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        )}
      >
        <span className="relative">
          <ExerciseThumb mediaUrl={exercise.mediaUrl} groupKey={exercise.primaryGroupKey} />
          {selected && (
            <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-primary text-on-primary" aria-hidden="true">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12l5 5 9-10" />
              </svg>
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold">{exercise.name}</span>
            {exercise.isMine && <Pill className="shrink-0 px-2 py-0 text-[10px]">Mío</Pill>}
          </span>
          <span className="block truncate text-xs text-fg-muted">
            {subtitle}
            {exercise.measureType === "duration" ? " · por tiempo" : ""}
          </span>
        </span>
      </button>
      <ExerciseInfoButton exerciseId={exercise.id} name={exercise.name} />
    </li>
  );
}
