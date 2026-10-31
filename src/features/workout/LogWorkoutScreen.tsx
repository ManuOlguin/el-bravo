"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Button, Card, Chip, Field, Input, NumberInput, PageHeader, Textarea, cn, toast, useConfirm } from "@/src/components/ui";
import type { ExerciseSummary } from "@/src/features/exercises";
import { PendingPhotoPicker, PhotoGrid, MAX_ACTIVITY_PHOTOS, type GridPhoto } from "@/src/features/media";
import { deleteActivityMediaAction } from "@/src/server/actions/media";
import { getRoutineForEditorAction } from "@/src/server/actions/routines";
import type { RoutineForEditor } from "@/src/schemas/routine";
import type { ActivityInput } from "@/src/schemas/workout";
import { CategoryPicker } from "./CategoryPicker";
import { PlusIcon } from "./icons";
import {
  WorkoutDraftError,
  defaultStart,
  draftFromActivity,
  inputSummary,
  newDraft,
  toActivityInput,
  workoutReducer,
  type WorkoutDraft,
} from "./state";
import { SubmitWorkoutScreen } from "./SubmitWorkoutScreen";
import type { CategoryOption, RoutineOption } from "./types";
import { draftKey, isDraftDirty, useDraftPersistence } from "./useDraftPersistence";
import { WorkoutEditor } from "./WorkoutEditor";

const DURATION_PRESETS = [30, 45, 60, 90] as const;

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <Card as="section" className={cn("space-y-3", className)}>
      <h2 className="text-sm font-bold uppercase tracking-wide text-fg-subtle">{title}</h2>
      {children}
    </Card>
  );
}

type EditInitial = { input: ActivityInput & { id: string }; exercises: ExerciseSummary[]; photos: GridPhoto[] };

/**
 * Registrar o editar un entrenamiento (W2-1 Task 4): una sola página con secciones —qué hiciste,
 * cuándo y cuánto, ejercicios (opcional), fotos y notas— y el botón fijo "Guardar entrenamiento".
 * Al crear, el borrador se guarda en localStorage y se limpia al guardar con éxito.
 */
