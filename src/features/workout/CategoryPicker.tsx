"use client";
import { useState } from "react";
import { cn } from "@/src/components/ui";
import { categoryIcon } from "./category-icons";
import type { CategoryOption } from "./types";

export { categoryIcon };

/** Grilla de categorías grandes (las más usadas primero, ya vienen ordenadas). Muestra 6 y "Más…". */
export function CategoryPicker({
  categories,
  value,
  onChange,
  invalid,
  initialVisible = 6,
}: {
  categories: CategoryOption[];
  value: string | null;
  onChange(id: string): void;
  invalid?: boolean;
  initialVisible?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const selectedIndex = categories.findIndex((c) => c.id === value);
  const showAll = expanded || selectedIndex >= initialVisible;
  const visible = showAll ? categories : categories.slice(0, initialVisible);

  return (
    <div role="radiogroup" aria-label="Tipo de actividad" aria-invalid={invalid || undefined} className="grid grid-cols-3 gap-2">
      {visible.map((c) => {
        const selected = c.id === value;
        return (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={c.name}
            onClick={() => onChange(c.id)}
            className={cn(
              "flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-center text-xs font-semibold leading-tight",
              "transition-[transform,background-color,border-color] duration-100 active:scale-95",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              selected ? "border-primary bg-primary/15 text-primary" : "border-border bg-surface-2 text-fg-muted hover:bg-surface-3 hover:text-fg",
              invalid && !value && "border-danger/60"
            )}
          >
            <span className="text-2xl leading-none" aria-hidden="true">
              {categoryIcon(c.slug)}
            </span>
            <span className="line-clamp-2">{c.name}</span>
          </button>
        );
      })}
      {!showAll && categories.length > initialVisible && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="col-span-3 h-11 rounded-xl text-sm font-semibold text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Ver todas ({categories.length})
        </button>
      )}
    </div>
  );
}
