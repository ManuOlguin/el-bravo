"use client";
import { Card, Pill, cn } from "@/src/components/ui";
import { BadgeChangeList } from "@/src/features/badges";
import { formatDuration } from "@/src/lib/time";
import type { ScoringEffect } from "@/src/server/scoring/types";
import type { BadgeChange } from "@/src/server/badges/types";
import { displayReason, formatVolume } from "./format";

export { displayReason };

export type WorkoutSummaryNumbers = { durationMinutes: number; exercises: number; sets: number; volumeKg: number };

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-surface-2 px-2 py-2.5 text-center">
      <p className="truncate text-lg font-extrabold leading-tight tabular-nums">{value}</p>
      <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">{label}</p>
    </div>
  );
}

export function WorkoutSummaryStats({ summary }: { summary: WorkoutSummaryNumbers }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <SummaryStat label="Duración" value={formatDuration(summary.durationMinutes)} />
      <SummaryStat label="Ejercicios" value={String(summary.exercises)} />
      <SummaryStat label="Series" value={String(summary.sets)} />
      <SummaryStat label="Volumen" value={summary.volumeKg > 0 ? formatVolume(summary.volumeKg) : "—"} />
    </div>
  );
}

/** Una tarjeta por temporada afectada: "+N pts en <Temporada> (<Grupo>)", total y puesto. */
export function ScoringEffectCard({ effect, sharedDay }: { effect: ScoringEffect; sharedDay: boolean }) {
  const pts = effect.activityPoints;
  const reason = displayReason(effect.activityReason) ?? (sharedDay ? "Se sumó al tiempo de tu día" : null);
  const climbed = effect.rankBefore !== null && effect.rankAfter > 0 && effect.rankAfter < effect.rankBefore;
  return (
    <Card className="space-y-1.5 p-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 text-sm">
          {pts > 0 ? (
            <span className="text-lg font-extrabold text-primary tabular-nums">+{pts} pts</span>
          ) : (
            <span className="text-lg font-extrabold text-fg-subtle tabular-nums">0 pts</span>
          )}{" "}
          <span className="text-fg-muted">en</span> <span className="font-semibold">{effect.seasonName}</span>{" "}
          <span className="text-fg-subtle">({effect.groupName})</span>
        </p>
      </div>
      {reason && <p className={cn("text-xs", pts > 0 ? "text-fg-muted" : "text-fg-subtle")}>{reason}</p>}
      <div className="flex flex-wrap items-center gap-2 text-xs text-fg-muted">
        <span className="tabular-nums">
          Total: {effect.totalBefore} → <span className="font-bold text-fg">{effect.totalAfter}</span>
        </span>
        {effect.rankAfter > 0 && <Pill>Puesto {effect.rankAfter}</Pill>}
        {climbed && <Pill tone="gold">Subiste al puesto {effect.rankAfter} 🎉</Pill>}
      </div>
    </Card>
  );
}

/** Contenido del resultado post-entreno: resumen, puntos por temporada e insignias afectadas. */
export function WorkoutResult({
  title,
  subtitle,
  summary,
  scoring,
  badges,
  sharedDaySeasonIds,
  children,
}: {
  title: string;
  subtitle?: string;
  summary: WorkoutSummaryNumbers;
  scoring: ScoringEffect[];
  badges: BadgeChange[];
  sharedDaySeasonIds: string[];
  /** Avisos y acciones extra (fotos que fallaron, actualizar rutina, botones). */
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      <header className="space-y-1 text-center">
        <h2 className="text-3xl font-extrabold">{title}</h2>
        {subtitle && <p className="text-sm text-fg-muted">{subtitle}</p>}
      </header>
      <WorkoutSummaryStats summary={summary} />

      <section className="space-y-2" aria-label="Puntos">
        <h3 className="text-xs font-bold uppercase tracking-wide text-fg-subtle">Puntos</h3>
        {scoring.length === 0 ? (
          <p className="rounded-card border border-dashed border-border px-4 py-3 text-sm text-fg-muted">
            Este entrenamiento no suma en ninguna temporada activa de tus grupos.
          </p>
        ) : (
          scoring.map((e) => <ScoringEffectCard key={e.seasonId} effect={e} sharedDay={sharedDaySeasonIds.includes(e.seasonId)} />)
        )}
      </section>

      {badges.length > 0 && (
        <section className="space-y-2" aria-label="Insignias">
          <h3 className="text-xs font-bold uppercase tracking-wide text-fg-subtle">Insignias</h3>
          <BadgeChangeList changes={badges} />
        </section>
      )}

      {children}
    </div>
  );
}
