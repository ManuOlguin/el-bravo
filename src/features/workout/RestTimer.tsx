"use client";
import { useEffect, useRef, useState } from "react";
import { cn, toast } from "@/src/components/ui";
import { adjustRest, formatClock, remaining } from "./rest-timer";

export type RestTimerState = { id: number; startMs: number; totalS: number };

/**
 * Barra fija de descanso (modo live): cuenta regresiva, −15 s / +15 s y "Saltar".
 * Al llegar a 0 vibra y avisa "¡A la próxima serie!". Controlado: el padre guarda `timer`.
 */
export function RestTimer({
  timer,
  onChange,
  className,
}: {
  timer: RestTimerState | null;
  onChange(next: RestTimerState | null): void;
  className?: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  const finished = useRef<number | null>(null);

  useEffect(() => {
    if (!timer) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [timer]);

  const left = timer ? remaining(timer.startMs, timer.totalS, now) : 0;

  useEffect(() => {
    if (!timer || left > 0 || finished.current === timer.id) return;
    finished.current = timer.id;
    try {
      navigator.vibrate?.(200);
    } catch {
      // algunos navegadores lanzan si no hubo interacción
    }
    toast.success("¡A la próxima serie!");
    onChange(null);
  }, [left, timer, onChange]);

  if (!timer) return null;
  const elapsed = timer.totalS > 0 ? 1 - left / timer.totalS : 1;

  const btn =
    "h-11 min-w-11 rounded-xl px-3 text-sm font-bold transition-[transform,background-color] duration-100 active:scale-95 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

  return (
    <div
      role="timer"
      aria-live="off"
      aria-label={`Descanso: faltan ${formatClock(left)}`}
      className={cn("fixed inset-x-0 z-30 px-3", className)}
    >
      <div className="mx-auto max-w-screen-sm overflow-hidden rounded-card border border-border bg-surface-2/95 shadow-card backdrop-blur">
        <div className="h-1 bg-surface-3">
          <div className="h-full bg-primary transition-[width] duration-200 ease-linear" style={{ width: `${Math.min(100, elapsed * 100)}%` }} />
        </div>
        <div className="flex items-center gap-2 p-2">
          <div className="min-w-0 flex-1 pl-1">
            <p className="text-[11px] font-bold uppercase tracking-wide text-fg-subtle">Descanso</p>
            <p className="text-2xl font-extrabold leading-none tabular-nums">{formatClock(left)}</p>
          </div>
          <button type="button" className={cn(btn, "bg-surface-3 text-fg hover:bg-border")} onClick={() => onChange({ ...timer, totalS: adjustRest(timer.totalS, -15) })}>
            −15
          </button>
          <button type="button" className={cn(btn, "bg-surface-3 text-fg hover:bg-border")} onClick={() => onChange({ ...timer, totalS: adjustRest(timer.totalS, 15) })}>
            +15
          </button>
          <button type="button" className={cn(btn, "bg-primary-gradient text-on-primary")} onClick={() => onChange(null)}>
            Saltar
          </button>
        </div>
      </div>
    </div>
  );
}
