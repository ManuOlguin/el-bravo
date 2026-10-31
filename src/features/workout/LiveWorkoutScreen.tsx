"use client";
import { useCallback, useEffect, useMemo, useReducer, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, NumberInput, Sheet, cn, toast, useConfirm } from "@/src/components/ui";
import { formatDuration, localTimeOf } from "@/src/lib/time";
import type { RoutineForEditor } from "@/src/schemas/routine";
import type { ActivityInput } from "@/src/schemas/workout";
import { CategoryPicker } from "./CategoryPicker";
import { formatVolume } from "./format";
import { formatClock } from "./rest-timer";
import { endMsFor, isResumable, liveStatus, needsEndConfirmation, type EndChoice, type LiveStatus } from "./live-session";
import { WorkoutDraftError, defaultStart, draftFromRoutine, draftSummary, inputSummary, toActivityInput, workoutReducer, type WorkoutDraft } from "./state";
import { SubmitWorkoutScreen } from "./SubmitWorkoutScreen";
import type { CategoryOption } from "./types";
import { askRestNotifications, canAskRestNotifications, dismissRestNotifications, restTimerKey } from "./rest-alerts";
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

const minutes = (ms: number) => Math.max(1, Math.round(ms / 60_000));

const subscribeNothing = () => () => undefined;

/** Una vez: ofrecer avisos del fin del descanso con el celular bloqueado (notificación del sistema). */
function RestNotifyPrompt() {
  const canAsk = useSyncExternalStore(subscribeNothing, canAskRestNotifications, () => false);
  const [hidden, setHidden] = useState(false);
  if (!canAsk || hidden) return null;
  return (
    <Card className="mb-3 flex items-start gap-3 p-3">
      <span aria-hidden="true" className="text-xl">
        🔔
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-sm">
          <strong>¿Te avisamos cuando termina el descanso?</strong> <span className="text-fg-muted">Aunque bloquees el celular o estés en otra app.</span>
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={async () => {
              setHidden(true);
              const ok = await askRestNotifications();
              toast[ok ? "success" : "info"](ok ? "Listo: te avisamos al terminar cada descanso" : "Sin permiso: te avisamos solo con la app abierta");
            }}
          >
            Activar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              dismissRestNotifications();
              setHidden(true);
            }}
          >
            Ahora no
          </Button>
        </div>
      </div>
    </Card>
  );
}

/** "¿Cuándo terminaste?": aparece al terminar si el entrenamiento parece olvidado o es muy largo. */
function EndTimePicker({ status, value, onChange, tz }: { status: LiveStatus; value: EndChoice; onChange(c: EndChoice): void; tz: string }) {
  const now = status.startedAtMs + status.elapsedMs;
  const showSuggested = status.lastSetAtMs !== null && status.suggestedEndMs < now;
  const option = (selected: boolean, onClick: () => void, title: string, detail: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        "w-full rounded-xl border px-4 py-3 text-left transition-colors",
        selected ? "border-primary bg-primary/10" : "border-border bg-surface-2 hover:bg-surface-3",
      )}
    >
      <span className="block text-sm font-bold">{title}</span>
      <span className="block text-xs text-fg-muted">{detail}</span>
    </button>
  );
  return (
    <section aria-label="¿Cuándo terminaste?" className="space-y-2 rounded-card border border-warning/40 bg-warning/10 p-3">
      <p className="text-sm font-bold">¿Cuándo terminaste?</p>
      <p className="text-xs text-fg-muted">
        {status.stale
          ? status.lastSetAtMs !== null
            ? `Tu última serie fue hace ${formatDuration(minutes(status.idleMs))}. ¿Te olvidaste de terminarlo?`
            : `Lo empezaste hace ${formatDuration(minutes(status.elapsedMs))} y no tildaste nada desde entonces.`
          : `Es un entrenamiento largo (${formatDuration(minutes(status.elapsedMs))}). Confirmá que esté bien.`}
      </p>
      <div role="radiogroup" aria-label="Hora de fin" className="space-y-2">
        {showSuggested &&
          option(
            value.kind === "suggested",
            () => onChange({ kind: "suggested" }),
            "Después de mi última serie",
            `A las ${localTimeOf(new Date(status.suggestedEndMs), tz)} · ${formatDuration(minutes(status.suggestedEndMs - status.startedAtMs))}`,
          )}
        {option(
          value.kind === "now",
          () => onChange({ kind: "now" }),
          "Recién",
          `A las ${localTimeOf(new Date(now), tz)} · ${formatDuration(minutes(status.elapsedMs))}`,
        )}
        {option(
          value.kind === "custom",
          () => onChange({ kind: "custom", minutes: value.kind === "custom" ? value.minutes : 60 }),
          "Otra duración",
          "La cargo yo",
        )}
        {value.kind === "custom" && (
          <NumberInput
            aria-label="Duración en minutos"
            value={value.minutes}
            min={1}
            max={minutes(status.elapsedMs)}
            suffix="min"
            onChange={(v) => onChange({ kind: "custom", minutes: v ?? 1 })}
          />
        )}
      </div>
    </section>
  );
}

