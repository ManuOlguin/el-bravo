import { Card, ProgressBar } from "@/src/components/ui";
import type { BadgeChange } from "@/src/server/badges/types";
import { BadgeMedallion, BadgeTitle } from "./BadgeCard";
import { ringFraction, romanLevel, splitBadgeChanges } from "./levels";

/** Insignias afectadas por un entrenamiento (pantalla post-entreno, W2-1). Si no hay nada para mostrar, no renderiza. */
export function BadgeChangeList({ changes }: { changes: BadgeChange[] }) {
  const { levelUps, progressed } = splitBadgeChanges(changes);
  if (levelUps.length === 0 && progressed.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* React 19 deduplica y sube este <style> por `href`. */}
      <style href="el-bravo-badge-pop" precedence="default">
        {"@keyframes pop{0%{transform:scale(.85);opacity:0}60%{transform:scale(1.04);opacity:1}100%{transform:scale(1)}}"}
      </style>

      {levelUps.map((c) => (
        <Card key={c.code} className="flex animate-[pop_.4s_ease-out] items-center gap-4 border-gold/40 bg-surface-2 motion-reduce:animate-none">
          <BadgeMedallion
            badge={{ iconKey: c.iconKey, level: c.levelAfter, progress: c.progressAfter, nextThreshold: c.nextThreshold }}
          />
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-gold">¡Subiste de nivel!</p>
            <BadgeTitle name={c.name} level={c.levelAfter} className="block truncate text-base font-bold" />
            <p className="text-xs text-fg-muted">
              {c.levelBefore > 0 ? `De ${romanLevel(c.levelBefore)} a ${romanLevel(c.levelAfter)}` : "Insignia desbloqueada"}
            </p>
          </div>
        </Card>
      ))}

      {progressed.length > 0 && (
        <ul className="space-y-2">
          {progressed.map((c) => {
            const delta = c.progressAfter - c.progressBefore;
            const target = c.nextThreshold === null ? `${c.progressAfter}` : `${c.progressAfter}/${c.nextThreshold}`;
            return (
              <li key={c.code} className="flex items-center gap-3 rounded-card border border-border bg-surface-1 p-3">
                <BadgeMedallion
                  size={40}
                  badge={{ iconKey: c.iconKey, level: c.levelAfter, progress: c.progressAfter, nextThreshold: c.nextThreshold }}
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <BadgeTitle name={c.name} level={c.levelAfter} className="truncate text-sm font-semibold" />
                    <span className="shrink-0 text-xs tabular-nums text-fg-muted">
                      <span className="font-semibold text-primary">+{delta}</span> → {target}
                    </span>
                  </div>
                  <ProgressBar value={ringFraction({ progress: c.progressAfter, nextThreshold: c.nextThreshold })} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
