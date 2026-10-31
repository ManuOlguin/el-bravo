import { cn } from "@/src/components/ui";
import type { UserStats } from "@/src/server/stats";
import { formatInt } from "./format";

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
  return (
    <section
      aria-label={title}
      className={cn(
        "flex flex-col gap-3 rounded-card p-4 shadow-card",
        highlight ? "bg-primary-gradient text-on-primary" : "border border-border bg-surface-1"
      )}
    >
      <div>
        <h2 className="text-sm font-bold">{title}</h2>
        <p className={cn("text-xs", highlight ? "text-on-primary/75" : "text-fg-subtle")}>{rule}</p>
      </div>
      <dl className="grid grid-cols-3 gap-2">
        {[
          { label: "racha actual", value: current, big: true },
          { label: "mejor racha", value: best },
          { label: "en total", value: total },
        ].map((i) => (
          <div key={i.label} className="flex min-w-0 flex-col-reverse justify-end gap-0.5">
            <dt className={cn("text-[11px] leading-tight", highlight ? "text-on-primary/75" : "text-fg-muted")}>{i.label}</dt>
            <dd className={cn("font-extrabold leading-none tabular-nums", i.big ? "text-4xl" : "pt-2 text-2xl")}>{formatInt(i.value)}</dd>
          </div>
        ))}
      </dl>
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
        rule={`Tu objetivo cumplido: ${goal} ${goal === 1 ? "entrenamiento" : "entrenamientos"}`}
        current={stats.currentStreakWeeks}
        best={stats.bestStreakWeeks}
        total={stats.perfectWeeks}
        highlight
      />
    </div>
  );
}
