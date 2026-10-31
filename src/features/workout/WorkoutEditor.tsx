"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/src/components/ui";
import { ExercisePicker, type ExerciseSummary } from "@/src/features/exercises";
import { getLastPerformanceAction } from "@/src/server/actions/activities";
import { ExerciseBlock } from "./ExerciseBlock";
import type { PreviousSetLike } from "./format";
import { PlusIcon } from "./icons";
import { primeRestAudio } from "./rest-alerts";
import { RestTimer, useRestTimer } from "./RestTimer";
import { restFor } from "./rest-timer";
import type { ExerciseDraft, SetDraft, WorkoutAction, WorkoutDraft } from "./state";

export type PreviousLoader = (exerciseIds: string[], excludeActivityId?: string | null) => Promise<Record<string, PreviousSetLike[]>>;

const defaultLoader: PreviousLoader = async (ids, exclude) => {
  const r = await getLastPerformanceAction(ids, exclude);
  return r.ok ? r.data : {};
};

/**
 * Editor tipo Strong (modos plan/log/live). El estado lo maneja el padre con `workoutReducer`
 * (así lo puede persistir y enviar); este componente orquesta bloques, picker y descanso.
 */
export function WorkoutEditor({
  draft,
  dispatch,
  excludeActivityId,
  loadPrevious = defaultLoader,
  restTimerClassName,
  restTimerKey,
  className,
}: {
  draft: WorkoutDraft;
  dispatch: React.Dispatch<WorkoutAction>;
  /** Al editar: que "Anterior" no muestre el mismo entrenamiento. */
  excludeActivityId?: string | null;
  /** Para demos/tests: reemplaza la Server Action de "Anterior". */
  loadPrevious?: PreviousLoader;
  /** Posición vertical de la barra de descanso (por defecto, arriba de la navegación inferior). */
  restTimerClassName?: string;
  /** Modo live: clave para guardar el descanso en curso (ver `useRestTimer`). */
  restTimerKey?: string;
  className?: string;
}) {
  const [picker, setPicker] = useState<{ mode: "add" } | { mode: "replace"; key: string } | null>(null);
  const [previous, setPrevious] = useState<Record<string, PreviousSetLike[]>>({});
  const [timer, setTimer] = useRestTimer(restTimerKey);
  const requested = useRef(new Set<string>());
  const mode = draft.mode;

  // "Anterior": pide solo los ejercicios que todavía no se pidieron.
  const idsKey = useMemo(() => [...new Set(draft.exercises.map((e) => e.exercise.id))].sort().join(","), [draft.exercises]);
  useEffect(() => {
    if (mode === "plan" || !idsKey) return;
    const missing = idsKey.split(",").filter((id) => !requested.current.has(id));
    if (missing.length === 0) return;
    missing.forEach((id) => requested.current.add(id));
    // Sin cancelar en el cleanup: cada id se pide una sola vez (con el doble efecto de StrictMode,
    // cancelar descartaba la única respuesta) y el resultado es válido aunque cambie la lista.
    loadPrevious(missing, excludeActivityId)
      .then((data) => setPrevious((p) => ({ ...p, ...data })))
      .catch(() => missing.forEach((id) => requested.current.delete(id)));
  }, [idsKey, mode, excludeActivityId, loadPrevious]);

  const onSetDone = useCallback(
    (ex: ExerciseDraft, set: SetDraft, index: number) => {
      const becomingDone = !set.completed;
      // Serie vacía: completa con lo de la última vez (si hay); si no, el reducer copia la serie anterior.
      const prev = previous[ex.exercise.id]?.[index];
      if (becomingDone && set.reps === null && set.durationSeconds === null && set.weightKg === null && prev) {
        dispatch({
          type: "updateSet",
          exerciseKey: ex.key,
          setKey: set.key,
          patch: { reps: prev.reps, durationSeconds: prev.durationSeconds, weightKg: ex.exercise.tracksWeight ? prev.weightKg : null },
        });
      }
      const now = Date.now();
      dispatch({ type: "toggleSetDone", exerciseKey: ex.key, setKey: set.key, nowMs: now });
      if (mode !== "live") return;
      const rest = restFor(set, ex);
      // Dentro del toque: habilita el audio para que los pitidos del fin puedan sonar.
      if (becomingDone && rest > 0) primeRestAudio();
      if (becomingDone && rest > 0) setTimer({ id: now, startMs: now, totalS: rest });
      else if (!becomingDone) setTimer(null);
    },
    [dispatch, mode, previous, setTimer],
  );

  const onPick = (exercises: ExerciseSummary[]) => {
    if (!picker) return;
    if (picker.mode === "add") dispatch({ type: "addExercises", exercises });
    else if (exercises[0]) dispatch({ type: "replaceExercise", key: picker.key, exercise: exercises[0] });
  };

  return (
    <div className={cn("space-y-3", className)}>
      {draft.exercises.map((ex, i) => (
        <ExerciseBlock
          key={ex.key}
          exercise={ex}
          mode={mode}
          index={i}
          count={draft.exercises.length}
          previous={previous[ex.exercise.id]}
          dispatch={dispatch}
          onReplace={(key) => setPicker({ mode: "replace", key })}
          onSetDone={onSetDone}
        />
      ))}

      <button
        type="button"
        onClick={() => setPicker({ mode: "add" })}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-card border-2 border-dashed border-primary/50 bg-primary/5 text-base font-bold text-primary transition-[transform,background-color] duration-100 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.98]"
      >
        <PlusIcon />
        Agregar ejercicios
      </button>

      <ExercisePicker
        open={picker !== null}
        multiple={picker?.mode !== "replace"}
        title={picker?.mode === "replace" ? "Reemplazar por…" : undefined}
        onClose={() => setPicker(null)}
        onConfirm={onPick}
      />

      {mode === "live" && (
        <RestTimer timer={timer} onChange={setTimer} className={restTimerClassName ?? "bottom-[calc(4.5rem+env(safe-area-inset-bottom))] sm:bottom-4"} />
      )}
    </div>
  );
}
