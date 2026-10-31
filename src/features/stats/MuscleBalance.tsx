import { GROUP_KEYS, GROUP_LABEL } from "@/src/features/exercises/types";
import type { UserStats } from "@/src/server/stats";
import { formatDecimal } from "./format";
import { HBarList } from "./HBarList";

const label = (k: string) => GROUP_LABEL[k] ?? k;

/** Series por grupo muscular (de por vida) con una nota de balance. */
export function MuscleBalance({ groups }: { groups: UserStats["byMuscleGroup"] }) {
  if (groups.length === 0) return <p className="text-sm text-fg-muted">Registrá ejercicios con series para ver qué músculos trabajás.</p>;
  const total = groups.reduce((acc, g) => acc + g.sets, 0);
  const top = groups[0];
  const missing = GROUP_KEYS.filter((k) => !groups.some((g) => g.groupKey === k));
  const low = missing.length > 0 ? missing.map(label) : groups.length > 1 ? [label(groups[groups.length - 1].groupKey)] : [];
  return (
    <div className="space-y-3">
      <HBarList
        ariaLabel="Series por grupo muscular"
        rows={groups.map((g) => ({
          key: g.groupKey,
          label: label(g.groupKey),
          value: g.sets,
          display: `${formatDecimal(Math.round(g.sets))} series`,
          hint: `${Math.round((g.sets / total) * 100)} %`,
        }))}
      />
      <p className="text-sm text-fg-muted">
        Más volumen en <strong className="text-fg">{label(top.groupKey).toLowerCase()}</strong>
        {low.length > 0 && (
          <>
            ; {missing.length > 0 ? "sin series de" : "lo que menos entrenás:"} <strong className="text-fg">{low.join(", ").toLowerCase()}</strong>
          </>
        )}
        .
      </p>
    </div>
  );
}
