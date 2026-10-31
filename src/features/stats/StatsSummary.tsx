import { StatCard } from "@/src/components/ui";
import { formatDuration } from "@/src/lib/time";
import type { UserStats } from "@/src/server/stats";
import { formatDecimal, formatHours, formatInt, formatKg } from "./format";

/** Totales de por vida, rachas y promedios de las últimas 12 semanas. */
export function StatsSummary({ stats }: { stats: UserStats }) {
  const { totals, averages } = stats;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Racha" value={`${stats.currentStreakWeeks} 🔥`} hint={`Mejor: ${stats.bestStreakWeeks} · semanas cumplidas seguidas`} tone="gold" />
        <StatCard label="Cumplidas" value={formatInt(stats.perfectWeeks)} hint={`semanas con el objetivo · ${stats.activeWeeksStreak} activas seguidas`} tone="primary" />
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-4 rounded-card border border-border bg-surface-1 p-4 sm:grid-cols-3">
        {[
          { label: "Entrenamientos", value: formatInt(totals.workouts) },
          { label: "Tiempo total", value: formatHours(totals.minutes) },
          { label: "Por semana", value: formatDecimal(averages.workoutsPerWeek), hint: "promedio, últimas 12 sem." },
          { label: "Duración promedio", value: formatDuration(averages.minutesPerWorkout), hint: "últimas 12 sem." },
          { label: "Sesión más larga", value: formatDuration(stats.longestWorkoutMinutes) },
          { label: "Volumen total", value: formatKg(totals.volumeKg), hint: `${formatInt(totals.sets)} series` },
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
    </div>
  );
}
