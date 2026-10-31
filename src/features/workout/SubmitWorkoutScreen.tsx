"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, LinkButton, Spinner, cn, toast } from "@/src/components/ui";
import { uploadPendingPhotos } from "@/src/features/media";
import { createActivityAction, updateActivityAction } from "@/src/server/actions/activities";
import { updateRoutineFromWorkoutAction } from "@/src/server/actions/routines";
import type { ActivityInput } from "@/src/schemas/workout";
import { buildCelebrationSteps } from "./celebration";
import { CelebrationSequence } from "./CelebrationSequence";
import { CheckIcon } from "./icons";
import type { SubmitOutcome } from "./types";
import { WorkoutResult, type WorkoutSummaryNumbers } from "./WorkoutResult";

type Phase = "saving" | "photos" | "error" | "done";
type StepState = "pending" | "active" | "done" | "error";

const NETWORK_ERROR = "No pudimos conectarnos con el servidor. Revisá tu conexión y reintentá: no se va a duplicar.";

function Step({ state, children }: { state: StepState; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span
        className={cn(
          "grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold",
          state === "done" && "bg-primary-gradient text-on-primary",
          state === "active" && "bg-surface-3 text-fg",
          state === "pending" && "bg-surface-2 text-fg-subtle",
          state === "error" && "bg-danger/20 text-danger"
        )}
        aria-hidden="true"
      >
        {state === "done" ? <CheckIcon size={14} /> : state === "active" ? <Spinner size={14} /> : state === "error" ? "!" : "·"}
      </span>
      <span className={cn("text-sm", state === "pending" ? "text-fg-subtle" : "text-fg")}>{children}</span>
    </li>
  );
}

/**
 * Pantalla de envío (cubre "fix pantalla post entrenamiento"): aparece al tocar Guardar con
 * "Guardando → Calculando puntos → Subiendo fotos"; si falla, "Reintentar" reenvía con el MISMO
 * clientRequestId (no duplica) o "Volver a editar" (el borrador se conserva). Si sale bien, sube las
 * fotos y muestra el resultado: puntos por temporada e insignias afectadas.
 * Al crear (no al editar ni en un reintento que ya estaba guardado), antes del resumen pasa por la
 * secuencia de festejo (`CelebrationSequence`): una pantalla por logro.
 */
