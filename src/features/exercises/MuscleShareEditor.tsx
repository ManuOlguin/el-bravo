"use client";
import { useRef, useState } from "react";
import { Button, IconButton, Select, Slider, cn } from "@/src/components/ui";
import { isValidShare, normalizeTo100, splitEvenly, sumShare, SHARE_STEP } from "./muscle-share";
import { GROUP_KEYS, GROUP_LABEL, type CatalogMuscle } from "./types";

export type MuscleShare = { muscleId: string; percentage: number };

/**
 * Editor de porcentajes por músculo. Al agregar uno, reparte en partes iguales; cada uno se ajusta con un slider de 5 en 5.
 * Se colapsa a un resumen ("Pecho 60 % · Tríceps 40 % ✎") al tocar "Listo" o cuando el foco sale del editor
 * con una suma válida; tocando el resumen se vuelve a abrir.
 */
export function MuscleShareEditor({
  value,
  onChange,
  muscles,
  error,
  id = "muscles",
}: {
  value: MuscleShare[];
  onChange(next: MuscleShare[]): void;
  muscles: CatalogMuscle[];
  error?: string | null;
  id?: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const byId = new Map(muscles.map((m) => [m.id, m]));
  const values = value.map((v) => v.percentage);
  const sum = sumShare(values);
  const valid = isValidShare(values);
  const available = muscles.filter((m) => !value.some((v) => v.muscleId === m.id));

  const setPercentages = (ps: number[]) => onChange(value.map((v, i) => ({ ...v, percentage: ps[i] })));
  const add = (muscleId: string) => {
    const ids = [...value.map((v) => v.muscleId), muscleId];
    const ps = splitEvenly(ids.length);
    onChange(ids.map((m, i) => ({ muscleId: m, percentage: ps[i] })));
  };
  const remove = (muscleId: string) => {
    const rest = value.filter((v) => v.muscleId !== muscleId);
    const ps = splitEvenly(rest.length);
    onChange(rest.map((v, i) => ({ ...v, percentage: ps[i] })));
  };

  const summary = value.map((v) => `${byId.get(v.muscleId)?.name ?? "?"} ${v.percentage} %`).join(" · ");

  if (collapsed && value.length > 0) {
    return (
      <button
        type="button"
        id={id}
        onClick={() => setCollapsed(false)}
        aria-label={`Músculos: ${summary}. Tocá para editar`}
        className={cn(
          "flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2 text-left text-sm",
          "transition-transform duration-100 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        )}
      >
        <span className="min-w-0">{summary}</span>
        <span aria-hidden="true" className="shrink-0 text-fg-muted">
          ✎
        </span>
      </button>
    );
  }

  return (
    <div
      ref={wrapper}
      id={id}
      className={cn("space-y-3 rounded-xl border bg-surface-2/40 p-3", error && !valid ? "border-danger" : "border-border")}
      onBlur={(e) => {
        const next = e.relatedTarget as Node | null;
        if (next && !wrapper.current?.contains(next) && valid) setCollapsed(true);
      }}
    >
      {value.length === 0 && <p className="text-sm text-fg-muted">Agregá los músculos que trabaja el ejercicio.</p>}
      {value.map((v) => {
        const m = byId.get(v.muscleId);
        return (
          <div key={v.muscleId} className="flex items-center gap-2">
            <span className="w-24 shrink-0 truncate text-sm font-semibold">{m?.name ?? "?"}</span>
            <Slider
              className="min-w-0 flex-1"
              value={v.percentage}
              onChange={(p) => setPercentages(value.map((x) => (x.muscleId === v.muscleId ? p : x.percentage)))}
              min={SHARE_STEP}
              max={100}
              step={SHARE_STEP}
              format={(p) => `${p} %`}
              aria-label={`Porcentaje de ${m?.name ?? "músculo"}`}
            />
            <IconButton label={`Quitar ${m?.name ?? "músculo"}`} onClick={() => remove(v.muscleId)} className="h-9 w-9">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </IconButton>
          </div>
        );
      })}
      {available.length > 0 && (
        <Select
          aria-label="Agregar músculo"
          value=""
          onChange={(e) => {
            if (e.target.value) add(e.target.value);
          }}
        >
          <option value="">+ Agregar músculo…</option>
          {GROUP_KEYS.map((g) => {
            const list = available.filter((m) => m.groupKey === g);
            return list.length ? (
              <optgroup key={g} label={GROUP_LABEL[g]}>
                {list.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </optgroup>
            ) : null;
          })}
        </Select>
      )}
      {value.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={cn("text-sm tabular-nums", valid ? "text-fg-muted" : "font-semibold text-danger")} aria-live="polite">
            Suma: {sum} %{!valid && " (tiene que dar 100 %)"}
          </p>
          <div className="flex gap-2">
            {sum !== 100 && (
              <Button size="sm" variant="secondary" onClick={() => setPercentages(normalizeTo100(values))}>
                Ajustar a 100
              </Button>
            )}
            <Button size="sm" variant="secondary" disabled={!valid} onClick={() => setCollapsed(true)}>
              Listo
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
