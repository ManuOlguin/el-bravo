"use client";
import { cn } from "./cn";

/** Chip seleccionable (filtros, opciones). Es un botón con `aria-pressed`. */
export function Chip({
  selected = false,
  onClick,
  children,
  size = "md",
  disabled,
  className,
}: {
  selected?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  size?: "sm" | "md";
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border font-semibold whitespace-nowrap select-none",
        "transition-[transform,background-color,border-color] duration-100 active:scale-95",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        "disabled:pointer-events-none disabled:opacity-50",
        size === "sm" ? "h-8 px-3 text-xs" : "h-9 px-4 text-sm",
        selected
          ? "border-primary bg-primary/15 text-primary"
          : "border-border bg-surface-2 text-fg-muted hover:bg-surface-3 hover:text-fg",
        className
      )}
    >
      {children}
    </button>
  );
}

const pillTones = {
  default: "bg-surface-3 text-fg-muted",
  primary: "bg-primary/15 text-primary",
  danger: "bg-danger/15 text-danger",
  gold: "bg-gold/15 text-gold",
} as const;

/** Etiqueta no interactiva (estado, nivel, categoría). */
export function Pill({
  tone = "default",
  children,
  className,
}: {
  tone?: keyof typeof pillTones;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        pillTones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/** Alias de `Pill` (en 00-roadmap §5.9 figura como `Badge`). No confundir con las insignias. */
export const Badge = Pill;
