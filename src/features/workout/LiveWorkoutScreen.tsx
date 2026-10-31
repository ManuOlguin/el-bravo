"use client";
import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Sheet, toast, useConfirm } from "@/src/components/ui";
import type { RoutineForEditor } from "@/src/schemas/routine";
import type { ActivityInput } from "@/src/schemas/workout";
import { CategoryPicker } from "./CategoryPicker";
import { formatVolume } from "./format";
import { formatClock } from "./rest-timer";
import {
  WorkoutDraftError,
  defaultStart,
  draftFromRoutine,
  draftSummary,
  inputSummary,
  toActivityInput,
  workoutReducer,
  type WorkoutDraft,
} from "./state";
import { SubmitWorkoutScreen } from "./SubmitWorkoutScreen";
import type { CategoryOption } from "./types";
import { draftKey, readDraft, useDraftPersistence } from "./useDraftPersistence";
import { WorkoutEditor } from "./WorkoutEditor";

function freshDraft(routine: RoutineForEditor, tz: string): WorkoutDraft {
  const nowMs = Date.now();
  return draftFromRoutine(routine, "live", { ...defaultStart(nowMs, null, tz), nowMs });
}

/** Mantiene la pantalla prendida mientras se entrena (Wake Lock API, si existe). */
function useWakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let active = true;
    const request = async () => {
      try {
        const l = (await navigator.wakeLock?.request("screen")) ?? null;
        if (active) lock = l;
        else void l?.release();
      } catch {
        // sin permiso / sin soporte: la pantalla se apaga como siempre
      }
    };
    void request();
    const onVisible = () => {
      if (document.visibilityState === "visible") void request();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => undefined);
    };
  }, []);
}

/** Bloquea el scroll del documento mientras el overlay está montado. */
function useScrollLock() {
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = prev;
    };
  }, []);
}

/**
 * Modo en vivo (`/routines/[id]/live`): pantalla completa sobre el shell, cronómetro, series para
 * tachar con descanso y "Terminar" → categoría (Fuerza por defecto) → `SubmitWorkoutScreen`.
 * El borrador vive en localStorage: si se cierra la pestaña, al volver ofrece retomarlo.
 */
