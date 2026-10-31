import { formatDuration } from "@/src/lib/time";
import type { Daypart, UserStats } from "@/src/server/stats";
import { HBarList } from "./HBarList";

const LABEL: Record<Daypart, { name: string; hours: string }> = {
  morning: { name: "Mañana", hours: "6 a 12 h" },
  afternoon: { name: "Tarde", hours: "12 a 18 h" },
  night: { name: "Noche", hours: "18 a 24 h" },
  late: { name: "Madrugada", hours: "0 a 6 h" },
};

/** Minutos según la hora de inicio, del rango. Las franjas vacías se muestran igual (como referencia). */
export function DaypartBreakdown({ dayparts }: { dayparts: UserStats["byDaypart"] }) {
  if (dayparts.every((d) => d.minutes === 0)) return <p className="text-sm text-fg-muted">Sin entrenamientos en este rango.</p>;
  return (
    <HBarList
      ariaLabel="Minutos por franja horaria"
      rows={dayparts.map((d) => ({
        key: d.key,
        label: `${LABEL[d.key].name} · ${LABEL[d.key].hours}`,
        value: d.minutes,
        display: formatDuration(d.minutes),
        hint: `${d.workouts} ${d.workouts === 1 ? "vez" : "veces"}`,
      }))}
    />
  );
}
