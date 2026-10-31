"use client";
import { useState } from "react";
import { cn, ProgressBar, Sheet } from "@/src/components/ui";
import { DEFAULT_TZ, formatDate } from "@/src/lib/time";
import type { UserBadgeView } from "@/src/server/badges/types";
import { BadgeIcon } from "./BadgeIcon";
import { levelToneClass, progressLabel, ringFraction, romanLevel } from "./levels";

const R = 28;
const CIRCUMFERENCE = 2 * Math.PI * R;

/** Círculo de 64 px con el ícono y un anillo de progreso hacia el próximo umbral. */
export function BadgeMedallion({ badge, size = 64 }: { badge: Pick<UserBadgeView, "iconKey" | "level" | "progress" | "nextThreshold">; size?: number }) {
  const locked = badge.level <= 0;
  const fraction = ringFraction(badge);
  const tone = levelToneClass(badge.level);
  return (
    <span className={cn("relative grid shrink-0 place-items-center", locked && "opacity-50")} style={{ width: size, height: size }}>
      <svg viewBox="0 0 64 64" width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx="32" cy="32" r={R} fill="none" strokeWidth="4" className="stroke-surface-3" />
        {fraction > 0 && (
          <circle
            cx="32"
            cy="32"
            r={R}
            fill="none"
            strokeWidth="4"
            strokeLinecap="round"
            stroke="currentColor"
            strokeDasharray={`${fraction * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            className={cn("transition-[stroke-dasharray] duration-500", locked ? "text-fg-muted" : tone)}
          />
        )}
      </svg>
      <span className={cn("grid place-items-center rounded-full bg-surface-2", locked ? "text-fg-muted" : tone)} style={{ width: size - 16, height: size - 16 }}>
        <BadgeIcon iconKey={badge.iconKey} size={Math.round(size * 0.42)} />
      </span>
    </span>
  );
}

/** Nombre con el nivel en romanos, coloreado por tono. */
export function BadgeTitle({ name, level, className }: { name: string; level: number; className?: string }) {
  return (
    <span className={className}>
      {name}
      {level > 0 && <span className={cn("ml-1 font-extrabold", levelToneClass(level))}>{romanLevel(level)}</span>}
    </span>
  );
}

export function BadgeCard({ badge, timezone = DEFAULT_TZ }: { badge: UserBadgeView; timezone?: string }) {
  const [open, setOpen] = useState(false);
  const locked = badge.level <= 0;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${badge.name}${locked ? ", bloqueada" : `, nivel ${badge.level}`}`}
        className={cn(
          "flex w-full min-w-0 flex-col items-center gap-2 rounded-card px-1 py-2 text-center",
          "transition-[transform,background-color] duration-100 hover:bg-surface-2 active:scale-95",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        )}
      >
        <BadgeMedallion badge={badge} />
        <span className="w-full min-w-0">
          <span className="line-clamp-2 break-words hyphens-auto text-xs font-semibold leading-tight">{badge.name}</span>
          {locked ? (
            <span className="mt-0.5 block text-[11px] text-fg-subtle">Bloqueada</span>
          ) : (
            <span className={cn("mt-0.5 block text-xs font-extrabold", levelToneClass(badge.level))}>{romanLevel(badge.level)}</span>
          )}
          <span className="block text-[11px] tabular-nums text-fg-subtle">{progressLabel(badge)}</span>
        </span>
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title={badge.name}>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <BadgeMedallion badge={badge} size={72} />
            <div className="min-w-0 space-y-1">
              <p className="text-sm text-fg-muted">{badge.description}</p>
              <p className="text-sm font-semibold">
                {locked ? "Bloqueada" : <BadgeTitle name="Nivel" level={badge.level} />}
                {badge.maxLevel > 0 && <span className="font-normal text-fg-subtle"> de {romanLevel(badge.maxLevel)}</span>}
              </p>
            </div>
          </div>

          <ProgressBar
            value={ringFraction(badge)}
            tone={badge.level >= 3 ? "gold" : "primary"}
            label={badge.nextThreshold === null ? "Nivel máximo alcanzado" : `Progreso: ${progressLabel(badge)}`}
          />

          {badge.levels && badge.levels.length > 0 && (
            <ol className="divide-y divide-border rounded-card border border-border">
              {badge.levels.map((l) => {
                const reached = badge.level >= l.level;
                return (
                  <li key={l.level} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className={cn("font-bold", reached ? levelToneClass(l.level) : "text-fg-subtle")}>
                      Nivel {romanLevel(l.level)}
                    </span>
                    <span className={cn("tabular-nums", reached ? "text-fg" : "text-fg-muted")}>
                      {l.threshold}
                      {reached && <span className="ml-2 text-success" aria-label="logrado">✓</span>}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}

          {badge.achievedAt && (
            <p className="text-xs text-fg-subtle">Nivel actual logrado el {formatDate(badge.achievedAt, timezone, "long")}.</p>
          )}
        </div>
      </Sheet>
    </>
  );
}
