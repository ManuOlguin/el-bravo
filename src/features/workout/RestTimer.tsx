"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn, toast } from "@/src/components/ui";
import { isRestSoundOn, notifyRestEnd, readRestTimer, scheduleRestBeeps, setRestSound, writeRestTimer } from "./rest-alerts";
import { adjustRest, formatClock, remaining } from "./rest-timer";

export type RestTimerState = { id: number; startMs: number; totalS: number };

const subscribeNothing = () => () => undefined;

/**
 * Estado del descanso. Con `persistKey` se guarda en localStorage (sobrevive a recargas y a que el
 * celular cierre la pestaña) y programa los avisos de fin: pitidos y, si la app no está a la vista,
 * una notificación. Cambiar o saltar el descanso cancela los avisos pendientes.
 */
export function useRestTimer(persistKey?: string) {
  const [timer, setTimer] = useState<RestTimerState | null>(null);
  const restored = useRef(false);

  // Restaurar después de montar (localStorage no existe en el servidor y así no hay diferencias al hidratar).
  // `setTimeout` y no `requestAnimationFrame`: este último no corre con la pestaña en segundo plano. Nunca
  // pisa un descanso que el usuario ya haya empezado.
  useEffect(() => {
    if (!persistKey) return;
    const id = setTimeout(() => {
      restored.current = true;
      setTimer((cur) => cur ?? readRestTimer(persistKey, Date.now()));
    }, 0);
    return () => clearTimeout(id);
  }, [persistKey]);

  useEffect(() => {
    // Un descanso empezado se guarda siempre; el `null` inicial solo después de restaurar (si no, lo borraría).
    if (persistKey && (timer || restored.current)) writeRestTimer(persistKey, timer);
    if (!timer) return;
    const leftMs = timer.startMs + timer.totalS * 1000 - Date.now();
    if (leftMs <= 0) return;
    const cancelBeeps = scheduleRestBeeps(leftMs / 1000);
    const href = window.location.pathname;
    const t = setTimeout(() => void notifyRestEnd(href), leftMs);
    return () => {
      cancelBeeps();
      clearTimeout(t);
    };
  }, [timer, persistKey]);

  return [timer, setTimer] as const;
}

/**
 * Barra fija de descanso (modo live): cuenta regresiva, −15 s / +15 s y "Saltar".
 * Al llegar a 0 vibra y avisa "¡A la próxima serie!" (los pitidos y la notificación los programa
 * `useRestTimer`). Con 🔔/🔕 se prende o apaga el sonido. Controlado: el padre guarda `timer`.
 */
export function RestTimer({ timer, onChange, className }: { timer: RestTimerState | null; onChange(next: RestTimerState | null): void; className?: string }) {
  const [now, setNow] = useState(() => Date.now());
  // Preferencia guardada (en el servidor: prendido) + lo que se toque en esta pantalla.
  const storedSound = useSyncExternalStore(subscribeNothing, isRestSoundOn, () => true);
  const [soundOverride, setSoundOverride] = useState<boolean | null>(null);
  const sound = soundOverride ?? storedSound;
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
    <div role="timer" aria-live="off" aria-label={`Descanso: faltan ${formatClock(left)}`} className={cn("fixed inset-x-0 z-30 px-3", className)}>
      <div className="mx-auto max-w-screen-sm overflow-hidden rounded-card border border-border bg-surface-2/95 shadow-card backdrop-blur">
        <div className="h-1 bg-surface-3">
          <div className="h-full bg-primary-gradient-x transition-[width] duration-200 ease-linear" style={{ width: `${Math.min(100, elapsed * 100)}%` }} />
        </div>
        <div className="flex items-center gap-2 p-2">
          <div className="min-w-0 flex-1 pl-1">
            <p className="text-[11px] font-bold uppercase tracking-wide text-fg-subtle">Descanso</p>
            <p className="text-2xl font-extrabold leading-none tabular-nums">{formatClock(left)}</p>
          </div>
          <button
            type="button"
            aria-label={sound ? "Silenciar el aviso de fin" : "Activar el sonido de fin"}
            aria-pressed={sound}
            className={cn(btn, "bg-surface-3 px-2 text-fg hover:bg-border")}
            onClick={() => {
              setRestSound(!sound);
              setSoundOverride(!sound);
              // Reprograma (o cancela) los pitidos del descanso en curso.
              onChange({ ...timer });
            }}
          >
            {sound ? "🔔" : "🔕"}
          </button>
          <button
            type="button"
            className={cn(btn, "bg-surface-3 text-fg hover:bg-border")}
            onClick={() => onChange({ ...timer, totalS: adjustRest(timer.totalS, -15) })}
          >
            −15
          </button>
          <button
            type="button"
            className={cn(btn, "bg-surface-3 text-fg hover:bg-border")}
            onClick={() => onChange({ ...timer, totalS: adjustRest(timer.totalS, 15) })}
          >
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
