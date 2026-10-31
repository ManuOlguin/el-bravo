import { Card, CardHeader, cn } from "@/src/components/ui";
import { WEEKDAY_INITIALS, WEEKDAY_NAMES } from "@/src/features/season/format";
import type { MyWeek } from "./data";

/** Tu semana (lunes a domingo, zona del grupo): qué días sumaron y cuánto falta para el objetivo. */
export function MyWeekCard({ week, today }: { week: MyWeek; today: string }) {
  const done = week.daysTrained >= week.target && week.target > 0;
  const missing = Math.max(0, week.target - week.daysTrained);
  return (
    <Card>
      <CardHeader
        title="Tu semana"
        subtitle={done ? "¡Objetivo cumplido! 💪" : missing === 1 ? "Te falta 1 día para el objetivo" : `Te faltan ${missing} días para el objetivo`}
        action={
          <span className={cn("text-2xl font-extrabold tabular-nums", done ? "text-primary" : "text-fg")}>
            {week.daysTrained}/{week.target}
          </span>
        }
      />
      <ol className="grid grid-cols-7 gap-1.5" aria-label="Días de esta semana">
        {week.days.map((d, i) => {
          const isToday = d.date === today;
          const state = d.counted ? "suma" : d.count > 0 ? "no llegó al mínimo" : "sin entrenar";
          return (
            <li key={d.date} className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  "grid h-9 w-9 place-items-center rounded-full border text-xs font-bold",
                  d.counted
                    ? "border-primary bg-primary text-on-primary"
                    : d.count > 0
                      ? "border-primary/60 bg-primary/15 text-primary"
                      : "border-border bg-surface-2 text-fg-subtle",
                  isToday && "ring-2 ring-fg/60 ring-offset-2 ring-offset-surface-1"
                )}
                title={`${WEEKDAY_NAMES[i]}: ${state}`}
              >
                {d.counted ? "✓" : d.count > 0 ? "·" : ""}
                <span className="sr-only">
                  {WEEKDAY_NAMES[i]}: {state}
                </span>
              </span>
              <span className={cn("text-[11px] font-semibold", isToday ? "text-fg" : "text-fg-subtle")} aria-hidden="true">
                {WEEKDAY_INITIALS[i]}
              </span>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
