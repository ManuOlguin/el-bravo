import { cn } from "@/src/components/ui";
import { formatLocalDate } from "@/src/lib/time";
import type { UserStats } from "@/src/server/stats";
import { formatInt } from "./format";

/**
 * Un punto por cada entrenamiento del objetivo semanal en el rango: verde si lo hiciste,
 * apagado si faltó, con borde si es de la semana en curso (todavía estás a tiempo).
 */
export function GoalDots({ weeks }: { weeks: UserStats["goalProgress"] }) {
  const expected = weeks.reduce((acc, w) => acc + w.goal, 0);
  const done = weeks.reduce((acc, w) => acc + w.done, 0);
  const extra = weeks.reduce((acc, w) => acc + w.extra, 0);
  const pct = expected === 0 ? 0 : Math.round((done / expected) * 100);
  return (
    <div className="space-y-3">
      <p className="flex items-baseline gap-2">
        <span className="text-3xl font-extrabold tabular-nums">
          {formatInt(done)}
          <span className="text-lg text-fg-subtle">/{formatInt(expected)}</span>
        </span>
        <span className="text-sm text-fg-muted">{pct} % del objetivo</span>
      </p>
      <ol className="flex flex-wrap gap-x-3 gap-y-2" aria-label="Entrenamientos hechos contra el objetivo, por semana">
        {weeks.map((w) => (
          <li
            key={w.weekKey}
            className="flex gap-1"
            title={`Semana del ${formatLocalDate(w.weekKey)}: ${w.done + w.extra} de ${w.goal}${w.current ? " (en curso)" : ""}`}
            aria-label={`Semana del ${formatLocalDate(w.weekKey)}: ${w.done + w.extra} de ${w.goal}${w.current ? ", en curso" : ""}`}
          >
            {Array.from({ length: w.goal }, (_, i) => (
              <span
                key={i}
                aria-hidden="true"
                className={cn(
                  "h-2.5 w-2.5 rounded-full",
                  i < w.done ? "bg-primary-gradient" : w.current ? "border border-fg-subtle" : "bg-surface-3"
                )}
              />
            ))}
          </li>
        ))}
      </ol>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-primary-gradient" /> hecho
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-surface-3" /> faltó
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full border border-fg-subtle" /> semana en curso
        </span>
        {extra > 0 && <span>+{formatInt(extra)} extra por encima del objetivo</span>}
      </p>
    </div>
  );
}
