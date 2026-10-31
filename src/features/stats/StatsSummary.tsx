import { formatDuration } from "@/src/lib/time";
import type { UserStats } from "@/src/server/stats";
import { formatDecimal, formatHours, formatInt, formatKg } from "./format";

/** Totales de por vida y promedios de las últimas 12 semanas (las rachas están en `StreakCards`). */
export function StatsSummary({ stats }: { stats: UserStats }) {
  const { totals, averages } = stats;
  return (
    <dl className="grid grid-cols-2 gap-x-3 gap-y-4 rounded-card border border-border bg-surface-1 p-4 sm:grid-cols-3">
      {[
        { label: "Entrenamientos", value: formatInt(totals.workouts) },
        { label: "Tiempo total", value: formatHours(totals.minutes) },
        {
          label: "Por semana",
          value: formatDecimal(averages.workoutsPerWeek),
          hint: "promedio, últimas 12 sem.",
        },
        {
          label: "Duración promedio",
          value: formatDuration(averages.minutesPerWorkout),
          hint: "últimas 12 sem.",
        },
        {
          label: "Sesión más larga",
          value: formatDuration(stats.longestWorkoutMinutes),
        },
        {
          label: "Volumen total",
          value: formatKg(totals.volumeKg),
          hint: `${formatInt(totals.sets)} series`,
        },
      ].map((i) => (
        <div key={i.label} className="flex min-w-0 flex-col-reverse justify-end gap-0.5">
          <dt className="text-xs text-fg-muted">
            {i.label}
            {i.hint && <span className="block text-fg-subtle">{i.hint}</span>}
          </dt>
          <dd className="text-xl font-extrabold leading-tight">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}
