"use client";
import { useState } from "react";
import { Card, Chip, IconButton, Pill, Sheet, Textarea, cn } from "@/src/components/ui";
import { ExerciseInfoButton, ExerciseThumb } from "@/src/features/exercises";
import { isPendingExerciseId } from "@/src/features/routines-share/match";
import { REST_PRESETS, formatSeconds, restLabel, type PreviousSetLike } from "./format";
import { ArrowIcon, MoreIcon, NoteIcon, SwapIcon, TimerIcon, TrashIcon } from "./icons";
import { SetTable } from "./SetTable";
import type { ExerciseDraft, SetDraft, WorkoutAction, WorkoutMode } from "./state";

function MenuItem({
  icon,
  children,
  onClick,
  danger,
  disabled,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick(): void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold transition-[transform,background-color] duration-100",
        "hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.98] disabled:opacity-40",
        danger ? "text-danger" : "text-fg"
      )}
    >
      <span className={cn("grid h-8 w-8 place-items-center rounded-lg", danger ? "bg-danger/15" : "bg-surface-2 text-fg-muted")}>{icon}</span>
      {children}
    </button>
  );
}

/** Un ejercicio del entrenamiento: encabezado (nombre, "?", menú ⋯), notas y tabla de series. */
export function ExerciseBlock({
  exercise: ex,
  mode,
  index,
  count,
  previous,
  dispatch,
  onReplace,
  onSetDone,
}: {
  exercise: ExerciseDraft;
  mode: WorkoutMode;
  index: number;
  count: number;
  previous?: PreviousSetLike[];
  dispatch: React.Dispatch<WorkoutAction>;
  onReplace(exerciseKey: string): void;
  onSetDone(ex: ExerciseDraft, set: SetDraft, index: number): void;
}) {
  const [menu, setMenu] = useState<null | "main" | "rest">(null);
  const [showNotes, setShowNotes] = useState(ex.notes.length > 0);
  const close = () => setMenu(null);
  const done = ex.sets.filter((s) => s.completed).length;

  return (
    <Card as="section" className="p-3">
      <div className="mb-2 flex items-center gap-2">
        <ExerciseThumb mediaUrl={ex.exercise.mediaUrl} groupKey={ex.exercise.primaryGroupKey} className="h-10 w-10" />
        <button
          type="button"
          onClick={() => setMenu("main")}
          className="min-w-0 flex-1 rounded-lg py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <h3 className="truncate text-base font-bold text-primary">{ex.exercise.name}</h3>
          <p className="truncate text-xs text-fg-subtle">
            {mode === "live" ? `${done}/${ex.sets.length} · ` : ""}
            {ex.restSeconds ? `Descanso ${formatSeconds(ex.restSeconds)}` : "Sin descanso"}
          </p>
        </button>
        {isPendingExerciseId(ex.exercise.id) ? (
          <span title="Se crea al guardar la rutina">
            <Pill tone="primary">Nuevo</Pill>
          </span>
        ) : (
          <ExerciseInfoButton exerciseId={ex.exercise.id} name={ex.exercise.name} />
        )}
        <IconButton label={`Opciones de ${ex.exercise.name}`} onClick={() => setMenu("main")}>
          <MoreIcon />
        </IconButton>
      </div>

      {showNotes && (
        <Textarea
          rows={2}
          value={ex.notes}
          placeholder="Notas del ejercicio (agarre, máquina, sensaciones…)"
          aria-label={`Notas de ${ex.exercise.name}`}
          onChange={(e) => dispatch({ type: "updateExercise", key: ex.key, patch: { notes: e.target.value } })}
          className="mb-2 text-sm"
          maxLength={500}
        />
      )}

      <SetTable
        exercise={ex}
        mode={mode}
        previous={previous}
        onChangeSet={(setKey, patch) => dispatch({ type: "updateSet", exerciseKey: ex.key, setKey, patch })}
        onToggleDone={(set, i) => onSetDone(ex, set, i)}
        onRemoveSet={(setKey) => dispatch({ type: "removeSet", exerciseKey: ex.key, setKey })}
        onAddSet={() => dispatch({ type: "addSet", exerciseKey: ex.key })}
      />

      <Sheet open={menu !== null} onClose={close} title={menu === "rest" ? "Descanso entre series" : ex.exercise.name}>
        {menu === "rest" ? (
          <div className="flex flex-wrap gap-2">
            {REST_PRESETS.map((s) => (
              <Chip
                key={s}
                selected={ex.restSeconds === s}
                onClick={() => {
                  dispatch({ type: "updateExercise", key: ex.key, patch: { restSeconds: s } });
                  close();
                }}
              >
                {s === 0 ? "Sin descanso" : formatSeconds(s)}
              </Chip>
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            <MenuItem
              icon={<SwapIcon size={16} />}
              onClick={() => {
                close();
                onReplace(ex.key);
              }}
            >
              Reemplazar ejercicio
            </MenuItem>
            <MenuItem
              icon={<ArrowIcon dir="up" size={16} />}
              disabled={index === 0}
              onClick={() => {
                dispatch({ type: "moveExercise", key: ex.key, dir: -1 });
                close();
              }}
            >
              Mover arriba
            </MenuItem>
            <MenuItem
              icon={<ArrowIcon dir="down" size={16} />}
              disabled={index === count - 1}
              onClick={() => {
                dispatch({ type: "moveExercise", key: ex.key, dir: 1 });
                close();
              }}
            >
              Mover abajo
            </MenuItem>
            <MenuItem icon={<TimerIcon size={16} />} onClick={() => setMenu("rest")}>
              {restLabel(ex.restSeconds)}
            </MenuItem>
            <MenuItem
              icon={<NoteIcon size={16} />}
              onClick={() => {
                setShowNotes((v) => !v);
                close();
              }}
            >
              {showNotes ? "Ocultar notas" : "Agregar nota"}
            </MenuItem>
            <MenuItem
              danger
              icon={<TrashIcon size={16} />}
              onClick={() => {
                dispatch({ type: "removeExercise", key: ex.key });
                close();
              }}
            >
              Quitar ejercicio
            </MenuItem>
          </div>
        )}
      </Sheet>
    </Card>
  );
}
