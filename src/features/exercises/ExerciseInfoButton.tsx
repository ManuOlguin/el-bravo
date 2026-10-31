"use client";
import { useEffect, useState } from "react";
import { Button, Pill, ProgressBar, Sheet, Skeleton, cn } from "@/src/components/ui";
import { getExerciseDetailAction } from "@/src/server/actions/exercises";
import { ExerciseThumb } from "./ExerciseThumb";
import { EQUIPMENT_LABEL, type ExerciseDetail } from "./types";

/** Detalles ya pedidos, por id (en memoria, por pestaña). */
const detailCache = new Map<string, ExerciseDetail>();

function useExerciseDetail(exerciseId: string, enabled: boolean) {
  const [result, setResult] = useState<{ id: string; detail: ExerciseDetail | null; error: string | null } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled || detailCache.has(exerciseId)) return;
    let cancelled = false;
    getExerciseDetailAction(exerciseId)
      .then((r) => {
        if (cancelled) return;
        if (r.ok) detailCache.set(exerciseId, r.data);
        setResult({ id: exerciseId, detail: r.ok ? r.data : null, error: r.ok ? null : r.error });
      })
      .catch(() => {
        if (!cancelled) setResult({ id: exerciseId, detail: null, error: "No pudimos cargar el ejercicio. Revisá tu conexión." });
      });
    return () => {
      cancelled = true;
    };
  }, [exerciseId, enabled, attempt]);

  const cached = detailCache.get(exerciseId) ?? null;
  const mine = result?.id === exerciseId ? result : null;
  return {
    detail: cached ?? mine?.detail ?? null,
    error: cached ? null : (mine?.error ?? null),
    retry: () => {
      setResult(null);
      setAttempt((a) => a + 1);
    },
  };
}

function DetailBody({ detail }: { detail: ExerciseDetail }) {
  const hasText = !!detail.description || detail.instructions.length > 0;
  return (
    <div className="space-y-4">
      <ExerciseThumb mediaUrl={detail.mediaUrl} groupKey={detail.primaryGroupKey} size="lg" />
      <div className="flex flex-wrap items-center gap-2">
        <Pill>{EQUIPMENT_LABEL[detail.equipment]}</Pill>
        {detail.nameEn && <span className="text-xs text-fg-subtle">{detail.nameEn}</span>}
      </div>
      {!hasText ? (
        <p className="text-sm text-fg-muted">Todavía no tenemos la explicación de este ejercicio.</p>
      ) : (
        <>
          {!detail.reviewed && (
            <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-fg-muted">
              Texto en revisión: todavía no lo revisó una persona.
            </p>
          )}
          {detail.description && <p className="text-sm">{detail.description}</p>}
          {detail.instructions.length > 0 && (
            <ol className="space-y-2">
              {detail.instructions.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span
                    className={cn(
                      "grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold",
                      step.startsWith("Evitá:") ? "bg-danger/15 text-danger" : "bg-primary/15 text-primary"
                    )}
                    aria-hidden="true"
                  >
                    {step.startsWith("Evitá:") ? "!" : i + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
      {detail.muscles.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-fg-subtle">Músculos que trabaja</h3>
          {detail.muscles.map((m) => (
            <ProgressBar key={m.name} value={m.percentage / 100} label={m.name} />
          ))}
        </section>
      )}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <Skeleton className="h-48 w-full rounded-card" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
      <span className="sr-only">Cargando…</span>
    </div>
  );
}

/** Botón "?" circular que abre un sheet con cómo se hace el ejercicio (imagen, pasos y músculos). */
export function ExerciseInfoButton({ exerciseId, name, className }: { exerciseId: string; name?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const { detail, error, retry } = useExerciseDetail(exerciseId, open);
  const title = detail?.name ?? name ?? "Ejercicio";
  return (
    <>
      <button
        type="button"
        aria-label={`Cómo se hace ${name ?? detail?.name ?? "este ejercicio"}`}
        title="Cómo se hace"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={cn(
          "grid h-7 w-7 shrink-0 place-items-center rounded-full border border-border bg-surface-2 text-sm font-bold text-fg-muted",
          "transition-[transform,background-color,color] duration-100 hover:bg-surface-3 hover:text-fg active:scale-90",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          className
        )}
      >
        ?
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={title}>
        {open &&
          (detail ? (
            <DetailBody detail={detail} />
          ) : error ? (
            <div className="space-y-3 text-center">
              <p className="text-sm text-fg-muted">{error}</p>
              <Button variant="secondary" size="sm" onClick={retry}>
                Reintentar
              </Button>
            </div>
          ) : (
            <DetailSkeleton />
          ))}
      </Sheet>
    </>
  );
}
