import { cn } from "@/src/components/ui";
import type { UserStats } from "@/src/server/stats";
import { formatInt } from "./format";

const weeks = (n: number) => (n === 1 ? "semana" : "semanas");

function StreakCard({
  title,
  rule,
  current,
  best,
  total,
  highlight = false,
}: {
  title: string;
  rule: string;
  current: number;
  best: number;
  total: number;
  highlight?: boolean;
}) {
  const muted = highlight ? "text-on-primary/70" : "text-fg-muted";
  const line = highlight ? "border-on-primary/20" : "border-border";
  return (
    <section
      aria-label={title}
      className={cn("overflow-hidden rounded-card shadow-card", highlight ? "bg-primary-gradient text-on-primary" : "border border-border bg-surface-1")}
    >
      <header className={cn("border-b px-4 py-3", line)}>
        <h2 className="text-sm font-bold">{title}</h2>
        <p className={cn("text-xs", muted)}>{rule}</p>
      </header>
      <div className="grid grid-cols-[1fr_auto]">
        {/* Racha actual: el número protagonista. */}
        <div className="flex flex-col justify-center px-4 py-3">
          <span className={cn("text-[11px] font-semibold uppercase tracking-wide", muted)}>Racha actual</span>
          <span className="flex items-baseline gap-1.5">
            <span className="text-4xl font-extrabold leading-none tabular-nums">{formatInt(current)}</span>
            <span className={cn("text-sm", muted)}>{weeks(current)}</span>
          </span>
        </div>
        {/* Mejor y total: filas etiqueta / valor separadas por líneas. */}
        <dl className={cn("min-w-32 divide-y border-l text-sm", line, highlight ? "divide-on-primary/20" : "divide-border")}>
          {[
            { label: "Mejor racha", value: best },
            { label: "En total", value: total },
          ].map((i) => (
            <div key={i.label} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <dt className={muted}>{i.label}</dt>
              <dd className="text-lg font-extrabold tabular-nums">{formatInt(i.value)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/**
 * Las dos rachas por semanas, cada una con la actual, la mejor histórica y el total:
 * activas (≥ 1 entrenamiento) y perfectas (objetivo semanal cumplido).
 */
export function StreakCards({ stats }: { stats: UserStats }) {
  const goal = stats.thisWeek.goal;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <StreakCard
        title="Semanas activas"
        rule="Al menos 1 entrenamiento en la semana"
        current={stats.activeWeeksStreak}
        best={stats.bestActiveStreakWeeks}
        total={stats.activeWeeks}
      />
      <StreakCard
        title="Semanas perfectas"
        rule={`Objetivo cumplido: ${goal} ${goal === 1 ? "entrenamiento" : "entrenamientos"}`}
        current={stats.currentStreakWeeks}
        best={stats.bestStreakWeeks}
        total={stats.perfectWeeks}
        highlight
      />
    </div>
  );
}
