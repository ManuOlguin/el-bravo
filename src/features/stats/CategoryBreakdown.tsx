import { formatDuration } from "@/src/lib/time";
import type { UserStats } from "@/src/server/stats";
import { HBarList } from "./HBarList";

/** Minutos por categoría en el rango elegido. */
export function CategoryBreakdown({ categories }: { categories: UserStats["byCategory"] }) {
  if (categories.length === 0) return <p className="text-sm text-fg-muted">Sin entrenamientos en este rango.</p>;
  return (
    <HBarList
      ariaLabel="Minutos por categoría"
      rows={categories.map((c) => ({
        key: c.categoryId,
        label: c.name,
        value: c.minutes,
        display: formatDuration(c.minutes),
        hint: `${c.workouts} ${c.workouts === 1 ? "vez" : "veces"}`,
      }))}
    />
  );
}