export function SubmitWorkoutScreen({
  open,
  kind,
  activityId: editingId,
  input,
  photos,
  summary,
  routine,
  onBackToEdit,
  onSaved,
}: {
  open: boolean;
  kind: "create" | "edit";
  /** Solo al editar. */
  activityId?: string;
  input: ActivityInput | null;
  photos: File[];
  summary: WorkoutSummaryNumbers;
  /** Modo en vivo: ofrece "Actualizar la rutina con estos pesos". */
  routine?: { id: string; name: string } | null;
  onBackToEdit(): void;
  /** Se guardó (antes de subir fotos): el padre limpia el borrador. */
  onSaved?(activityId: string): void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("saving");
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<SubmitOutcome | null>(null);
  const [failedPhotos, setFailedPhotos] = useState<File[]>([]);
  const [retryingPhotos, setRetryingPhotos] = useState(false);
  const [routineState, setRoutineState] = useState<"idle" | "saving" | "done">("idle");
  const [celebrated, setCelebrated] = useState(false);
  const started = useRef<ActivityInput | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const submit = useCallback(
    async (body: ActivityInput) => {
      setPhase("saving");
      setError(null);
      let result: SubmitOutcome;
      try {
        if (kind === "edit" && editingId) {
          const r = await updateActivityAction(editingId, body);
          if (!r.ok) throw Object.assign(new Error(r.error), { userMessage: r.error });
          result = { activityId: editingId, effects: r.data.effects, sharedDaySeasonIds: r.data.sharedDaySeasonIds, replayed: false };
        } else {
          const r = await createActivityAction(body);
          if (!r.ok) throw Object.assign(new Error(r.error), { userMessage: r.error });
          result = r.data;
        }
      } catch (e) {
        setError((e as { userMessage?: string }).userMessage ?? NETWORK_ERROR);
        setPhase("error");
        return;
      }
      setOutcome(result);
      onSaved?.(result.activityId);
      router.refresh();
      if (photos.length > 0) {
        setPhase("photos");
        const { failed } = await uploadPendingPhotos(result.activityId, photos);
        setFailedPhotos(failed);
      }
      setPhase("done");
    },
    [kind, editingId, photos, onSaved, router]
  );

  // Arranca el envío al abrir (una sola vez por input, aun con el doble efecto de StrictMode).
  useEffect(() => {
    if (!open || !input || started.current === input) return;
    started.current = input;
    void submit(input);
  }, [open, input, submit]);

  const retryPhotos = async () => {
    if (!outcome) return;
    setRetryingPhotos(true);
    const { failed } = await uploadPendingPhotos(outcome.activityId, failedPhotos);
    setRetryingPhotos(false);
    setFailedPhotos(failed);
    if (failed.length === 0) toast.success("Fotos subidas");
    else toast.error(`${failed.length === 1 ? "1 foto no se subió" : `${failed.length} fotos no se subieron`}. Probá de nuevo.`);
  };

  const updateRoutine = async () => {
    if (!routine || !input) return;
    setRoutineState("saving");
    try {
      const r = await updateRoutineFromWorkoutAction(routine.id, input);
      if (r.ok) {
        setRoutineState("done");
        toast.success(`Actualizaste «${routine.name}»`);
      } else {
        setRoutineState("idle");
        toast.error(r.error);
      }
    } catch {
      setRoutineState("idle");
      toast.error(NETWORK_ERROR);
    }
  };

  const steps = useMemo(
    () =>
      outcome && kind === "create" && !outcome.replayed
        ? buildCelebrationSteps(outcome.effects.scoring, outcome.effects.badges, outcome.celebration ?? null)
        : [],
    [outcome, kind]
  );
  const celebrating = phase === "done" && steps.length > 0 && !celebrated;

  const savingState: StepState = phase === "saving" ? "active" : phase === "error" ? "error" : "done";
  const pointsState: StepState = phase === "saving" ? "pending" : phase === "error" ? "pending" : "done";
  const photosState: StepState = phase === "photos" ? "active" : phase === "done" ? (failedPhotos.length ? "error" : "done") : "pending";

  return (
    <dialog
      ref={ref}
      aria-label={celebrating ? "Festejo del entrenamiento" : phase === "done" ? "Resultado del entrenamiento" : "Guardando tu entrenamiento"}
      // Mientras guarda no se puede cerrar con Esc; en error/resultado, Esc = volver/ir.
      onCancel={(e) => {
        e.preventDefault();
        if (phase === "error") onBackToEdit();
      }}
      className="m-0 h-dvh max-h-none w-screen max-w-none overflow-y-auto bg-bg p-0 text-fg backdrop:bg-bg"
    >
      <div className="mx-auto flex min-h-full w-full max-w-screen-sm flex-col px-4 pb-safe pt-safe">
        {phase !== "done" ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 py-10">
            {phase === "error" ? (
              <>
                <div className="grid h-16 w-16 place-items-center rounded-full bg-danger/15 text-3xl" aria-hidden="true">
                  ⚠️
                </div>
                <div className="space-y-2 text-center">
                  <h2 className="text-2xl font-extrabold">No se pudo guardar</h2>
                  <p role="alert" className="text-sm text-fg-muted">
                    {error}
                  </p>
                  <p className="text-xs text-fg-subtle">Tu entrenamiento sigue acá: no perdiste nada.</p>
                </div>
              </>
            ) : (
              <>
                <Spinner size={40} className="text-primary" />
                <h2 className="text-2xl font-extrabold">{kind === "edit" ? "Guardando los cambios…" : "Guardando tu entrenamiento…"}</h2>
              </>
            )}
            <ol className="w-full max-w-xs space-y-3" aria-label="Pasos">
              <Step state={savingState}>Guardando</Step>
              <Step state={pointsState}>Calculando puntos</Step>
              {photos.length > 0 && <Step state={photosState}>Subiendo fotos</Step>}
            </ol>
            {phase === "error" && input && (
              <div className="flex w-full max-w-xs flex-col gap-2">
                <Button size="lg" fullWidth onClick={() => void submit(input)}>
                  Reintentar
                </Button>
                <Button size="lg" variant="ghost" fullWidth onClick={onBackToEdit}>
                  Volver a editar
                </Button>
              </div>
            )}
          </div>
        ) : celebrating ? (
          <CelebrationSequence
            steps={steps}
            summary={summary}
            sharedDaySeasonIds={outcome?.sharedDaySeasonIds ?? []}
            onDone={() => setCelebrated(true)}
          />
        ) : (
          outcome && (
            <div className="py-8">
              <WorkoutResult
                title={kind === "edit" ? "Entrenamiento actualizado" : outcome.replayed ? "Ya estaba guardado 👌" : "¡Bien ahí! 💪"}
                subtitle={outcome.replayed ? "El primer intento había llegado: no se duplicó." : undefined}
                summary={summary}
                scoring={outcome.effects.scoring}
                badges={outcome.effects.badges}
                sharedDaySeasonIds={outcome.sharedDaySeasonIds}
              >
                {failedPhotos.length > 0 && (
                  <div role="alert" className="flex items-center justify-between gap-3 rounded-card border border-warning/40 bg-warning/10 px-4 py-3">
                    <p className="text-sm">
                      {failedPhotos.length === 1 ? "1 foto no se subió" : `${failedPhotos.length} fotos no se subieron`}
                    </p>
                    <Button size="sm" variant="secondary" pending={retryingPhotos} onClick={retryPhotos}>
                      Reintentar fotos
                    </Button>
                  </div>
                )}
                {routine && (
                  <Button
                    variant="secondary"
                    fullWidth
                    pending={routineState === "saving"}
                    disabled={routineState === "done"}
                    onClick={updateRoutine}
                  >
                    {routineState === "done" ? "Rutina actualizada ✓" : "Actualizar la rutina con estos pesos"}
                  </Button>
                )}
                <div className="flex flex-col gap-2 pt-2">
                  <LinkButton href={`/workout/${outcome.activityId}`} size="lg" fullWidth>
                    Ver entrenamiento
                  </LinkButton>
                  <LinkButton href="/home" size="lg" variant="ghost" fullWidth>
                    Ir al inicio
                  </LinkButton>
                </div>
              </WorkoutResult>
            </div>
          )
        )}
      </div>
    </dialog>
  );
}
