import { formatLocalDate } from "@/src/lib/time";
import type { PersonalRecord } from "@/src/server/stats";
import { formatDecimal } from "./format";

/** Mejores marcas por ejercicio (top 10 por peso), con la fecha en que se lograron. */
export function PersonalRecords({ records }: { records: PersonalRecord[] }) {
  if (records.length === 0) return <p className="text-sm text-fg-muted">Cargá series con peso o repeticiones para ver tus récords.</p>;
  return (
    <div className="overflow-hidden rounded-card border border-border">
      <table className="w-full table-fixed text-left text-sm">
        <thead className="bg-surface-2 text-xs text-fg-subtle">
          <tr>
            <th scope="col" className="px-3 py-2 font-semibold">
              Ejercicio
            </th>
            <th scope="col" className="w-28 px-3 py-2 text-right font-semibold">
              Mejor marca
            </th>
            <th scope="col" className="w-20 px-3 py-2 text-right font-semibold">
              Fecha
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-surface-1">
          {records.map((r) => (
            <tr key={r.exerciseId}>
              <th scope="row" className="truncate px-3 py-2.5 font-semibold">
                {r.exerciseName}
              </th>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {r.bestWeightKg !== null ? (
                  <>
                    <strong>{formatDecimal(r.bestWeightKg)} kg</strong>
                    {r.bestReps !== null && <span className="text-fg-muted"> × {r.bestReps}</span>}
                  </>
                ) : (
                  <strong>{r.bestReps} reps</strong>
                )}
              </td>
              <td className="px-3 py-2.5 text-right text-xs text-fg-muted">{formatLocalDate(r.date)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
