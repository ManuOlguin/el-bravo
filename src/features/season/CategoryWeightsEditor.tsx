"use client";

import { Chip, Slider, Switch, cn } from "@/src/components/ui";
import { formatWeight, weightExplanation } from "./format";
import {
  PRESETS,
  WEIGHT_MAX,
  WEIGHT_MIN,
  WEIGHT_STEP,
  activePreset,
  applyPreset,
  clampWeight,
  type CategoryOption,
  type SeasonFormState,
} from "./season-form-state";

/**
 * "Sliders por tipo de actividad": cada categoría cuenta o no (Switch) y, si cuenta, tiene un peso de
 * 0,25 a 2 que multiplica sus minutos. Presets arriba.
 */
export function CategoryWeightsEditor({
  state,
  categories,
  onChange,
  error,
}: {
  state: SeasonFormState;
  categories: CategoryOption[];
  onChange(next: SeasonFormState): void;
  error?: string;
}) {
  const preset = activePreset(state, categories);
  const set = (id: string, patch: Partial<SeasonFormState["categories"][string]>) =>
    onChange({ ...state, categories: { ...state.categories, [id]: { ...state.categories[id], ...patch } } });
  const enabledCount = categories.filter((c) => state.categories[c.id]?.enabled).length;

  return (
    <div className="space-y-4">
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Presets de actividades">
        {PRESETS.map((p) => (
          <Chip key={p.id} selected={preset === p.id} onClick={() => onChange(applyPreset(state, p.id, categories))}>
            {p.label}
          </Chip>
        ))}
      </div>
      <p className="text-sm text-fg-muted">
        Elegí qué actividades suman y cuánto valen sus minutos. {enabledCount} de {categories.length} cuentan.
      </p>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <ul className="divide-y divide-border rounded-card border border-border bg-surface-2">
        {categories.map((c) => {
          const d = state.categories[c.id] ?? { enabled: false, weight: 1 };
          return (
            <li key={c.id} className={cn("space-y-1 px-3 py-3", !d.enabled && "opacity-70")}>
              <Switch
                checked={d.enabled}
                onChange={(enabled) => set(c.id, { enabled })}
                label={c.name}
                description={d.enabled ? weightExplanation(d.weight) : "No cuenta"}
              />
              {d.enabled && (
                <Slider
                  value={d.weight}
                  min={WEIGHT_MIN}
                  max={WEIGHT_MAX}
                  step={WEIGHT_STEP}
                  format={formatWeight}
                  aria-label={`Peso de ${c.name}`}
                  onChange={(w) => set(c.id, { weight: clampWeight(w) })}
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
