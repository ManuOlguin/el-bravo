import { Card, cn } from "@/src/components/ui";

/** Racha actual de semanas cumplidas 🔥, mejor racha y semanas activas seguidas. */
export function StreakCard({
  current,
  best,
  activeWeeks,
  goal,
  className,
}: {
  current: number;
  best: number;
  activeWeeks: number;
  goal: number;
  className?: string;
}) {
  return (
    <Card as="section" className={cn("flex flex-col gap-3", className)}>
      <h2 className="text-sm font-bold uppercase tracking-wide text-fg-subtle">Racha</h2>
      <div className="flex flex-wrap items-end gap-x-2">
        <span className="text-5xl font-extrabold leading-none tabular-nums text-gold">{current}</span>
        <span className="pb-1 text-2xl" aria-hidden="true">
          🔥
        </span>
        <span className="pb-1 text-sm text-fg-muted">{current === 1 ? "semana cumplida" : "semanas cumplidas"} seguidas</span>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl bg-surface-2 px-3 py-2">
          <dt className="text-xs text-fg-subtle">Mejor racha</dt>
          <dd className="font-bold tabular-nums">{best}</dd>
        </div>
        <div className="rounded-xl bg-surface-2 px-3 py-2">
          <dt className="text-xs text-fg-subtle">Semanas activas</dt>
          <dd className="font-bold tabular-nums">{activeWeeks}</dd>
        </div>
      </dl>
      <p className="text-xs text-fg-subtle">
        Cumplís la semana con {goal} {goal === 1 ? "entrenamiento" : "entrenamientos"}.
      </p>
    </Card>
  );
}
