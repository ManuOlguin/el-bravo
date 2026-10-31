"use client";
import { useRef, useState } from "react";
import { NumberInput, cn } from "@/src/components/ui";
import { KIND_LABEL, formatKg, setText, type PreviousSetLike } from "./format";
import { CheckIcon, TrashIcon } from "./icons";
import type { SetDraft, WorkoutMode } from "./state";

/** Plantilla de columnas compartida por el encabezado (`SetTable`) y las filas. */
export function setGridClass(mode: WorkoutMode) {
  if (mode === "plan") return "grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,1fr)] sm:grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,1fr)_2.25rem]";
  if (mode === "live")
    return "grid-cols-[2.5rem_minmax(0,1fr)_4rem_4rem_2.75rem] sm:grid-cols-[2.5rem_minmax(0,1fr)_4.5rem_4.5rem_2.75rem_2.25rem]";
  return "grid-cols-[2.5rem_minmax(0,1fr)_4rem_4rem] sm:grid-cols-[2.5rem_minmax(0,1fr)_4.5rem_4.5rem_2.25rem]";
}

const REVEAL = 88; // px que se corre la fila para mostrar "Eliminar"

const compactInput = "[&_input]:h-10 [&_input]:px-1 [&_input]:text-center [&_input]:font-semibold";

export function SetRow({
  label,
  set,
  mode,
  measure,
  tracksWeight,
  previous,
  onChange,
  onToggleDone,
  onRemove,
  onCycleKind,
}: {
  label: string;
  set: SetDraft;
  mode: WorkoutMode;
  measure: "reps" | "duration";
  tracksWeight: boolean;
  previous?: PreviousSetLike;
  onChange(patch: Partial<Omit<SetDraft, "key">>): void;
  onToggleDone(): void;
  onRemove(): void;
  onCycleKind(): void;
}) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number; base: number; locked: "h" | "v" | null } | null>(null);
  const done = mode === "live" && set.completed;
  const valueKey = measure === "duration" ? "durationSeconds" : "reps";
  const value = set[valueKey];
  const prevValue = previous ? previous[valueKey] : null;

  // Swipe a la izquierda revela "Eliminar" (solo touch; en desktop hay un botón al hover).
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    drag.current = { x: t.clientX, y: t.clientY, base: dx, locked: null };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const d = drag.current;
    if (!d) return;
    const t = e.touches[0];
    const mx = t.clientX - d.x;
    const my = t.clientY - d.y;
    if (!d.locked) {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
      d.locked = Math.abs(mx) > Math.abs(my) ? "h" : "v";
      if (d.locked === "h") setDragging(true);
    }
    if (d.locked === "h") setDx(Math.max(-REVEAL - 24, Math.min(0, d.base + mx)));
  };
  const onTouchEnd = () => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (d?.locked === "h") setDx((x) => (x < -REVEAL / 2 ? -REVEAL : 0));
  };

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Acción revelada por el swipe (solo existe mientras la fila está corrida: las filas tachadas son translúcidas) */}
      {dx < 0 && (
        <button
          type="button"
          onClick={() => {
            setDx(0);
            onRemove();
          }}
          className="absolute inset-y-0 right-0 flex items-center justify-center gap-1 bg-danger text-sm font-bold text-fg active:brightness-90"
          style={{ width: REVEAL }}
        >
          <TrashIcon size={16} />
          Eliminar
        </button>
      )}

      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClickCapture={(e) => {
          if (dx !== 0) {
            e.stopPropagation();
            e.preventDefault();
            setDx(0);
          }
        }}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined, touchAction: "pan-y" }}
        className={cn(
          "group relative grid items-center gap-1.5 bg-surface-1 px-1 py-1 transition-[transform,background-color] duration-150",
          dragging && "transition-none",
          setGridClass(mode),
          done && "bg-primary/10"
        )}
      >
        <button
          type="button"
          onClick={onCycleKind}
          title={`${KIND_LABEL[set.kind]} (tocá para cambiar)`}
          aria-label={`Serie ${label}, ${KIND_LABEL[set.kind]}. Cambiar tipo`}
          className={cn(
            "grid h-10 w-10 place-items-center rounded-lg text-sm font-bold tabular-nums transition-transform active:scale-90",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            set.kind === "normal" && "bg-surface-2 text-fg",
            set.kind === "warmup" && "bg-warning/15 text-warning",
            set.kind === "drop" && "bg-primary/15 text-primary",
            set.kind === "failure" && "bg-danger/15 text-danger"
          )}
        >
          {label}
        </button>

        {mode !== "plan" ? (
          <span className={cn("truncate text-center text-xs tabular-nums text-fg-subtle", done && "line-through")}>
            {previous ? setText(previous) : "—"}
          </span>
        ) : null}

        <div className={cn(done && "opacity-70 [&_input]:line-through")}>
          {tracksWeight ? (
            <NumberInput
              value={set.weightKg}
              onChange={(v) => onChange({ weightKg: v })}
              min={0}
              max={1000}
              aria-label={`Kilos de la serie ${label}`}
              placeholder={previous?.weightKg != null ? formatKg(previous.weightKg) : "kg"}
              className={compactInput}
            />
          ) : (
            <span className="grid h-10 place-items-center text-sm text-fg-subtle" aria-hidden="true">
              —
            </span>
          )}
        </div>

        <div className={cn(done && "opacity-70 [&_input]:line-through")}>
          <NumberInput
            value={value}
            onChange={(v) => onChange({ [valueKey]: v === null ? null : Math.round(v) })}
            min={1}
            max={measure === "duration" ? 36000 : 1000}
            step={1}
            aria-label={measure === "duration" ? `Segundos de la serie ${label}` : `Repeticiones de la serie ${label}`}
            placeholder={prevValue != null ? String(prevValue) : measure === "duration" ? "s" : "reps"}
            className={compactInput}
          />
        </div>

        {mode === "live" && (
          <button
            type="button"
            onClick={onToggleDone}
            aria-pressed={set.completed}
            aria-label={set.completed ? `Desmarcar serie ${label}` : `Marcar serie ${label} como hecha`}
            className={cn(
              "grid h-11 w-11 place-items-center rounded-lg transition-[transform,background-color] duration-100 active:scale-90",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              set.completed ? "bg-primary-gradient text-on-primary" : "bg-surface-3 text-fg-muted hover:bg-border"
            )}
          >
            <CheckIcon size={20} />
          </button>
        )}

        <button
          type="button"
          onClick={onRemove}
          aria-label={`Eliminar serie ${label}`}
          className="hidden h-9 w-9 place-items-center rounded-lg text-fg-subtle opacity-0 transition-opacity hover:bg-danger/15 hover:text-danger focus-visible:opacity-100 group-hover:opacity-100 sm:grid"
        >
          <TrashIcon size={16} />
        </button>
      </div>
    </div>
  );
}
