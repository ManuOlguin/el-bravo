import { formatDuration } from "@/src/lib/time";
import type { UserStats } from "@/src/server/stats";
import { formatHours } from "./format";

const LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const NAMES = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábados", "domingos"];
const BAR_H = 112; // px de la barra más alta

/** Minutos por día de la semana (lunes..domingo) del rango, con el valor arriba de cada barra. */
export function WeekdayBars({ days }: { days: UserStats["byWeekdayInRange"] }) {
  const max = Math.max(...days.map((d) => d.minutes), 0);
  const best = max > 0 ? days.findIndex((d) => d.minutes === max) : -1;
  if (max === 0) return <p className="text-sm text-fg-muted">Sin entrenamientos en este rango.</p>;
  return (
    <div className="space-y-2">
      <ol className="grid grid-cols-7 items-end gap-1.5" aria-label="Minutos por día de la semana">
        {days.map((d, i) => (
          <li
            key={LABELS[i]}
            className="flex flex-col items-center gap-1"
            aria-label={`${NAMES[i]}: ${formatDuration(d.minutes)} en ${d.workouts} ${d.workouts === 1 ? "entrenamiento" : "entrenamientos"}`}
            title={`${formatDuration(d.minutes)} · ${d.workouts} ${d.workouts === 1 ? "vez" : "veces"}`}
          >
            <span aria-hidden="true" className="text-[11px] font-semibold text-fg-muted tabular-nums">
              {d.minutes > 0 ? formatHours(d.minutes) : ""}
            </span>
            <span
              aria-hidden="true"
              className={d.minutes > 0 ? "w-full max-w-9 rounded-t-md bg-primary-gradient" : "h-1 w-full max-w-9 rounded-full bg-surface-3"}
              style={d.minutes > 0 ? { height: Math.max(6, Math.round((d.minutes / max) * BAR_H)) } : undefined}
            />
            <span aria-hidden="true" className={i === best ? "text-xs font-bold text-fg" : "text-xs text-fg-subtle"}>
              {LABELS[i]}
            </span>
          </li>
        ))}
      </ol>
      {best >= 0 && <p className="text-sm text-fg-muted">Tu día más fuerte: los {NAMES[best]}.</p>}
    </div>
  );
}