export function LogWorkoutScreen({
  kind,
  categories,
  routines,
  tz,
  nowMs,
  edit,
  initialRoutine,
}: {
  kind: "create" | "edit";
  categories: CategoryOption[];
  routines: RoutineOption[];
  tz: string;
  /** "Ahora" del servidor (la hora por defecto es ahora − duración). */
  nowMs: number;
  edit?: EditInitial;
  /** `/workout/new?routine=<id>` */
  initialRoutine?: RoutineForEditor | null;
}) {
  const confirm = useConfirm();
  const strengthLike = categories.find((c) => c.usesExercises) ?? null;

  const [draft, dispatch] = useReducer(workoutReducer, undefined, (): WorkoutDraft => {
    if (edit) return draftFromActivity(edit.input, new Map(edit.exercises.map((e) => [e.id, e])));
    const d = newDraft("log", defaultStart(nowMs, null, tz));
    if (!initialRoutine) return d;
    return {
      ...workoutReducer(d, { type: "loadRoutine", routine: initialRoutine }),
      activityCategoryId: strengthLike?.id ?? null,
    };
  });

  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const dropError = (key: string) =>
    setErrors((e) => (key in e ? Object.fromEntries(Object.entries(e).filter(([k]) => k !== key)) : e));
  const [timeTouched, setTimeTouched] = useState(kind === "edit");
  const [showExercises, setShowExercises] = useState(draft.exercises.length > 0);
  const [photos, setPhotos] = useState<File[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<GridPhoto[]>(edit?.photos ?? []);
  const [submitting, setSubmitting] = useState<ActivityInput | null>(null);
  const [saved, setSaved] = useState(false);
  const [loadingRoutine, setLoadingRoutine] = useState<string | null>(null);

  // Borrador local (solo al crear).
  const storageKey = draftKey("log", kind === "edit" && edit ? edit.input.id : "new");
  const persistable = kind === "create" && !initialRoutine;
  const { saved: stored, clear } = useDraftPersistence(storageKey, draft, persistable && !saved);
  const restored = useRef(false);
  useEffect(() => {
    if (!persistable || restored.current || stored === undefined) return;
    restored.current = true;
    if (!stored || !isDraftDirty(stored.draft) || stored.draft.mode !== "log") return;
    dispatch({ type: "replace", draft: stored.draft });
    if (stored.draft.exercises.length > 0) setShowExercises(true);
    setTimeTouched(true);
    toast.info("Recuperamos el entrenamiento que tenías sin guardar", {
      action: {
        label: "Descartar",
        onClick: () => {
          clear();
          dispatch({ type: "replace", draft: newDraft("log", defaultStart(Date.now(), null, tz)) });
          setShowExercises(false);
          setTimeTouched(false);
        },
      },
    });
  }, [stored, persistable, clear, tz]);

  const category = categories.find((c) => c.id === draft.activityCategoryId) ?? null;
  const exercisesVisible = showExercises || !!category?.usesExercises || draft.exercises.length > 0;

  const setDuration = (v: number | null) => {
    dispatch({ type: "setField", field: "durationMinutes", value: v });
    if (!timeTouched && kind === "create") {
      const start = defaultStart(Date.now(), v, tz);
      dispatch({ type: "setField", field: "localDate", value: start.localDate });
      dispatch({ type: "setField", field: "localTime", value: start.localTime });
    }
    dropError("durationMinutes");
  };

  const pickRoutine = async (r: RoutineOption) => {
    setLoadingRoutine(r.id);
    try {
      const res = await getRoutineForEditorAction(r.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (draft.exercises.length > 0) {
        const yes = await confirm({
          title: `¿Cargar «${r.name}»?`,
          description: "Se reemplazan los ejercicios que ya cargaste.",
          confirmLabel: "Reemplazar",
        });
        if (!yes) return;
      }
      dispatch({ type: "loadRoutine", routine: res.data, replace: true });
      setShowExercises(true);
      toast.success(`Cargaste «${r.name}»`);
    } catch {
      toast.error("No pudimos cargar la rutina. Revisá tu conexión.");
    } finally {
      setLoadingRoutine(null);
    }
  };

  const onSave = () => {
    try {
      const input = toActivityInput(draft);
      setErrors({});
      setSubmitting(input);
    } catch (e) {
      if (e instanceof WorkoutDraftError) {
        setErrors(e.fieldErrors);
        toast.error(e.message);
        return;
      }
      throw e;
    }
  };

  const onSaved = useCallback(() => {
    setSaved(true);
    clear();
  }, [clear]);

  const summary = useMemo(
    () => (submitting ? inputSummary(submitting) : { durationMinutes: 0, exercises: 0, sets: 0, volumeKg: 0 }),
    [submitting]
  );

  const removeExistingPhoto = async (id: string) => {
    const r = await deleteActivityMediaAction(id);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    setExistingPhotos((list) => list.filter((p) => p.id !== id));
    toast.success("Foto borrada");
  };

  const err = (k: string) => errors[k]?.[0] ?? null;
  // Solo al registrar: al editar no se cambia de rutina.
  const showRoutines = kind !== "edit" && !!category?.usesExercises;

  return (
    <div className="space-y-4 pb-24">
      <PageHeader
        title={kind === "edit" ? "Editar entrenamiento" : "Registrar entrenamiento"}
        back={kind === "edit" && edit ? `/workout/${edit.input.id}` : "/home"}
      />

      <Section title="¿Qué hiciste?">
        <CategoryPicker
          categories={categories}
          value={draft.activityCategoryId}
          invalid={!!err("activityCategoryId")}
          onChange={(id) => {
            dispatch({ type: "setField", field: "activityCategoryId", value: id });
            dropError("activityCategoryId");
          }}
        />
        {err("activityCategoryId") && (
          <p role="alert" className="text-xs text-danger">
            {err("activityCategoryId")}
          </p>
        )}
        {showRoutines && (
          <div className="space-y-2 border-t border-border pt-3">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-semibold">Desde una rutina</p>
              <Link href="/routines" className="text-xs font-semibold text-primary hover:underline">
                Mis rutinas →
              </Link>
            </div>
            {routines.length > 0 ? (
              <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
                {routines.map((r) => (
                  <Chip key={r.id} selected={draft.routineId === r.id} onClick={() => void pickRoutine(r)} disabled={loadingRoutine !== null}>
                    {loadingRoutine === r.id ? "Cargando…" : r.name}
                  </Chip>
                ))}
              </div>
            ) : (
              <p className="text-xs text-fg-muted">
                Armá una rutina con tus ejercicios y pesos, y la próxima vez la cargás con un toque.{" "}
                <Link href="/routines/new" className="font-semibold text-primary hover:underline">
                  Crear rutina
                </Link>
              </p>
            )}
          </div>
        )}
      </Section>

      <Section title="¿Cuándo y cuánto?">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha" htmlFor="w-date" error={err("localDate")}>
            <Input
              type="date"
              value={draft.localDate}
              max={defaultStart(nowMs, null, tz).localDate}
              onChange={(e) => {
                setTimeTouched(true);
                dispatch({ type: "setField", field: "localDate", value: e.target.value });
              }}
            />
          </Field>
          <Field label="Hora de inicio" htmlFor="w-time" error={err("localTime")}>
            <Input
              type="time"
              value={draft.localTime}
              onChange={(e) => {
                setTimeTouched(true);
                dispatch({ type: "setField", field: "localTime", value: e.target.value });
              }}
            />
          </Field>
        </div>
        <Field label="Duración" htmlFor="w-duration" error={err("durationMinutes")}>
          <div className="flex flex-wrap items-center gap-2">
            {DURATION_PRESETS.map((m) => (
              <Chip key={m} selected={draft.durationMinutes === m} onClick={() => setDuration(m)}>
                {m} min
              </Chip>
            ))}
            <NumberInput
              id="w-duration"
              value={draft.durationMinutes}
              onChange={(v) => setDuration(v === null ? null : Math.round(v))}
              min={1}
              max={1440}
              step={1}
              suffix="min"
              placeholder="Otra"
              aria-label="Duración en minutos"
              className="w-28"
            />
          </div>
        </Field>
      </Section>

      {exercisesVisible ? (
        <section className="space-y-3" aria-label="Ejercicios">
          <h2 className="px-1 text-sm font-bold uppercase tracking-wide text-fg-subtle">Ejercicios</h2>
          {err("exercises") && <p className="text-xs text-danger">{err("exercises")}</p>}
          <WorkoutEditor draft={draft} dispatch={dispatch} excludeActivityId={edit?.input.id} />
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setShowExercises(true)}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-card border border-dashed border-border text-sm font-semibold text-fg-muted transition-[transform,background-color] duration-100 hover:bg-surface-1 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.98]"
        >
          <PlusIcon size={16} />
          Agregar ejercicios (opcional)
        </button>
      )}

      <Section title="Fotos y notas">
        {existingPhotos.length > 0 && <PhotoGrid photos={existingPhotos} onDelete={removeExistingPhoto} />}
        <PendingPhotoPicker value={photos} onChange={setPhotos} max={Math.max(0, MAX_ACTIVITY_PHOTOS - existingPhotos.length)} />
        <Field label="Notas" htmlFor="w-notes">
          <Textarea
            value={draft.notes}
            onChange={(e) => dispatch({ type: "setField", field: "notes", value: e.target.value })}
            placeholder="¿Cómo te sentiste?"
            maxLength={2000}
          />
        </Field>
      </Section>

      <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 px-4 sm:bottom-4">
        <div className="mx-auto max-w-screen-sm">
          <Button size="lg" fullWidth onClick={onSave} className="shadow-card">
            {kind === "edit" ? "Guardar cambios" : "Guardar entrenamiento"}
          </Button>
        </div>
      </div>

      <SubmitWorkoutScreen
        open={submitting !== null}
        kind={kind}
        activityId={edit?.input.id}
        input={submitting}
        photos={photos}
        summary={summary}
        onBackToEdit={() => setSubmitting(null)}
        onSaved={onSaved}
      />
    </div>
  );
}
