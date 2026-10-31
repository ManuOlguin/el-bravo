import { cn } from "./cn";

export function ProgressBar({
  value,
  tone = "primary",
  label,
  className,
}: {
  /** 0..1 */
  value: number;
  tone?: "primary" | "gold";
  label?: string;
  className?: string;
}) {
  const v = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  const pct = Math.round(v * 100);
  return (
    <div className={cn("w-full", className)}>
      {label && (
        <div className="mb-1 flex items-center justify-between gap-2 text-xs text-fg-muted">
          <span className="truncate">{label}</span>
          <span className="tabular-nums">{pct}%</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="h-2 w-full overflow-hidden rounded-full bg-surface-3"
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-300", tone === "gold" ? "bg-gold" : "bg-primary-gradient")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
