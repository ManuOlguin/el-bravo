"use client";
import { useReducer, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Field, Input, PageHeader, Textarea, toast } from "@/src/components/ui";
import type { RoutineForEditor } from "@/src/schemas/routine";
import { createRoutineAction, updateRoutineAction } from "@/src/server/actions/routines";
import { WorkoutDraftError, draftFromRoutine, newDraft, toRoutineInput, workoutReducer } from "./state";
import { WorkoutEditor } from "./WorkoutEditor";

const NOW = { localDate: "1970-01-01", localTime: "00:00" }; // en modo plan la fecha no se usa

/**
 * Crear o editar una rutina (modo `plan`): nombre, notas y ejercicios con series objetivo
 * (peso/reps o tiempo y descanso por serie). Los ejercicios nuevos se crean desde el picker,
 * nunca al guardar la rutina (eso causaba el "ya existe un ejercicio" al reintentar).
 */
export function RoutineEditorScreen({ routine }: { routine?: RoutineForEditor }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [draft, dispatch] = useReducer(workoutReducer, undefined, () =>
    routine ? draftFromRoutine(routine, "plan", NOW) : newDraft("plan", NOW)
  );

  const onSave = () => {
    let input;
    try {
      input = toRoutineInput(draft);
    } catch (e) {
      if (e instanceof WorkoutDraftError) {
        setErrors(e.fieldErrors);
        toast.error(e.message);
        return;
      }
      throw e;
    }
    setErrors({});
    start(async () => {
      try {
        const r = routine ? await updateRoutineAction(routine.id, input) : await createRoutineAction(input);
        if (!r.ok) {
          setErrors(r.fieldErrors ?? {});
          toast.error(r.error);
          return;
        }
        toast.success(r.message ?? "Rutina guardada");
        router.push("/routines");
        router.refresh();
      } catch {
        toast.error("No pudimos conectarnos. Revisá tu conexión y probá de nuevo.");
      }
    });
  };

  return (
    <div className="space-y-4 pb-24">
      <PageHeader title={routine ? "Editar rutina" : "Nueva rutina"} back="/routines" />
      <Card className="space-y-3">
        <Field label="Nombre" htmlFor="r-name" error={errors.name?.[0]}>
          <Input
            value={draft.routineName}
            onChange={(e) => dispatch({ type: "setField", field: "routineName", value: e.target.value })}
            placeholder="Ej.: Pecho y tríceps"
            maxLength={100}
            autoComplete="off"
          />
        </Field>
        <Field label="Notas (opcional)" htmlFor="r-notes">
          <Textarea
            rows={2}
            value={draft.notes}
            onChange={(e) => dispatch({ type: "setField", field: "notes", value: e.target.value })}
            maxLength={2000}
          />
        </Field>
      </Card>

      <section className="space-y-3" aria-label="Ejercicios">
        <h2 className="px-1 text-sm font-bold uppercase tracking-wide text-fg-subtle">Ejercicios</h2>
        {errors.exercises && <p className="px-1 text-xs text-danger">{errors.exercises[0]}</p>}
        <p className="px-1 text-xs text-fg-subtle">Los valores son objetivos: kg y reps (o segundos) por serie. Tocá el número de serie para marcarla como calentamiento, drop set o al fallo.</p>
        <WorkoutEditor draft={draft} dispatch={dispatch} />
      </section>

      <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 px-4 sm:bottom-4">
        <div className="mx-auto max-w-screen-sm">
          <Button size="lg" fullWidth onClick={onSave} pending={pending} className="shadow-card">
            {routine ? "Guardar cambios" : "Crear rutina"}
          </Button>
        </div>
      </div>
    </div>
  );
}
