import { Card, ProgressBar, cn } from "@/src/components/ui";
import { formatLocalDate, type LocalDate } from "@/src/lib/time";

const DAY_LETTERS = ["L", "M", "M", "J", "V", "S", "D"];
const DAY_NAMES = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

/** Semana actual: 7 círculos lunes..domingo (hoy marcado), "2/3" y barra de progreso al objetivo. */
export function WeekProgress({
  days,
  today,
  workouts,
  goal,
  className,
}: {
  days: { date: LocalDate; count: number }[];
  today: LocalDate;
  workouts: number;
  goal: number;
  className?: string;
}) {
  const met = workouts >= goal;
  return (
    <Card as="section" className={cn("space-y-4", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-fg-subtle">Tu semana</h2>
        <p className="text-sm text-fg-muted">
          <span className={cn("text-2xl font-extrabold tabular-nums", met ? "text-primary" : "text-fg")}>
            {workouts}/{goal}
          </span>{" "}
          entrenamientos
        </p>
      </div>

      <ol className="grid grid-cols-7 gap-1" aria-label="Días de la semana">
        {days.map((d, i) => {
          const isToday = d.date === today;
          const trained = d.count > 0;
          const label = `${DAY_NAMES[i]} ${formatLocalDate(d.date)}${isToday ? " (hoy)" : ""}: ${
            trained ? `${d.count} ${d.count === 1 ? "entrenamiento" : "entrenamientos"}` : "sin entrenar"
          }`;
          return (
            <li key={d.date} className="flex flex-col items-center gap-1" aria-label={label}>
              <span
                aria-hidden="true"
                className={cn(
                  "grid h-9 w-9 place-items-center rounded-full border-2 text-xs font-bold tabular-nums",
                  trained ? "border-primary bg-primary-gradient text-on-primary" : "border-border text-fg-subtle",
                  isToday && !trained && "border-primary text-primary",
                  isToday && "ring-2 ring-primary/40 ring-offset-2 ring-offset-surface-1"
                )}
              >
                {trained ? (d.count > 1 ? d.count : "✓") : ""}
              </span>
              <span aria-hidden="true" className={cn("text-xs font-semibold", isToday ? "text-primary" : "text-fg-subtle")}>
                {DAY_LETTERS[i]}
              </span>
            </li>
          );
        })}
      </ol>

      <ProgressBar value={goal > 0 ? workouts / goal : 0} label={met ? "¡Objetivo cumplido!" : `Objetivo: ${goal} por semana`} />
    </Card>
  );
}
