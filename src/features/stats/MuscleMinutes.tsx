import { GROUP_LABEL } from "@/src/features/exercises/types";
import { formatDuration } from "@/src/lib/time";
import type { UserStats } from "@/src/server/stats";
import { HBarList } from "./HBarList";

const TOP_MUSCLES = 8;
const groupLabel = (k: string) => GROUP_LABEL[k] ?? k;

const EMPTY = <p className="text-sm text-fg-muted">Registrá ejercicios con series para ver qué músculos trabajás.</p>;

/** Minutos por grupo muscular del rango, con su porcentaje. */
export function MuscleGroupMinutes({ data }: { data: UserStats["muscleMinutes"] }) {
  if (data.groups.length === 0) return EMPTY;
  const total = data.groups.reduce((acc, g) => acc + g.minutes, 0);
  return (
    <HBarList
      ariaLabel="Minutos por grupo muscular"
      rows={data.groups.map((g) => ({
        key: g.groupKey,
        label: groupLabel(g.groupKey),
        value: g.minutes,
        display: formatDuration(g.minutes),
        hint: `${Math.round((g.minutes / total) * 100)} %`,
      }))}
    />
  );
}

/** Los músculos con más minutos del rango y en cuántos entrenamientos aparece el primero. */
export function TopMuscleMinutes({ data }: { data: UserStats["muscleMinutes"] }) {
  if (data.muscles.length === 0) return EMPTY;
  const top = data.muscles[0];
  return (
    <div className="space-y-3">
      <p className="text-sm text-fg-muted">
        Tu músculo más entrenado es <strong className="text-primary">{top.name.toLowerCase()}</strong>, que aparece en{" "}
        <strong className="text-fg">{top.workouts}</strong> {top.workouts === 1 ? "entrenamiento" : "entrenamientos"}.
      </p>
      <HBarList
        ariaLabel="Minutos por músculo"
        rows={data.muscles.slice(0, TOP_MUSCLES).map((m) => ({
          key: m.muscleId,
          label: m.name,
          value: m.minutes,
          display: formatDuration(m.minutes),
          // El grupo como aclaración, salvo que el músculo se llame igual (Pecho · pecho).
          hint: groupLabel(m.groupKey).toLowerCase() === m.name.toLowerCase() ? undefined : groupLabel(m.groupKey).toLowerCase(),
        }))}
      />
    </div>
  );
}