/**
 * Modo en vivo (`/routines/[id]/live`): pantalla completa sobre el shell, cronómetro, series para
 * tachar con descanso y "Terminar" → categoría (Fuerza por defecto) → `SubmitWorkoutScreen`.
 * El borrador vive en localStorage: si se recarga, se cierra la pestaña o el celular la mata en
 * segundo plano, al volver ofrece retomarlo (el cronómetro sigue desde la hora real de inicio).
 * Si parece olvidado (más de 1 h sin tildar) o dura más de 3 h, al terminar pregunta la hora de fin.
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
  /** Al terminar: estado del tiempo y la hora de fin elegida (solo si hace falta confirmarla). */
  const [endStatus, setEndStatus] = useState<LiveStatus | null>(null);
  const [endChoice, setEndChoice] = useState<EndChoice>({ kind: "now" });

  const key = draftKey("live", routine.id);
  // `stored` se lee después de montar; mientras tanto (undefined) no se guarda nada para no pisar el borrador viejo.
  const [stored, setStored] = useState<ReturnType<typeof readDraft> | undefined>(undefined);
  // Se ofrece retomar si había series tildadas o si lo empezó hace menos de 1 h; si no, se arranca de cero.
  // `now` y `stored` se cargan en el mismo render (efectos al montar); hasta entonces no se decide nada.
  const hasResumable = !!stored && now !== null && isResumable(stored.draft, now, draftSummary(stored.draft).setsDone);
  const decided = stored !== undefined && now !== null && (!hasResumable || choice !== null);
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
  const elapsed = decided && now !== null && draft.startedAtMs !== null ? Math.max(0, Math.floor((now - draft.startedAtMs) / 1000)) : null;

  const resume = () => {
    if (!resumable) return;
    dispatch({ type: "replace", draft: resumable.draft });
    setChoice("resume");
  };
  /** Entrenamiento olvidado: retomarlo y pasar directo a guardarlo con la hora de fin sugerida. */
  const resumeAndFinish = () => {
    if (!resumable) return;
    dispatch({ type: "replace", draft: resumable.draft });
    setChoice("resume");
    setEndStatus(liveStatus(resumable.draft, Date.now()));
    setEndChoice({ kind: "suggested" });
    setCategorySheet(true);
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
    const status = liveStatus(draft, Date.now());
    if (needsEndConfirmation(status)) {
      setEndStatus(status);
      setEndChoice(status.stale && status.lastSetAtMs !== null ? { kind: "suggested" } : { kind: "now" });
    } else {
      setEndStatus(null);
    }
    setCategorySheet(true);
  };

  const onSave = () => {
    if (!categoryId) {
      toast.error("Elegí qué hiciste");
      return;
    }
    const nowMs = Date.now();
    const endMs = endStatus ? endMsFor(endChoice, endStatus, nowMs) : nowMs;
    const finished = workoutReducer({ ...draft, activityCategoryId: categoryId }, { type: "finishLive", nowMs: endMs, tz });
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

  const submitSummary = useMemo(() => (submitting ? inputSummary(submitting) : { durationMinutes: 0, exercises: 0, sets: 0, volumeKg: 0 }), [submitting]);

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
            (() => {
              const st = liveStatus(resumable.draft, now ?? resumable.savedAt);
              const done = draftSummary(resumable.draft).setsDone;
              const forgotten = st.stale && done > 0;
              return (
                <Card className="space-y-3 text-center">
                  <p className="text-lg font-bold">{forgotten ? "¿Te olvidaste de terminarlo?" : "Tenés un entrenamiento en curso"}</p>
                  <p className="text-sm text-fg-muted">
                    Empezado hace {formatDuration(minutes(st.elapsedMs))} · {done} {done === 1 ? "serie tildada" : "series tildadas"}
                    {forgotten && st.lastSetAtMs !== null && <> · la última, hace {formatDuration(minutes(st.idleMs))}</>}
                  </p>
                  <div className="flex flex-col gap-2">
                    {forgotten && (
                      <Button size="lg" fullWidth onClick={resumeAndFinish}>
                        Guardarlo terminado a las {localTimeOf(new Date(st.suggestedEndMs), tz)}
                      </Button>
                    )}
                    <Button size="lg" variant={forgotten ? "secondary" : "primary"} fullWidth onClick={resume}>
                      {forgotten ? "Seguir entrenando" : "Retomar entrenamiento"}
                    </Button>
                    <Button variant="ghost" fullWidth onClick={discardSaved}>
                      Descartar y empezar de nuevo
                    </Button>
                  </div>
                </Card>
              );
            })()
          ) : (
            <>
              <RestNotifyPrompt />
              <WorkoutEditor
                draft={draft}
                dispatch={dispatch}
                restTimerKey={restTimerKey(key)}
                restTimerClassName="bottom-[calc(1rem+env(safe-area-inset-bottom))]"
              />
            </>
          )}
        </div>
      </div>

      <Sheet open={categorySheet} onClose={() => setCategorySheet(false)} title="¿Qué hiciste?">
        <div className="space-y-4">
          {endStatus && <EndTimePicker status={endStatus} value={endChoice} onChange={setEndChoice} tz={tz} />}
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
