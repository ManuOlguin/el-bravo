"use client";
import Link from "next/link";
import { forwardRef } from "react";
import { cn } from "./cn";
import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "relative inline-flex items-center justify-center gap-2 rounded-xl font-semibold select-none " +
  "transition-[transform,background-color,opacity,filter] duration-100 active:scale-[0.97] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg " +
  "disabled:opacity-50 disabled:pointer-events-none aria-disabled:opacity-50 aria-disabled:pointer-events-none";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary-gradient text-on-primary hover:brightness-110",
  secondary: "bg-surface-3 text-fg hover:bg-border",
  ghost: "bg-transparent text-fg-muted hover:bg-surface-2 hover:text-fg",
  danger: "bg-danger/15 text-danger hover:bg-danger/25",
};

type InternalSize = ButtonSize | "icon";

const sizes: Record<InternalSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-sm",
  lg: "h-13 px-5 text-base",
  icon: "h-10 w-10 p-0",
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  fullWidth,
  className,
}: { variant?: ButtonVariant; size?: InternalSize; fullWidth?: boolean; className?: string } = {}) {
  return cn(base, variants[variant], sizes[size], fullWidth && "w-full", className);
}

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  pending?: boolean;
  fullWidth?: boolean;
};

const ButtonImpl = forwardRef<HTMLButtonElement, Omit<ButtonProps, "size"> & { size?: InternalSize }>(function Button(
  { variant = "primary", size = "md", pending = false, fullWidth, className, children, disabled, type = "button", ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-busy={pending || undefined}
      disabled={disabled || pending}
      className={buttonClasses({ variant, size, fullWidth, className })}
      {...rest}
    >
      <span className={cn("inline-flex items-center gap-2", pending && "invisible")}>{children}</span>
      {pending && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Spinner />
          <span className="sr-only">Cargando…</span>
        </span>
      )}
    </button>
  );
});

export const Button = ButtonImpl as React.ForwardRefExoticComponent<ButtonProps & React.RefAttributes<HTMLButtonElement>>;

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  fullWidth,
  className,
  children,
  ...rest
}: React.ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize; fullWidth?: boolean }) {
  return (
    <Link href={href} className={buttonClasses({ variant, size, fullWidth, className })} {...rest}>
      {children}
    </Link>
  );
}

export function IconButton({
  label,
  className,
  ...rest
}: Omit<ButtonProps, "children" | "size"> & { label: string; children: React.ReactNode }) {
  return <ButtonImpl aria-label={label} title={label} variant="ghost" size="icon" className={className} {...rest} />;
}
