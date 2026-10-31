import { formatHours, formatInt } from "@/src/features/stats/format";

/** Fila de 4 números: entrenamientos, racha 🔥, semanas cumplidas y horas totales (salen de `getUserStats`). */
export function ProfileStatsRow({
  workouts,
  streak,
  perfectWeeks,
  minutes,
}: {
  workouts: number;
  streak: number;
  perfectWeeks: number;
  minutes: number;
}) {
  const items = [
    // Guion opcional (&shy;): en 375 px la palabra entera no entra en la columna.
    { label: workouts === 1 ? "Entrena­miento" : "Entrena­mientos", value: formatInt(workouts) },
    { label: "Racha", value: `${streak} 🔥` },
    { label: "Semanas cumplidas", value: formatInt(perfectWeeks) },
    { label: "Tiempo total", value: formatHours(minutes) },
  ];
  return (
    <dl className="grid grid-cols-4 divide-x divide-border overflow-hidden rounded-card border border-border bg-surface-1">
      {items.map((i) => (
        <div key={i.label} className="flex min-w-0 flex-col-reverse items-center justify-end gap-0.5 px-1 py-3 text-center">
          <dt className="text-[11px] leading-tight text-fg-muted">{i.label}</dt>
          <dd className="text-lg font-extrabold leading-tight tabular-nums">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}
