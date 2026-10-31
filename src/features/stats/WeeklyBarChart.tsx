"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn, Tabs } from "@/src/components/ui";
import { formatDuration, formatLocalDate } from "@/src/lib/time";
import { useWidth } from "./useWidth";

type Week = { weekKey: string; workouts: number; minutes: number };
type Metric = "workouts" | "minutes";

const METRICS: { id: Metric; label: string }[] = [
  { id: "workouts", label: "Entrenamientos" },
  { id: "minutes", label: "Minutos" },
];

const H = 180;
const PAD = { top: 18, right: 8, bottom: 22 };
/** Margen izquierdo según el ancho de los números del eje. */
const PAD_LEFT = { workouts: 22, minutes: 32 } as const;
const MAX_BAR = 24;
const GAP = 2;

/**
 * Entrenamientos o minutos por semana (una sola serie, degradé `primary` → `primary-strong`).
 * En entrenamientos la línea de referencia es el objetivo semanal; en minutos, el promedio del rango.
 * SVG en píxeles reales (mide el contenedor), tooltip al pasar el mouse, al tocar o con el teclado,
 * y una tabla equivalente para lectores de pantalla.
 */
export function WeeklyBarChart({ weeks, goal }: { weeks: Week[]; goal: number }) {
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const gradientId = useId();
  const [metric, setMetric] = useState<Metric>("workouts");

  // Tocar afuera cierra el tooltip (en touch no hay "mouseleave").
  useEffect(() => {
    if (active === null) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setActive(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [active]);

  const n = weeks.length;
  const value = (w: Week) => (metric === "workouts" ? w.workouts : w.minutes);
  // Promedio desde la primera semana con actividad del rango (no penaliza a quien empezó hace poco).
  const started = weeks.slice(Math.max(0, weeks.findIndex((w) => w.workouts > 0)));
  const reference = metric === "workouts" ? goal : Math.round(started.reduce((acc, w) => acc + w.minutes, 0) / Math.max(1, started.length));
  const maxValue = Math.max(reference, ...weeks.map(value), 1);
  const padLeft = PAD_LEFT[metric];
  const plotW = width - padLeft - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const band = plotW / n;
  const barW = Math.max(2, Math.min(MAX_BAR, band - GAP));
  const y = (v: number) => PAD.top + plotH - (v / maxValue) * plotH;
  const xCenter = (i: number) => padLeft + band * i + band / 2;
  const labelEvery = n <= 6 ? 1 : Math.ceil(n / 4);
  const showLabel = (i: number) => i === n - 1 || (n - 1 - i) % labelEvery === 0;

  const tip = active !== null ? weeks[active] : null;
  const tipLeft = active !== null ? Math.min(Math.max(xCenter(active), 70), width - 70) : 0;

  return (
    <div ref={rootRef} className="space-y-2">
      <Tabs<Metric> aria-label="Métrica" tabs={METRICS} value={metric} onChange={setMetric} />
      <div ref={wrapRef} className="relative w-full" onPointerLeave={(e) => e.pointerType === "mouse" && setActive(null)}>
        <svg width={width} height={H} viewBox={`0 0 ${width} ${H}`} role="img" aria-label={`${metric === "workouts" ? "Entrenamientos" : "Minutos"} por semana, últimas ${n} semanas`} className="block">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" style={{ stopColor: "var(--color-primary)" }} />
              <stop offset="1" style={{ stopColor: "var(--color-primary-strong)" }} />
            </linearGradient>
          </defs>
          {/* Grilla mínima: base y máximo. */}
          {[0, maxValue].map((v) => (
            <g key={v}>
              <line x1={padLeft} x2={width - PAD.right} y1={y(v)} y2={y(v)} className="stroke-border" strokeWidth={1} />
              <text x={padLeft - 6} y={y(v)} dy="0.32em" textAnchor="end" className="fill-fg-subtle text-[10px] tabular-nums">
                {v}
              </text>
            </g>
          ))}

          {weeks.map((w, i) => {
            if (value(w) === 0) return null;
            const top = y(value(w));
            const h = PAD.top + plotH - top;
            const r = Math.min(4, barW / 2, h);
            const x0 = xCenter(i) - barW / 2;
            const x1 = x0 + barW;
            const base = PAD.top + plotH;
            // Extremo de datos redondeado (4 px) y base recta.
            const d = `M${x0},${base} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x1 - r} Q${x1},${top} ${x1},${top + r} V${base} Z`;
            return <path key={w.weekKey} d={d} fill={`url(#${gradientId})`} className={cn("transition-opacity", active !== null && active !== i && "opacity-40")} />;
          })}

          {/* Línea de referencia (objetivo o promedio): su valor va en el eje y la leyenda abajo la nombra. */}
          <line x1={padLeft} x2={width - PAD.right} y1={y(reference)} y2={y(reference)} className="stroke-fg-muted" strokeWidth={1} strokeDasharray="4 3" />
          {reference !== maxValue && reference > 0 && (
            <text x={padLeft - 6} y={y(reference)} dy="0.32em" textAnchor="end" className="fill-fg-muted text-[10px] font-semibold tabular-nums">
              {reference}
            </text>
          )}

          {weeks.map((w, i) =>
            showLabel(i) ? (
              <text key={w.weekKey} x={xCenter(i)} y={H - 6} textAnchor="middle" className={cn("text-[10px]", i === n - 1 ? "fill-fg-muted font-semibold" : "fill-fg-subtle")}>
                {i === n - 1 ? "Actual" : formatLocalDate(w.weekKey)}
              </text>
            ) : null
          )}
        </svg>

        {/* Zonas de toque/hover: toda la banda de cada semana (más grande que la barra). */}
        <div className="absolute inset-y-0 flex" style={{ left: padLeft, right: PAD.right }}>
          {weeks.map((w, i) => (
            <button
              key={w.weekKey}
              type="button"
              aria-label={`Semana del ${formatLocalDate(w.weekKey, "long")}: ${w.workouts} ${w.workouts === 1 ? "entrenamiento" : "entrenamientos"}, ${formatDuration(w.minutes)}`}
              onPointerEnter={(e) => e.pointerType === "mouse" && setActive(i)}
              onClick={() => setActive((cur) => (cur === i ? null : i))}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              className="h-full flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
            />
          ))}
        </div>

        {tip && (
          <div
            role="status"
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-border bg-surface-3 px-2.5 py-1.5 text-xs shadow-card"
            style={{ left: tipLeft }}
          >
            <p className="whitespace-nowrap">
              <strong className="text-sm tabular-nums">{tip.workouts}</strong> <span className="text-fg-muted">{tip.workouts === 1 ? "entrenamiento" : "entrenamientos"}</span>
            </p>
            <p className="whitespace-nowrap text-fg-muted">
              {formatDuration(tip.minutes)} · sem. del {formatLocalDate(tip.weekKey)}
            </p>
          </div>
        )}
      </div>

      <p className="flex items-center gap-2 text-xs text-fg-muted">
        <span aria-hidden="true" className="inline-block w-4 border-t border-dashed border-fg-muted" />
        {metric === "workouts"
          ? `Objetivo semanal: ${goal} ${goal === 1 ? "entrenamiento" : "entrenamientos"}`
          : `Promedio: ${formatDuration(reference)} por semana`}
      </p>

      <details className="text-sm text-fg-muted">
        <summary className="cursor-pointer select-none text-xs font-semibold hover:text-fg">Ver como tabla</summary>
        <table className="mt-2 w-full text-left text-xs">
          <thead>
            <tr className="text-fg-subtle">
              <th className="py-1 font-semibold">Semana</th>
              <th className="py-1 text-right font-semibold">Entrenamientos</th>
              <th className="py-1 text-right font-semibold">Tiempo</th>
            </tr>
          </thead>
          <tbody>
            {[...weeks].reverse().map((w) => (
              <tr key={w.weekKey} className="border-t border-border">
                <td className="py-1">{formatLocalDate(w.weekKey)}</td>
                <td className="py-1 text-right tabular-nums text-fg">{w.workouts}</td>
                <td className="py-1 text-right tabular-nums">{formatDuration(w.minutes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
