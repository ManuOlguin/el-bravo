import Link from "next/link";
import { Card, CardHeader } from "@/src/components/ui";
import { formatSeasonRange } from "@/src/features/season/format";
import type { PastSeasonSummary } from "./data";

/** Temporadas terminadas y publicadas, con el ganador y link a los resultados. */
export function PastSeasons({ groupId, seasons }: { groupId: string; seasons: PastSeasonSummary[] }) {
  if (seasons.length === 0) return null;
  return (
    <Card className="px-0 pb-2">
      <div className="px-4">
        <CardHeader title="Temporadas anteriores" />
      </div>
      <ul>
        {seasons.map((s) => (
          <li key={s.id} className="border-t border-border first:border-t-0">
            <Link
              href={`/group/${groupId}/season/${s.id}`}
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2 active:bg-surface-2"
            >
              <span className="text-2xl" aria-hidden="true">
                🏆
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{s.name}</span>
                <span className="block truncate text-xs text-fg-muted">
                  {formatSeasonRange(s.startDate, s.endDate)}
                  {s.winners.length > 0 && (
                    <>
                      {" · "}
                      <span className="text-gold">{s.winners.map((w) => w.name ?? "Usuario").join(" y ")}</span>
                    </>
                  )}
                </span>
              </span>
              <span className="shrink-0 text-sm font-semibold text-primary">Ver</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
