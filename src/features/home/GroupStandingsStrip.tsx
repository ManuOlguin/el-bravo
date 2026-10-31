import Link from "next/link";
import { Avatar, cn } from "@/src/components/ui";
import { standingHint } from "./logic";
import type { GroupStandingCard } from "./queries";

const rankTone = (rank: number) => (rank === 1 ? "text-gold" : rank === 2 ? "text-silver" : rank === 3 ? "text-bronze" : "text-fg");

/** Una tarjeta por temporada activa: "#2 en Temporada Verano · 340 pts · a 15 del #1" → grupo. */
export function GroupStandingsStrip({ cards }: { cards: GroupStandingCard[] }) {
  if (cards.length === 0) return null;
  return (
    <section aria-labelledby="standings-title" className="space-y-2">
      <h2 id="standings-title" className="text-sm font-bold uppercase tracking-wide text-fg-subtle">
        Tus temporadas
      </h2>
      <ul className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1">
        {cards.map((c) => (
          <li key={c.seasonId} className={cn("snap-start", cards.length === 1 ? "w-full" : "w-[85%] shrink-0 sm:w-72")}>
            <Link
              href={`/group/${c.groupId}`}
              className="flex h-full items-center gap-3 rounded-card border border-border bg-surface-1 p-4 shadow-card transition-[transform,background-color] duration-100 hover:bg-surface-2 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {c.standing ? (
                <span className={cn("w-14 shrink-0 text-center text-3xl font-extrabold tabular-nums", rankTone(c.standing.rank))}>
                  #{c.standing.rank}
                </span>
              ) : (
                <Avatar name={c.groupName} src={c.groupPhotoUrl} size="lg" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold uppercase tracking-wide text-fg-subtle">{c.groupName}</span>
                <span className="block truncate font-bold">en {c.seasonName}</span>
                <span className="block truncate text-sm text-fg-muted">
                  {c.standing ? (
                    <>
                      <span className="tabular-nums">{c.standing.points} pts</span> · {standingHint(c.standing)}
                    </>
                  ) : (
                    "Todavía no participás"
                  )}
                </span>
              </span>
              <span aria-hidden="true" className="text-fg-subtle">
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
