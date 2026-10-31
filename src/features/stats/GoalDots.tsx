import { cn, ProgressBar } from "@/src/components/ui";
import { formatLocalDate } from "@/src/lib/time";
import type { UserStats } from "@/src/server/stats";
import { formatInt } from "./format";

function Dot({ state }: { state: "done" | "missed" | "pending" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "h-2.5 w-2.5 rounded-full",
        state === "done" ? "bg-primary-gradient" : state === "pending" ? "border border-fg-subtle" : "bg-surface-3"
      )}
    />
  );
}

/**
 * Un punto por cada entrenamiento del objetivo semanal en el rango: verde si lo hiciste,
 * apagado si faltó, con borde si es de la semana en curso (todavía estás a tiempo).
 * Cada semana va en su propia celda con la fecha del lunes.
 */
export function GoalDots({ weeks }: { weeks: UserStats["goalProgress"] }) {
  const expected = weeks.reduce((acc, w) => acc + w.goal, 0);
  const done = weeks.reduce((acc, w) => acc + w.done, 0);
  const extra = weeks.reduce((acc, w) => acc + w.extra, 0);
  const met = weeks.filter((w) => w.done >= w.goal).length;
  const pct = expected === 0 ? 0 : Math.round((done / expected) * 100);
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-end justify-between gap-3">
          <p className="text-3xl font-extrabold leading-none tabular-nums">
            {formatInt(done)}
            <span className="text-lg text-fg-subtle">/{formatInt(expected)}</span>
            <span className="ml-2 text-sm font-semibold text-fg-muted">entrenamientos</span>
          </p>
          <p className="text-lg font-extrabold text-primary tabular-nums">{pct} %</p>
        </div>
        <ProgressBar value={expected === 0 ? 0 : done / expected} />
        <p className="text-xs text-fg-muted">
          {met} de {weeks.length} {weeks.length === 1 ? "semana cumplida" : "semanas cumplidas"}
          {extra > 0 && ` · +${formatInt(extra)} extra por encima del objetivo`}
        </p>
      </div>

      <ol className="grid grid-cols-[repeat(auto-fill,minmax(4.25rem,1fr))] gap-1.5" aria-label="Entrenamientos hechos contra el objetivo, por semana">
        {weeks.map((w) => {
          const label = `Semana del ${formatLocalDate(w.weekKey)}: ${w.done + w.extra} de ${w.goal}${w.current ? ", en curso" : ""}`;
          return (
            <li
              key={w.weekKey}
              aria-label={label}
              title={label}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-lg border px-1 py-2",
                w.current ? "border-primary/40 bg-surface-2" : w.done >= w.goal ? "border-primary/20 bg-primary/5" : "border-border bg-surface-2"
              )}
            >
              <span className="flex flex-wrap justify-center gap-1">
                {Array.from({ length: w.goal }, (_, i) => (
                  <Dot key={i} state={i < w.done ? "done" : w.current ? "pending" : "missed"} />
                ))}
              </span>
              <span aria-hidden="true" className={cn("text-[10px] leading-none", w.current ? "font-bold text-fg" : "text-fg-subtle")}>
                {w.current ? "Esta sem." : formatLocalDate(w.weekKey)}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3 text-xs text-fg-muted">
        <span className="flex items-center gap-1.5">
          <Dot state="done" /> hecho
        </span>
        <span className="flex items-center gap-1.5">
          <Dot state="missed" /> faltó
        </span>
        <span className="flex items-center gap-1.5">
          <Dot state="pending" /> semana en curso
        </span>
      </p>
    </div>
  );
}
