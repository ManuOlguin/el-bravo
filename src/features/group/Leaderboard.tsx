import Link from "next/link";
import { Avatar, Card, CardHeader, EmptyState, cn } from "@/src/components/ui";
import type { StandingRow } from "@/src/server/scoring/types";
import { medalOf } from "@/src/features/season/format";
import type { SeasonSummary } from "@/src/features/season/types";
import { PointsRulesSheet } from "./PointsRulesSheet";

/** Ranking en vivo de la temporada: puesto, avatar, nombre, puntos, semanas cumplidas y racha. */
export function Leaderboard({
  season,
  standings,
  viewerId,
  title = "Ranking",
  limit,
  moreHref,
}: {
  season: Pick<SeasonSummary, "rules" | "categories" | "awards">;
  standings: StandingRow[];
  viewerId: string;
  title?: string;
  /** Muestra solo los primeros N (más el viewer si queda afuera). */
  limit?: number;
  moreHref?: string;
}) {
  const visible = limit && standings.length > limit
    ? standings.filter((s, i) => i < limit || s.userId === viewerId)
    : standings;
  return (
    <Card className="px-0 pb-2">
      <div className="px-4">
        <CardHeader title={title} action={<PointsRulesSheet season={season} label="¿Cómo se suman?" />} />
      </div>
      {standings.length === 0 ? (
        <div className="px-4 pb-2">
          <EmptyState title="Todavía nadie se sumó" description="Unite a la temporada para aparecer en el ranking." className="py-6" />
        </div>
      ) : (
        <ol>
          {visible.map((s) => {
            const me = s.userId === viewerId;
            const medal = medalOf(s.rank);
            return (
              <li
                key={s.userId}
                aria-current={me ? "true" : undefined}
                className={cn("flex items-center gap-3 px-4 py-2", me && "bg-primary/10")}
              >
                <span className="w-7 shrink-0 text-center text-base font-extrabold tabular-nums text-fg-muted">
                  {medal ?? s.rank}
                </span>
                <Avatar name={s.name} src={s.photoUrl} size="sm" href={`/u/${s.userId}`} />
                <div className="min-w-0 flex-1">
                  <Link href={`/u/${s.userId}`} className={cn("block truncate text-sm font-semibold hover:underline", me && "text-primary")}>
                    {me ? "Vos" : (s.name ?? "Usuario")}
                  </Link>
                  <p className="text-xs text-fg-subtle">
                    {s.weeksGoalMet} {s.weeksGoalMet === 1 ? "semana" : "semanas"} ✓
                    {s.currentStreak > 0 && <span className="ml-1.5">{s.currentStreak}🔥</span>}
                  </p>
                </div>
                <span className="shrink-0 text-right">
                  <span className="block text-base font-extrabold tabular-nums">{s.points}</span>
                  <span className="block text-[11px] text-fg-subtle">pts</span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
      {moreHref && limit && standings.length > limit && (
        <div className="px-4 pt-2">
          <Link href={moreHref} className="text-sm font-semibold text-primary hover:underline">
            Ver el ranking completo
          </Link>
        </div>
      )}
    </Card>
  );
}
