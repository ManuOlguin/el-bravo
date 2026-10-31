"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar, cn } from "@/src/components/ui";
import type { StandingRow } from "@/src/server/scoring/types";
import { MEDALS } from "./format";

const STYLES = [
  { height: "h-32", tone: "bg-gold/25 border-gold/60 text-gold", delay: "delay-500" },
  { height: "h-24", tone: "bg-silver/20 border-silver/60 text-silver", delay: "delay-200" },
  { height: "h-16", tone: "bg-bronze/20 border-bronze/60 text-bronze", delay: "delay-0" },
] as const;

/** Podio de los 3 primeros (2 · 1 · 3) en oro, plata y bronce. Los pedestales "crecen" al montarse. */
export function Podium({ standings, viewerId, animate = true, links = true }: { standings: StandingRow[]; viewerId: string; animate?: boolean; links?: boolean }) {
  const [shown, setShown] = useState(!animate);
  useEffect(() => {
    if (!animate) return;
    const t = window.setTimeout(() => setShown(true), 50);
    return () => window.clearTimeout(t);
  }, [animate]);

  const top = standings.slice(0, 3);
  if (top.length === 0) return null;
  // Orden visual: 2°, 1°, 3°.
  const slots = [top[1], top[0], top[2]].map((row, i) => ({ row, place: [1, 0, 2][i] }));

  return (
    <ol className="grid grid-cols-3 items-end gap-2" aria-label="Podio">
      {slots.map(({ row, place }) =>
        row ? (
          <li key={row.userId} className="flex min-w-0 flex-col items-center gap-1.5" aria-label={`Puesto ${row.rank}: ${row.name ?? "Usuario"}, ${row.points} puntos`}>
            <span
              className={cn(
                "flex flex-col items-center gap-1 transition-[opacity,transform] duration-500",
                STYLES[place].delay,
                shown ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
              )}
            >
              <Avatar name={row.name} src={row.photoUrl} size={place === 0 ? "xl" : "lg"} href={links ? `/u/${row.userId}` : undefined} className={cn(place === 0 && "ring-4 ring-gold/60")} />
              {links ? (
                <Link href={`/u/${row.userId}`} className={cn("max-w-full truncate text-sm font-bold hover:underline", row.userId === viewerId && "text-primary")}>
                  {row.userId === viewerId ? "Vos" : (row.name ?? "Usuario")}
                </Link>
              ) : (
                <span className={cn("max-w-full truncate text-sm font-bold", row.userId === viewerId && "text-primary")}>
                  {row.userId === viewerId ? "Vos" : (row.name ?? "Usuario")}
                </span>
              )}
              <span className="text-xs font-semibold tabular-nums text-fg-muted">{row.points} pts</span>
            </span>
            <span
              className={cn(
                "flex w-full items-start justify-center overflow-hidden rounded-t-xl border border-b-0 pt-2 text-2xl font-extrabold transition-[height] duration-700 ease-out",
                STYLES[place].tone,
                STYLES[place].delay,
                shown ? STYLES[place].height : "h-0"
              )}
              aria-hidden="true"
            >
              {MEDALS[Math.min(row.rank, 3) - 1] ?? row.rank}
            </span>
          </li>
        ) : (
          <li key={`empty-${place}`} aria-hidden="true" />
        )
      )}
    </ol>
  );
}
