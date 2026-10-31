"use client";

import { NumberInput, cn } from "@/src/components/ui";
import { AWARD_GROUPS, SEASON_AWARD_INFO, SEASON_AWARD_TYPES } from "@/src/server/scoring/awards";
import type { SeasonFormState } from "./season-form-state";

/**
 * Premios de la temporada: tarjetas seleccionables agrupadas (clásicos, músculos, horarios, deportes,
 * social, de la vergüenza), cada una con "puntos extra" opcionales (los de la vergüenza no suman puntos).
 */
export function AwardsPicker({
  state,
  onChange,
  errors = {},
}: {
  state: SeasonFormState;
  onChange(next: SeasonFormState): void;
  errors?: Record<string, string>;
}) {
  const set = (t: (typeof SEASON_AWARD_TYPES)[number], patch: Partial<SeasonFormState["awards"][typeof t]>) =>
    onChange({ ...state, awards: { ...state.awards, [t]: { ...state.awards[t], ...patch } } });

  return (
    <div className="space-y-3">
      <p className="text-sm text-fg-muted">Se calculan cuando termina la temporada. Si hay empate, ganan todos. Los puntos extra se suman al ranking final.</p>
      {errors.awards && (
        <p role="alert" className="text-sm text-danger">
          {errors.awards}
        </p>
      )}
      {AWARD_GROUPS.map((g) => {
        const types = SEASON_AWARD_TYPES.filter((t) => SEASON_AWARD_INFO[t].group === g.id);
        const selected = types.filter((t) => state.awards[t].enabled).length;
        return (
          <section key={g.id} aria-label={g.label} className="space-y-2">
            <h3 className="flex items-baseline justify-between px-1 text-xs font-bold uppercase tracking-wide text-fg-subtle">
              {g.label}
              {selected > 0 && (
                <span className="normal-case tracking-normal text-primary">
                  {selected} elegido{selected === 1 ? "" : "s"}
                </span>
              )}
            </h3>
            <ul className="grid gap-2 sm:grid-cols-2">
              {types.map((t) => {
                const info = SEASON_AWARD_INFO[t];
                const a = state.awards[t];
                const err = errors[`award.${t}`];
                return (
                  <li
                    key={t}
                    className={cn("rounded-card border bg-surface-2 transition-colors", a.enabled ? "border-primary bg-primary/10" : "border-border")}
                  >
                    <button
                      type="button"
                      aria-pressed={a.enabled}
                      onClick={() => set(t, { enabled: !a.enabled })}
                      className="flex w-full items-start gap-3 rounded-card p-3 text-left transition-transform active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <span className="text-2xl" aria-hidden="true">
                        {info.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold">{info.name}</span>
                        <span className="block text-xs text-fg-muted">{info.description}</span>
                      </span>
                      <span
                        aria-hidden="true"
                        className={cn(
                          "grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs font-bold",
                          a.enabled ? "border-primary bg-primary text-on-primary" : "border-border",
                        )}
                      >
                        {a.enabled ? "✓" : ""}
                      </span>
                    </button>
                    {a.enabled && info.shame && <p className="px-3 pb-3 text-xs text-fg-subtle">No suma puntos: es solo para la cargada.</p>}
                    {a.enabled && !info.shame && (
                      <div className="flex items-center gap-3 px-3 pb-3">
                        <label htmlFor={`award-bonus-${t}`} className="flex-1 text-xs text-fg-muted">
                          Puntos extra para el ganador
                        </label>
                        <NumberInput
                          id={`award-bonus-${t}`}
                          value={a.bonusPoints}
                          onChange={(v) => set(t, { bonusPoints: v })}
                          min={0}
                          max={200}
                          step={1}
                          suffix="pts"
                          invalid={!!err}
                          className="w-28"
                        />
                      </div>
                    )}
                    {err && (
                      <p role="alert" className="px-3 pb-3 text-xs text-danger">
                        {err}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
