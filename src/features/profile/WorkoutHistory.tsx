"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button, EmptyState, Pill, toast } from "@/src/components/ui";
import { formatDate, formatDuration, localTimeOf } from "@/src/lib/time";
import { loadWorkoutHistoryAction } from "@/src/server/stats/actions";
import type { HistoryItem } from "@/src/server/stats/history";
import { formatKg, groupByMonth } from "@/src/features/stats/format";

/** "Mis entrenamientos": historial paginado, agrupado por mes local, con los puntos que sumó cada uno. */
export function WorkoutHistory({ initialItems, initialCursor, tz }: { initialItems: HistoryItem[]; initialCursor: string | null; tz: string }) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [pending, startTransition] = useTransition();

  function loadMore() {
    startTransition(async () => {
      const r = await loadWorkoutHistoryAction(cursor);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.id));
        return [...prev, ...r.data.items.filter((i) => !seen.has(i.id))];
      });
      setCursor(r.data.nextCursor);
    });
  }

  if (items.length === 0) return <EmptyState title="Todavía no registraste entrenamientos" />;

  return (
    <div className="space-y-4">
      {groupByMonth(items, tz).map((g) => (
        <section key={g.month} aria-label={g.label} className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-fg-subtle first-letter:uppercase">{g.label}</h3>
          <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface-1">
            {g.items.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/workout/${a.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
                >
                  {a.thumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- miniaturas externas (R2)
                    <img src={a.thumbUrl} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-lg bg-surface-2 object-cover" />
                  ) : (
                    <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-surface-3 text-lg font-bold text-fg-muted">
                      {a.categoryName.charAt(0)}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-semibold">{a.categoryName}</span>
                      <span className="shrink-0 text-xs text-fg-subtle">
                        {formatDate(a.startedAt, tz)} · {localTimeOf(a.startedAt, tz)}
                      </span>
                    </span>
                    <span className="block truncate text-sm text-fg-muted">
                      {formatDuration(a.durationMinutes)}
                      {a.sets > 0 && ` · ${a.sets} ${a.sets === 1 ? "serie" : "series"}`}
                      {a.volumeKg > 0 && ` · ${formatKg(a.volumeKg)}`}
                    </span>
                    {a.points.length > 0 && (
                      <span className="mt-1 flex flex-wrap gap-1">
                        {a.points.map((p) => (
                          <Pill key={p.seasonId} tone={p.points > 0 ? "primary" : "default"} className="max-w-full">
                            <span className="truncate">
                              +{p.points} pts · {p.seasonName}
                            </span>
                          </Pill>
                        ))}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {cursor && (
        <Button variant="secondary" fullWidth pending={pending} onClick={loadMore}>
          Ver más
        </Button>
      )}
    </div>
  );
}
