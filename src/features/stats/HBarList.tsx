/**
 * Barras horizontales de una sola serie (color `primary`), ordenadas por valor.
 * Valor en la punta de cada barra; la etiqueta y el valor usan tokens de texto, nunca el color de la serie.
 */
export function HBarList({ rows, ariaLabel }: { rows: { key: string; label: string; value: number; display: string; hint?: string }[]; ariaLabel: string }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul aria-label={ariaLabel} className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.key} className="space-y-1" title={r.hint ? `${r.label}: ${r.display} · ${r.hint}` : `${r.label}: ${r.display}`}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="min-w-0 truncate font-semibold">{r.label}</span>
            <span className="shrink-0 text-fg-muted tabular-nums">
              {r.display}
              {r.hint && <span className="text-fg-subtle"> · {r.hint}</span>}
            </span>
          </div>
          <div className="h-2 w-full" aria-hidden="true">
            <div className="h-full rounded-r-[4px] bg-primary-gradient-x" style={{ width: `${Math.max(1.5, (r.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
