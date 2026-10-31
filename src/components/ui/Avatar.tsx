import Link from "next/link";
import { cn } from "./cn";

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

const sizes: Record<AvatarSize, string> = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
  xl: "h-20 w-20 text-2xl",
};

export function Avatar({
  name,
  src,
  size = "md",
  href,
  className,
}: {
  name: string | null | undefined;
  src?: string | null;
  size?: AvatarSize;
  href?: string;
  className?: string;
}) {
  const label = name?.trim() || "Usuario";
  const initial = label.charAt(0).toUpperCase();

  const inner = (
    <span
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-surface-3 font-bold text-fg",
        sizes[size],
        !href && className
      )}
      aria-hidden={href ? true : undefined}
      title={href ? undefined : label}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatares de URLs externas (R2), sin optimizador
        <img src={src} alt={href ? "" : label} loading="lazy" decoding="async" className="h-full w-full object-cover" />
      ) : (
        initial
      )}
    </span>
  );

  if (!href) return inner;

  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        "inline-flex shrink-0 rounded-full transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg active:scale-95",
        className
      )}
    >
      {inner}
    </Link>
  );
}
