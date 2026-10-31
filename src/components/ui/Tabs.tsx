"use client";
import { cn } from "./cn";

export type TabItem<T extends string = string> = { id: T; label: React.ReactNode };

/** Control segmentado. Si no entra en el ancho, scrollea horizontalmente. */
export function Tabs<T extends string = string>({
  tabs,
  value,
  onChange,
  className,
  "aria-label": ariaLabel,
}: {
  tabs: TabItem<T>[];
  value: T;
  onChange(id: T): void;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <div className={cn("no-scrollbar max-w-full overflow-x-auto", className)}>
      <div role="tablist" aria-label={ariaLabel} className="inline-flex min-w-full gap-1 rounded-xl bg-surface-2 p-1">
        {tabs.map((t) => {
          const selected = t.id === value;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(t.id)}
              className={cn(
                "h-9 flex-1 shrink-0 rounded-lg px-3 text-sm font-semibold whitespace-nowrap",
                "transition-[transform,background-color,color] duration-100 active:scale-[0.97]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                selected ? "bg-surface-3 text-fg shadow-card" : "text-fg-muted hover:text-fg"
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
