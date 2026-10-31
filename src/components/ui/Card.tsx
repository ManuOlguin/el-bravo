import { cn } from "./cn";

export function Card({
  className,
  children,
  as: Tag = "div",
  interactive = false,
}: {
  className?: string;
  children: React.ReactNode;
  as?: "div" | "section" | "li";
  interactive?: boolean;
}) {
  return (
    <Tag
      className={cn(
        "rounded-card border border-border bg-surface-1 p-4 shadow-card",
        interactive && "cursor-pointer transition-[transform,background-color] duration-100 hover:bg-surface-2 active:scale-[0.99]",
        className
      )}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="truncate text-base font-bold">{title}</h3>
        {subtitle && <p className="mt-0.5 text-sm text-fg-muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

const statTones = {
  default: "text-fg",
  primary: "text-primary",
  gold: "text-gold",
} as const;

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: keyof typeof statTones;
  className?: string;
}) {
  return (
    <Card className={cn("flex min-w-0 flex-col gap-1", className)}>
      <span className="truncate text-xs uppercase tracking-wide text-fg-muted">{label}</span>
      <span className={cn("text-3xl font-extrabold leading-none tabular-nums", statTones[tone])}>{value}</span>
      {hint && <span className="text-xs text-fg-subtle">{hint}</span>}
    </Card>
  );
}
