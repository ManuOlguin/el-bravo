import Link from "next/link";
import { Avatar, Card, CardHeader, EmptyState, cn } from "@/src/components/ui";
import type { StandingRow } from "@/src/server/scoring/types";
import { formatLocalDate } from "@/src/lib/time";
import { medalOf } from "./format";
import type { UserWeekCell, WeekState } from "./data";

const CELL: Record<WeekState, { icon: string; className: string; label: string }> = {
  met: { icon: "✓", className: "border-primary bg-primary-gradient text-on-primary", label: "cumplida" },
  current: { icon: "·", className: "border-primary/60 bg-primary/10 text-primary", label: "en curso" },
  missed: { icon: "✗", className: "border-border bg-surface-3 text-fg-subtle", label: "no cumplida" },
  future: { icon: "", className: "border-dashed border-border text-fg-subtle", label: "por venir" },
};

function WeekGrid({ weeks }: { weeks: UserWeekCell[] }) {
  return (
    <ol className="flex flex-wrap gap-1" aria-label="Semanas">
      {weeks.map((w) => {
        const c = CELL[w.state];
        const text = `Semana del ${formatLocalDate(w.weekKey)}: ${c.label} (${w.days} ${w.days === 1 ? "día" : "días"})`;
        return (
          <li key={w.weekKey} title={text} className={cn("grid h-5 w-5 place-items-center rounded border text-[10px] font-bold", c.className)}>
            <span aria-hidden="true">{c.icon}</span>
            <span className="sr-only">{text}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** Temporada en curso: ranking completo con la grilla de semanas de cada uno. */
export function SeasonLive({
  standings,
  weeks,
  viewerId,
  weeklyGoal,
}: {
  standings: StandingRow[];
  weeks: Record<string, UserWeekCell[]>;
  viewerId: string;
  weeklyGoal: number;
}) {
  return (
    <Card className="px-0 pb-2">
      <div className="px-4">
        <CardHeader title="Ranking" subtitle={`✓ semana cumplida (${weeklyGoal} días) · en curso · ✗ no cumplida`} />
      </div>
      {standings.length === 0 ? (
        <div className="px-4 pb-2">
          <EmptyState title="Todavía nadie se sumó" className="py-6" />
        </div>
      ) : (
        <ol>
          {standings.map((s) => {
            const me = s.userId === viewerId;
            return (
              <li key={s.userId} aria-current={me ? "true" : undefined} className={cn("flex items-center gap-3 border-t border-border px-4 py-2.5 first:border-t-0", me && "bg-primary/10")}>
                <span className="w-7 shrink-0 text-center font-extrabold tabular-nums text-fg-muted">{medalOf(s.rank) ?? s.rank}</span>
                <Avatar name={s.name} src={s.photoUrl} size="sm" href={`/u/${s.userId}`} />
                <div className="min-w-0 flex-1 space-y-1">
                  <Link href={`/u/${s.userId}`} className={cn("block truncate text-sm font-semibold hover:underline", me && "text-primary")}>
                    {me ? "Vos" : (s.name ?? "Usuario")}
                  </Link>
                  <WeekGrid weeks={weeks[s.userId] ?? []} />
                </div>
                <span className="shrink-0 text-right">
                  <span className="block font-extrabold tabular-nums">{s.points}</span>
                  <span className="block text-[11px] text-fg-subtle">
                    {s.daysTrained} {s.daysTrained === 1 ? "día" : "días"}
                    {s.currentStreak > 0 ? ` · ${s.currentStreak}🔥` : ""}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
