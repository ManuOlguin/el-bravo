import { formatDuration } from "@/src/lib/time";
import type { UserStats } from "@/src/server/stats";
import { formatDecimal, formatHours, formatInt, formatKg } from "./format";

/**
 * Totales de por vida y promedios de las últimas 12 semanas (las rachas están en `StreakCards`).
 * Celdas separadas por líneas de 1 px: el fondo `border` del contenedor asoma entre celdas (`gap-px`).
 */
export function StatsSummary({ stats }: { stats: UserStats }) {
  const { totals, averages } = stats;
  const groups = [
    {
      title: "Desde que empezaste",
      items: [
        { label: "Entrenamientos", value: formatInt(totals.workouts) },
        { label: "Tiempo total", value: formatHours(totals.minutes) },
        { label: "Sesión más larga", value: formatDuration(stats.longestWorkoutMinutes) },
        { label: "Volumen", value: formatKg(totals.volumeKg), hint: `${formatInt(totals.sets)} series` },
      ],
      cols: "grid-cols-2 sm:grid-cols-4",
    },
    {
      title: "Promedios · últimas 12 semanas",
      items: [
        { label: "Por semana", value: formatDecimal(averages.workoutsPerWeek), hint: "entrenamientos" },
        { label: "Duración", value: formatDuration(averages.minutesPerWorkout), hint: "por entrenamiento" },
      ],
      cols: "grid-cols-2",
    },
  ];
  return (
    <section aria-label="Resumen" className="grid gap-px overflow-hidden rounded-card border border-border bg-border shadow-card">
      {groups.map((g) => (
        <div key={g.title} className="grid gap-px">
          <h2 className="bg-surface-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-fg-muted">{g.title}</h2>
          <dl className={`grid gap-px ${g.cols}`}>
            {g.items.map((i) => (
              <div key={i.label} className="flex min-w-0 flex-col-reverse justify-end gap-0.5 bg-surface-1 px-4 py-3">
                <dt className="truncate text-xs text-fg-muted">
                  {i.label}
                  {i.hint && <span className="block truncate text-fg-subtle">{i.hint}</span>}
                </dt>
                <dd className="truncate text-xl font-extrabold leading-tight tabular-nums">{i.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </section>
  );
}