export function LiveWorkoutScreen({ routine, categories, tz }: { routine: RoutineForEditor; categories: CategoryOption[]; tz: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [draft, dispatch] = useReducer(workoutReducer, undefined, () => freshDraft(routine, tz));
  /** Respuesta a "¿retomar el entrenamiento en curso?" (solo se pregunta si había uno guardado). */
  const [choice, setChoice] = useState<"resume" | "discard" | null>(null);
  const [saved, setSaved] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const [categorySheet, setCategorySheet] = useState(false);
  const defaultCategory = categories.find((c) => c.slug === "strength") ?? categories.find((c) => c.usesExercises) ?? categories[0];
  const [categoryId, setCategoryId] = useState<string | null>(defaultCategory?.id ?? null);
  const [submitting, setSubmitting] = useState<ActivityInput | null>(null);
  const [beforeFinish, setBeforeFinish] = useState<WorkoutDraft | null>(null);

  const key = draftKey("live", routine.id);
  // `stored` se lee después de montar; mientras tanto (undefined) no se guarda nada para no pisar el borrador viejo.
  const [stored, setStored] = useState<ReturnType<typeof readDraft> | undefined>(undefined);
  // Solo se ofrece retomar si había series tildadas; si no, se arranca de cero sin preguntar.
  const hasResumable =
    !!stored && stored.draft.mode === "live" && stored.draft.startedAtMs !== null && draftSummary(stored.draft).setsDone > 0;
  const decided = stored !== undefined && (!hasResumable || choice !== null);
  const { clear } = useDraftPersistence(key, draft, decided && !saved);
  const resumable = !decided && hasResumable ? stored : null;

  useWakeLock();
  useScrollLock();

  useEffect(() => {
    setStored(readDraft(key));
  }, [key]);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const summary = draftSummary(draft);
  const elapsed =
    decided && now !== null && draft.startedAtMs !== null ? Math.max(0, Math.floor((now - draft.startedAtMs) / 1000)) : null;

  const resume = () => {
    if (!resumable) return;
    dispatch({ type: "replace", draft: resumable.draft });
    setChoice("resume");
  };
  const discardSaved = () => {
    clear();
    dispatch({ type: "replace", draft: freshDraft(routine, tz) });
    setChoice("discard");
  };

  const onFinish = async () => {
    if (summary.setsDone === 0) {
      const discard = await confirm({
        title: "No tildaste ninguna serie",
        description: "Para guardar el entrenamiento tildá al menos una serie. ¿Querés descartarlo?",
        confirmLabel: "Descartar",
        cancelLabel: "Seguir entrenando",
        danger: true,
      });
      if (discard) {
        clear();
        setSaved(true);
        router.push("/routines");
      }
      return;
    }
    if (summary.setsDone < summary.setsTotal) {
      const rest = summary.setsTotal - summary.setsDone;
      const kept = summary.setsDone === 1 ? "Se guarda la serie tildada" : `Se guardan las ${summary.setsDone} series tildadas`;
      const dropped = rest === 1 ? "la otra se descarta" : `las otras ${rest} se descartan`;
      const yes = await confirm({
        title: "¿Terminar el entrenamiento?",
        description: `${kept}; ${dropped}.`,
        confirmLabel: "Terminar",
      });
      if (!yes) return;
    }
    setCategorySheet(true);
  };

  const onSave = () => {
    if (!categoryId) {
      toast.error("Elegí qué hiciste");
      return;
    }
    const finished = workoutReducer({ ...draft, activityCategoryId: categoryId }, { type: "finishLive", nowMs: Date.now(), tz });
    try {
      const input = toActivityInput(finished);
      setCategorySheet(false);
      setBeforeFinish(draft);
      dispatch({ type: "replace", draft: finished });
      setSubmitting(input);
    } catch (e) {
      if (e instanceof WorkoutDraftError) toast.error(e.message);
      else throw e;
    }
  };

  const onSaved = useCallback(() => {
    setSaved(true);
    clear();
  }, [clear]);

  const submitSummary = useMemo(
    () => (submitting ? inputSummary(submitting) : { durationMinutes: 0, exercises: 0, sets: 0, volumeKg: 0 }),
    [submitting]
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg">
      <header className="shrink-0 border-b border-border bg-surface-1/95 pt-safe backdrop-blur">
        <div className="mx-auto flex max-w-screen-sm items-center gap-2 px-3 py-2">
          <Button variant="ghost" size="sm" onClick={() => router.push("/routines")} aria-label="Salir (el entrenamiento queda guardado)">
            Salir
          </Button>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-xs font-semibold text-fg-muted">{routine.name}</p>
            <p className="text-xl font-extrabold leading-tight tabular-nums" aria-label="Tiempo transcurrido">
              {elapsed === null ? "—" : formatClock(elapsed)}
            </p>
          </div>
          <Button size="sm" onClick={() => void onFinish()} disabled={!decided}>
            Terminar
          </Button>
        </div>
        <p className="pb-2 text-center text-xs text-fg-subtle tabular-nums">
          {summary.setsDone}/{summary.setsTotal} series · {formatVolume(summary.volumeKg)}
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto max-w-screen-sm px-4 pb-40 pt-4">
          {resumable ? (
            <Card className="space-y-3 text-center">
              <p className="text-lg font-bold">Tenés un entrenamiento en curso</p>
              <p className="text-sm text-fg-muted">
                Empezado hace {Math.max(1, Math.round(((now ?? 0) - (resumable.draft.startedAtMs ?? 0)) / 60_000))} min ·{" "}
                {draftSummary(resumable.draft).setsDone} series tildadas
              </p>
              <div className="flex flex-col gap-2">
                <Button size="lg" fullWidth onClick={resume}>
                  Retomar entrenamiento
                </Button>
                <Button variant="ghost" fullWidth onClick={discardSaved}>
                  Descartar y empezar de nuevo
                </Button>
              </div>
            </Card>
          ) : (
            <WorkoutEditor draft={draft} dispatch={dispatch} restTimerClassName="bottom-[calc(1rem+env(safe-area-inset-bottom))]" />
          )}
        </div>
      </div>

      <Sheet open={categorySheet} onClose={() => setCategorySheet(false)} title="¿Qué hiciste?">
        <div className="space-y-4">
          <CategoryPicker categories={categories} value={categoryId} onChange={setCategoryId} />
          <Button size="lg" fullWidth onClick={onSave}>
            Guardar entrenamiento
          </Button>
        </div>
      </Sheet>

      <SubmitWorkoutScreen
        open={submitting !== null}
        kind="create"
        input={submitting}
        photos={[]}
        summary={submitSummary}
        routine={{ id: routine.id, name: routine.name }}
        onBackToEdit={() => {
          if (beforeFinish) dispatch({ type: "replace", draft: beforeFinish });
          setSubmitting(null);
        }}
        onSaved={onSaved}
      />
    </div>
  );
}
