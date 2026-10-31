"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Avatar, Card, cn } from "@/src/components/ui";
import type { StandingRow } from "@/src/server/scoring/types";
import { medalOf } from "./format";

type SortKey = "rank" | "points" | "daysTrained" | "weeksGoalMet" | "bestStreak" | "minutes";
const COLUMNS: { key: Exclude<SortKey, "rank">; label: string; short: string }[] = [
  { key: "points", label: "Puntos", short: "Pts" },
  { key: "daysTrained", label: "Días entrenados", short: "Días" },
  { key: "weeksGoalMet", label: "Semanas cumplidas", short: "Sem." },
  { key: "bestStreak", label: "Mejor racha", short: "Racha" },
  { key: "minutes", label: "Minutos", short: "Min" },
];

/** Tabla final: todos con puesto, puntos, días, semanas, mejor racha y minutos. Ordenable por columna. */
export function FinalStandingsTable({ standings, viewerId, title = "Tabla final" }: { standings: StandingRow[]; viewerId: string; title?: string }) {
  const [sort, setSort] = useState<SortKey>("rank");
  const rows = useMemo(() => {
    if (sort === "rank") return standings;
    return [...standings].sort((a, b) => b[sort] - a[sort] || a.rank - b.rank);
  }, [standings, sort]);

  const header = (key: SortKey, label: string, short: string, className?: string) => (
    <th key={key} scope="col" aria-sort={sort === key ? (key === "rank" ? "ascending" : "descending") : "none"} className={cn("px-2 py-2 font-semibold", className)}>
      <button
        type="button"
        onClick={() => setSort(key)}
        title={`Ordenar por ${label.toLowerCase()}`}
        className={cn("rounded px-1 transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary", sort === key && "text-primary")}
      >
        {short}
        {sort === key && <span aria-hidden="true"> ▾</span>}
      </button>
    </th>
  );

  return (
    <Card className="px-0 pb-2">
      <h2 className="px-4 pb-2 text-lg font-bold">{title}</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[22rem] text-sm">
          <thead className="text-xs text-fg-muted">
            <tr className="border-b border-border">
              {header("rank", "Puesto", "#", "w-10 pl-4 text-left")}
              <th scope="col" className="px-2 py-2 text-left font-semibold">
                Nombre
              </th>
              {COLUMNS.map((c) => header(c.key, c.label, c.short, "text-right"))}
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const me = s.userId === viewerId;
              return (
                <tr key={s.userId} aria-current={me ? "true" : undefined} className={cn("border-b border-border last:border-b-0", me && "bg-primary/10")}>
                  <td className="py-2 pl-4 pr-2 font-bold tabular-nums">{medalOf(s.rank) ?? s.rank}</td>
                  <td className="max-w-[9rem] px-2 py-2">
                    <span className="flex items-center gap-2">
                      <Avatar name={s.name} src={s.photoUrl} size="xs" href={`/u/${s.userId}`} />
                      <Link href={`/u/${s.userId}`} className={cn("truncate font-semibold hover:underline", me && "text-primary")}>
                        {me ? "Vos" : (s.name ?? "Usuario")}
                      </Link>
                    </span>
                  </td>
                  {COLUMNS.map((c) => (
                    <td key={c.key} className={cn("px-2 py-2 text-right tabular-nums", c.key === "points" && "font-bold", c.key === "minutes" && "pr-4")}>
                      {s[c.key]}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
